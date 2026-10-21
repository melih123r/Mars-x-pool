import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;
const migrations = [
  '../../db/001_network_ledger.sql',
  '../../db/002_payout_reservation_audit.sql',
  '../../db/004_consent_audit.sql',
  '../../db/005_payout_consent_gate.sql',
  '../../db/006_payout_reservation_consistency.sql',
  '../../db/007_payout_terminal_state.sql',
  '../../db/008_payout_transition_audit.sql',
  '../../db/009_payout_audit_lookup_index.sql'
];

test('10,000 payout records preserve terminal state and audit invariants', {
  skip: !databaseUrl,
  timeout: 240_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_terminal_scale_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 16,
    connectionTimeoutMillis: 10_000,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of migrations) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO network_accounts(user_id,consent_version,consent_at)
        SELECT 'terminal-scale-user-' || n, 'network-v1', now()
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        INSERT INTO network_ledger_entries
          (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
        SELECT 'terminal-scale-credit-' || n,
               'terminal-scale-user-' || n,
               'terminal-scale-credit-idem-' || n,
               'EUR',100,'settled_credit'
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        INSERT INTO network_ledger_entries
          (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
        SELECT 'terminal-scale-request-' || n || ':reservation',
               'terminal-scale-user-' || n,
               'terminal-scale-reserve-idem-' || n,
               'EUR',-40,'payout_reservation'
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        INSERT INTO network_payout_requests
          (request_id,user_id,idempotency_key,currency,amount_minor,asset,chain,
           destination_address,status,reservation_entry_id)
        SELECT 'terminal-scale-request-' || n,
               'terminal-scale-user-' || n,
               'terminal-scale-request-idem-' || n,
               'EUR',40,'USDC','base',
               '0x' || repeat('8',40),'reserved',
               'terminal-scale-request-' || n || ':reservation'
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        INSERT INTO network_payout_audit
          (audit_id,request_id,event_key,event_kind,actor_kind,details)
        SELECT 'terminal-scale-request-' || n || ':reserved',
               'terminal-scale-request-' || n,
               'payout:terminal-scale-request-' || n || ':reserved',
               'reserved','system','{}'::jsonb
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        INSERT INTO network_payout_audit
          (audit_id,request_id,event_key,event_kind,actor_kind,details)
        SELECT 'terminal-scale-request-' || n || ':submitted',
               'terminal-scale-request-' || n,
               'payout:terminal-scale-request-' || n || ':submitted',
               'submitted','approved_partner',
               jsonb_build_object(
                 'providerReference',
                 'isolated-provider:terminal-scale-request-' || n
               )
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        UPDATE network_payout_requests
        SET status='submitted',
            provider_reference='isolated-provider:' || request_id,
            updated_at=now()
        WHERE request_id LIKE 'terminal-scale-request-%'
      `);
      await client.query(`
        INSERT INTO network_payout_audit
          (audit_id,request_id,event_key,event_kind,actor_kind,details)
        SELECT 'terminal-scale-request-' || n || ':settled',
               'terminal-scale-request-' || n,
               'payout:terminal-scale-request-' || n || ':settled',
               'settled','approved_partner',
               '{"mode":"isolated_scale_test"}'::jsonb
        FROM generate_series(1,10000) AS users(n)
      `);
      await client.query(`
        UPDATE network_payout_requests
        SET status='settled',updated_at=now()
        WHERE request_id LIKE 'terminal-scale-request-%'
      `);
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_payout_requests
          WHERE status='settled') AS settled_requests,
        (SELECT count(*)::int FROM network_payout_requests
          WHERE provider_reference IS NOT NULL) AS provider_references,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE event_kind='reserved') AS reserved_audits,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE event_kind='submitted') AS submitted_audits,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE event_kind='settled') AS settled_audits,
        (SELECT count(*)::int FROM network_ledger_entries
          WHERE entry_type='payout_reservation') AS reservation_entries
    `);
    assert.deepEqual(counts.rows[0], {
      settled_requests: 10000,
      provider_references: 10000,
      reserved_audits: 10000,
      submitted_audits: 10000,
      settled_audits: 10000,
      reservation_entries: 10000
    });

    const balance = await pool.query(`
      SELECT count(DISTINCT user_id)::int AS users,
             sum(amount_minor)::bigint AS available_minor
      FROM network_ledger_entries
    `);
    assert.deepEqual(balance.rows[0], {
      users: 10000,
      available_minor: '600000'
    });

    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='failed'
        WHERE request_id='terminal-scale-request-1'
      `),
      /network_payout_terminal_state_immutable/
    );

    await pool.query('SET enable_seqscan=off');
    const explain = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT request_id,updated_at
      FROM network_payout_requests
      WHERE status='settled'
      ORDER BY updated_at,request_id
      LIMIT 100
    `);
    assert.match(
      JSON.stringify(explain.rows[0]['QUERY PLAN']),
      /network_payout_status_time/
    );

    const auditExplain = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT event_key
      FROM network_payout_audit
      WHERE request_id='terminal-scale-request-5000'
        AND event_kind='submitted'
      ORDER BY event_key
      LIMIT 1
    `);
    assert.match(
      JSON.stringify(auditExplain.rows[0]['QUERY PLAN']),
      /network_payout_audit_request_kind/
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
