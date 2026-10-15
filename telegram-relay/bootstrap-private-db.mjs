import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const role = 'marsx_telegram_relay';

// Explicit one-time operator command. Never imported by the production server.
export async function bootstrapPrivateDatabase({ adminUrl, password, approved, allowLocalTest = false }) {
  if (approved !== 'create_isolated_telegram_schema') throw new Error('approval_required');
  const url = new URL(adminUrl);
  const localTest = allowLocalTest && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      (!localTest && (url.hostname !== 'dpg-db25p4rtqb8s73c5mii0-a' || url.pathname !== '/marsx_pool_db')) ||
      url.search || url.hash) throw new Error('private_database_required');
  if (!/^[a-f0-9]{64}$/.test(password || '')) throw new Error('random_32_byte_password_required');
  const migrations = await Promise.all([
    readFile(new URL('./sql/001_durable_queue.sql', import.meta.url), 'utf8'),
    readFile(new URL('./sql/003_command_inbox.sql', import.meta.url), 'utf8')
  ]);
  // The migrations are already transactional; keep them inside our larger transaction.
  const migration = migrations.map(sql => sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '')).join('\n');
  const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query('SELECT pg_advisory_xact_lock(730142, 10)');
    const existing = await client.query(`SELECT
      EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='marsx_telegram') AS schema_exists,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='marsx_telegram_relay') AS role_exists`);
    if (existing.rows[0].schema_exists || existing.rows[0].role_exists)
      throw new Error('existing_schema_or_role_requires_review');
    // password is strictly hexadecimal above; no SQL metacharacters are accepted.
    await client.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 4`);
    await client.query(migration);
    await client.query(`REVOKE ALL ON SCHEMA marsx_telegram FROM PUBLIC;
      REVOKE ALL ON ALL TABLES IN SCHEMA marsx_telegram FROM PUBLIC;
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA marsx_telegram FROM PUBLIC;
      GRANT USAGE ON SCHEMA marsx_telegram TO ${role};
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA marsx_telegram TO ${role};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA marsx_telegram TO ${role}`);
    // Refuse installations where PUBLIC permissions would expose unrelated data.
    const exposed = await client.query(`SELECT c.oid FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('marsx_telegram','information_schema')
        AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','v','m','f','S')
        AND CASE WHEN c.relkind='S' THEN has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE')
          ELSE has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END
      LIMIT 1`, [role]);
    if (exposed.rowCount) throw new Error('unrelated_database_permissions_detected');
    await client.query('COMMIT');
    return { created: true, schema: 'marsx_telegram', role, dispatchEnabled: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await bootstrapPrivateDatabase({
      adminUrl: process.env.MARSX_SETUP_DATABASE_URL,
      password: process.env.MARSX_RELAY_DB_PASSWORD,
      approved: process.env.MARSX_BOOTSTRAP_APPROVED
    });
    console.log(JSON.stringify(result));
  } catch {
    // Driver errors can contain SQL, connection strings or credentials.
    console.error('Telegram database setup failed; no credentials logged. Review privately.');
    process.exitCode = 1;
  }
}
