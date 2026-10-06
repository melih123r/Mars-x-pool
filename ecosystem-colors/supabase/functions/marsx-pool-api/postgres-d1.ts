import postgres from "npm:postgres@3.4.7";

const TABLES = [
  "payout_idempotency",
  "dormant_balances",
  "referral_balances",
  "license_devices",
  "user_sessions",
  "referral_codes",
  "auth_nonces",
  "fee_events",
  "user_workers",
  "referrals",
  "balances",
  "payouts",
  "workers",
  "ledger",
  "users",
];

function postgresSql(source: string) {
  let text = String(source).trim().replace(/;\s*$/, "");
  const ignoreConflict = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(text);
  text = text.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");

  for (const table of TABLES) {
    text = text.replace(new RegExp(`(?<![\\w.])${table}(?![\\w])`, "g"), `marsx_pool.${table}`);
  }

  const additiveTarget = text.match(/INSERT\s+INTO\s+marsx_pool\.(balances|dormant_balances|referral_balances)/i)?.[1];
  if (additiveTarget) {
    text = text.replace(
      /SET\s+amount_units\s*=\s*amount_units\s*\+\s*excluded\.amount_units/gi,
      `SET amount_units=marsx_pool.${additiveTarget}.amount_units+excluded.amount_units`,
    );
  }

  let parameter = 0;
  text = text.replace(/\?/g, () => `$${++parameter}`);
  if (ignoreConflict) text += " ON CONFLICT DO NOTHING";
  return text;
}

type QueryClient = any;

class PostgresStatement {
  constructor(
    private readonly database: PostgresD1Database,
    private readonly source: string,
    private readonly parameters: unknown[] = [],
  ) {}

  bind(...parameters: unknown[]) {
    return new PostgresStatement(this.database, this.source, parameters);
  }

  async execute(client?: QueryClient) {
    return this.database.execute(this.source, this.parameters, client);
  }

  async first(column?: string) {
    const rows = await this.execute();
    const row = rows[0] ?? null;
    if (!row || !column) return row;
    return row[column] ?? null;
  }

  async all() {
    const rows = await this.execute();
    return { results: Array.from(rows) };
  }

  async run() {
    const rows = await this.execute();
    return { meta: { changes: Number(rows.count ?? 0) } };
  }
}

export class PostgresD1Database {
  readonly client: QueryClient;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error("SUPABASE_DB_URL_is_required");
    this.client = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  prepare(source: string) {
    return new PostgresStatement(this, source);
  }

  async execute(source: string, parameters: unknown[] = [], client: QueryClient = this.client): Promise<any> {
    return client.unsafe(postgresSql(source), parameters);
  }

  async batch(statements: PostgresStatement[]) {
    return this.client.begin(async (transaction) => {
      const results = [];
      for (const statement of statements) results.push(await statement.execute(transaction as QueryClient));
      return results;
    });
  }
}

export async function loadRuntimeConfig(database: PostgresD1Database) {
  const rows = await database.client.unsafe(`
    select name, decrypted_secret as value
    from vault.decrypted_secrets
    where name like 'marsx_pool_%'
  `);
  return Object.fromEntries(rows.map((row) => [String(row.name), String(row.value)]));
}
