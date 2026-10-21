import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;
const migrations = [
  '../../db/001_network_ledger.sql',
  '../../db/002_payout_reservation_audit.sql',
  '../../db/003_pending_earnings.sql',
  '../../db/004_consent_audit.sql',
  '../../db/005_payout_consent_gate.sql',
  '../../db/006_payout_reservation_consistency.sql',
  '../../db/007_payout_terminal_state.sql',
  '../../db/008_payout_transition_audit.sql'
];

async function applyMigrations(pool) {
  for (const file of migrations) {
    await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
}

test('migration chain is safely replayable without losing existing rows', {
  skip: !databaseUrl,
  timeout: 90_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_replay_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`
  });

  try {
    await applyMigrations(pool);
    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      VALUES('replay-user','network-v1',now())
    `);
    await pool.query(`
      INSERT INTO network_consent_events
        (event_id,user_id,idempotency_key,consent_version,decision,occurred_at)
      VALUES('replay-consent','replay-user','replay-consent-idem',
             'network-v1','granted',now())
    `);

    await applyMigrations(pool);

    const preserved = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_accounts
          WHERE user_id='replay-user') AS accounts,
        (SELECT count(*)::int FROM network_consent_events
          WHERE event_id='replay-consent') AS consent_events
    `);
    assert.deepEqual(preserved.rows[0], { accounts: 1, consent_events: 1 });

    const objects = await pool.query(`
      SELECT count(*)::int AS tables
      FROM information_schema.tables
      WHERE table_schema=$1
        AND table_name IN (
          'network_accounts','network_revenue_receipts','network_ledger_entries',
          'network_payout_requests','network_payout_audit',
          'network_pending_receipts','network_pending_allocations',
          'network_consent_events'
        )
    `, [schema]);
    assert.equal(objects.rows[0].tables, 8);

    await assert.rejects(
      pool.query(`
        UPDATE network_consent_events SET decision='revoked'
        WHERE event_id='replay-consent'
      `),
      /network_consent_events_append_only/
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});

test('concurrent retries persist one ledger entry for one idempotency key', {
  skip: !databaseUrl,
  timeout: 90_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_idem_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 16,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of migrations.slice(0, 2)) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }
    await pool.query(`
      INSERT INTO network_accounts(user_id) VALUES('retry-user')
    `);

    const attempts = await Promise.allSettled(
      Array.from({ length: 64 }, (_, attempt) =>
        pool.query(`
          INSERT INTO network_ledger_entries
            (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
          VALUES($1,'retry-user','shared-retry-key','EUR',80,'settled_credit')
        `, ['retry-entry-' + attempt])
      )
    );

    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 63);
    assert.ok(attempts
      .filter(result => result.status === 'rejected')
      .every(result => /duplicate key|unique/i.test(String(result.reason))));

    const stored = await pool.query(`
      SELECT count(*)::int AS entries,sum(amount_minor)::bigint AS balance_minor
      FROM network_ledger_entries
      WHERE idempotency_key='shared-retry-key'
    `);
    assert.deepEqual(stored.rows[0], { entries: 1, balance_minor: '80' });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
