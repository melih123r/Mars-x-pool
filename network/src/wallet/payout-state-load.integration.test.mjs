import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  recordPayoutOutcome,
  recordPayoutSubmission
} from './payout-state.mjs';

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

async function seedReservedPayouts(pool, prefix) {
  const setup = await pool.connect();
  try {
    await setup.query('BEGIN');
    await setup.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      SELECT $1 || '-user-' || n,'network-v1',now()
      FROM generate_series(1,1000) AS users(n)
    `, [prefix]);
    await setup.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      SELECT $1 || '-credit-' || n,
             $1 || '-user-' || n,
             $1 || '-credit-idem-' || n,
             'EUR',100,'settled_credit'
      FROM generate_series(1,1000) AS users(n)
    `, [prefix]);
    await setup.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      SELECT $1 || '-request-' || n || ':reservation',
             $1 || '-user-' || n,
             $1 || '-reservation-idem-' || n,
             'EUR',-40,'payout_reservation'
      FROM generate_series(1,1000) AS users(n)
    `, [prefix]);
    await setup.query(`
      INSERT INTO network_payout_requests
        (request_id,user_id,idempotency_key,currency,amount_minor,asset,chain,
         destination_address,status,reservation_entry_id)
      SELECT $1 || '-request-' || n,
             $1 || '-user-' || n,
             $1 || '-request-idem-' || n,
             'EUR',40,'USDC','base',
             '0x' || repeat('9',40),'reserved',
             $1 || '-request-' || n || ':reservation'
      FROM generate_series(1,1000) AS users(n)
    `, [prefix]);
    await setup.query(`
      INSERT INTO network_payout_audit
        (audit_id,request_id,event_key,event_kind,actor_kind,details)
      SELECT $1 || '-request-' || n || ':reserved',
             $1 || '-request-' || n,
             'payout:' || $1 || '-request-' || n || ':reserved',
             'reserved','system','{}'::jsonb
      FROM generate_series(1,1000) AS users(n)
    `, [prefix]);
    await setup.query('COMMIT');
  } finally {
    await setup.query('ROLLBACK').catch(() => {});
    setup.release();
  }
}

test('1,000 payout transitions and retries stay idempotent with a bounded pool', {
  skip: !databaseUrl,
  timeout: 300_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_state_load_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 24,
    connectionTimeoutMillis: 10_000,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of migrations) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    await seedReservedPayouts(pool, 'state-load');

    const submissions = Array.from({ length: 1000 }, (_, index) => ({
      requestId: 'state-load-request-' + (index + 1),
      idempotencyKey: 'state-load-submit-' + (index + 1),
      providerReference: 'isolated-provider-state-load-' + (index + 1)
    }));
    const outcomes = Array.from({ length: 1000 }, (_, index) => ({
      requestId: 'state-load-request-' + (index + 1),
      idempotencyKey: 'state-load-settle-' + (index + 1),
      outcome: 'settled'
    }));

    const firstSubmissions = await Promise.all(
      submissions.map(input => recordPayoutSubmission(pool, input))
    );
    assert.equal(firstSubmissions.filter(result => !result.duplicate).length, 1000);

    const submissionRetries = await Promise.all(
      submissions.map(input => recordPayoutSubmission(pool, input))
    );
    assert.equal(submissionRetries.filter(result => result.duplicate).length, 1000);

    const firstOutcomes = await Promise.all(
      outcomes.map(input => recordPayoutOutcome(pool, input))
    );
    assert.equal(firstOutcomes.filter(result => !result.duplicate).length, 1000);

    const outcomeRetries = await Promise.all(
      outcomes.map(input => recordPayoutOutcome(pool, input))
    );
    assert.equal(outcomeRetries.filter(result => result.duplicate).length, 1000);

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_payout_requests
          WHERE request_id LIKE 'state-load-request-%' AND status='settled')
          AS settled_requests,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE request_id LIKE 'state-load-request-%' AND event_kind='submitted')
          AS submitted_audits,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE request_id LIKE 'state-load-request-%' AND event_kind='settled')
          AS settled_audits,
        (SELECT count(*)::int FROM network_ledger_entries
          WHERE user_id LIKE 'state-load-user-%'
            AND entry_type='payout_reservation') AS reservation_entries
    `);
    assert.deepEqual(counts.rows[0], {
      settled_requests: 1000,
      submitted_audits: 1000,
      settled_audits: 1000,
      reservation_entries: 1000
    });

    const balance = await pool.query(`
      SELECT count(DISTINCT user_id)::int AS users,
             sum(amount_minor)::bigint AS available_minor
      FROM network_ledger_entries
      WHERE user_id LIKE 'state-load-user-%'
    `);
    assert.deepEqual(balance.rows[0], {
      users: 1000,
      available_minor: '60000'
    });

    await seedReservedPayouts(pool, 'state-race');

    const raceSubmissions = Array.from({ length: 1000 }, (_, index) => ({
      requestId: 'state-race-request-' + (index + 1),
      idempotencyKey: 'state-race-submit-' + (index + 1),
      providerReference: 'isolated-provider-state-race-' + (index + 1)
    }));
    const raceSubmissionResults = await Promise.all(
      raceSubmissions.map(input => recordPayoutSubmission(pool, input))
    );
    assert.equal(
      raceSubmissionResults.filter(result => !result.duplicate).length,
      1000
    );

    const terminalRaces = Array.from({ length: 1000 }, (_, index) => {
      const n = index + 1;
      const requestId = 'state-race-request-' + n;
      return [
        recordPayoutOutcome(pool, {
          requestId,
          idempotencyKey: 'state-race-settle-' + n,
          outcome: 'settled'
        }),
        recordPayoutOutcome(pool, {
          requestId,
          idempotencyKey: 'state-race-fail-' + n,
          outcome: 'failed'
        })
      ];
    }).flat();
    const raceResults = await Promise.allSettled(terminalRaces);
    const fulfilled = raceResults.filter(result => result.status === 'fulfilled');
    const rejected = raceResults.filter(result => result.status === 'rejected');
    assert.equal(fulfilled.length, 1000);
    assert.equal(rejected.length, 1000);
    assert.ok(rejected.every(result =>
      /conflicting payout outcome retry/.test(String(result.reason?.message))
    ));

    const terminalRows = await pool.query(`
      SELECT request_id,status
      FROM network_payout_requests
      WHERE request_id LIKE 'state-race-request-%'
        AND status IN ('settled','failed')
    `);
    assert.equal(terminalRows.rowCount, 1000);

    const auditViolations = await pool.query(`
      SELECT count(*)::int AS violations
      FROM (
        SELECT request_id
        FROM network_payout_audit
        WHERE request_id LIKE 'state-race-request-%'
        GROUP BY request_id
        HAVING count(*) FILTER (
          WHERE event_kind IN ('settled','failed')
        ) <> 1
      ) AS invalid
    `);
    assert.equal(auditViolations.rows[0].violations, 0);

    const winningRetries = terminalRows.rows.map(({ request_id: requestId, status }) => {
      const n = requestId.slice(requestId.lastIndexOf('-') + 1);
      return {
        requestId,
        idempotencyKey: `state-race-${status === 'settled' ? 'settle' : 'fail'}-${n}`,
        outcome: status
      };
    });
    const winningRetryResults = await Promise.all(
      winningRetries.map(input => recordPayoutOutcome(pool, input))
    );
    assert.equal(
      winningRetryResults.filter(result => result.duplicate).length,
      1000
    );

    const raceCounts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_payout_audit
          WHERE request_id LIKE 'state-race-request-%'
            AND event_kind='submitted') AS submitted_audits,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE request_id LIKE 'state-race-request-%'
            AND event_kind IN ('settled','failed')) AS terminal_audits,
        (SELECT count(*)::int FROM network_ledger_entries
          WHERE user_id LIKE 'state-race-user-%'
            AND entry_type='payout_reservation') AS reservation_entries,
        (SELECT count(DISTINCT user_id)::int FROM network_ledger_entries
          WHERE user_id LIKE 'state-race-user-%') AS users,
        (SELECT sum(amount_minor)::bigint FROM network_ledger_entries
          WHERE user_id LIKE 'state-race-user-%') AS available_minor
    `);
    assert.deepEqual(raceCounts.rows[0], {
      submitted_audits: 1000,
      terminal_audits: 1000,
      reservation_entries: 1000,
      users: 1000,
      available_minor: '60000'
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
