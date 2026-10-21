import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { reservePayout } from './payout-reservation.mjs';
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
  '../../db/008_payout_transition_audit.sql'
];

async function applyMigrations(pool) {
  for (const file of migrations) {
    await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
}

function reservation(requestId, idempotencyKey, amountMinor = 100) {
  return {
    requestId,
    idempotencyKey,
    userId: 'state-user',
    currency: 'EUR',
    amountMinor,
    chain: 'base',
    destinationAddress: '0x' + 'a'.repeat(40)
  };
}

test('submission and outcomes are audited, serialized and idempotent', {
  skip: !databaseUrl,
  timeout: 90_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_state_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 16,
    options: `-c search_path=${schema},public`
  });

  try {
    await applyMigrations(pool);
    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      VALUES('state-user','network-v1',now())
    `);
    await pool.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      VALUES('state-credit','state-user','state-credit-idem','EUR',500,'settled_credit')
    `);

    await reservePayout(pool, reservation('state-request', 'state-reserve'));

    const submissions = await Promise.all(
      Array.from({ length: 64 }, () =>
        recordPayoutSubmission(pool, {
          requestId: 'state-request',
          idempotencyKey: 'state-submit',
          providerReference: 'approved-partner-reference'
        })
      )
    );
    assert.equal(submissions.filter(result => !result.duplicate).length, 1);
    assert.equal(submissions.filter(result => result.duplicate).length, 63);

    await assert.rejects(
      recordPayoutSubmission(pool, {
        requestId: 'state-request',
        idempotencyKey: 'different-submit-key',
        providerReference: 'approved-partner-reference'
      }),
      /conflicting payout submission retry/
    );
    await assert.rejects(
      recordPayoutSubmission(pool, {
        requestId: 'state-request',
        idempotencyKey: 'state-submit',
        providerReference: 'different-provider-reference'
      }),
      /conflicting payout submission retry/
    );

    const settlements = await Promise.all(
      Array.from({ length: 64 }, () =>
        recordPayoutOutcome(pool, {
          requestId: 'state-request',
          idempotencyKey: 'state-settle',
          outcome: 'settled'
        })
      )
    );
    assert.equal(settlements.filter(result => !result.duplicate).length, 1);
    assert.equal(settlements.filter(result => result.duplicate).length, 63);

    const audit = await pool.query(`
      SELECT event_kind,count(*)::int AS events
      FROM network_payout_audit
      WHERE request_id='state-request'
      GROUP BY event_kind
      ORDER BY event_kind
    `);
    assert.deepEqual(audit.rows, [
      { event_kind: 'reserved', events: 1 },
      { event_kind: 'settled', events: 1 },
      { event_kind: 'submitted', events: 1 }
    ]);

    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='submitted'
        WHERE request_id='state-request'
      `),
      /network_payout_terminal_state_immutable/
    );
    await assert.rejects(
      recordPayoutOutcome(pool, {
        requestId: 'state-request',
        idempotencyKey: 'state-fail-after-settle',
        outcome: 'failed'
      }),
      /conflicting payout outcome retry/
    );

    await reservePayout(pool, reservation('failed-request', 'failed-reserve'));
    const failed = await recordPayoutOutcome(pool, {
      requestId: 'failed-request',
      idempotencyKey: 'failed-outcome',
      outcome: 'failed'
    });
    assert.equal(failed.duplicate, false);
    const failedRetry = await recordPayoutOutcome(pool, {
      requestId: 'failed-request',
      idempotencyKey: 'failed-outcome',
      outcome: 'failed'
    });
    assert.equal(failedRetry.duplicate, true);

    const direct = await pool.connect();
    try {
      await direct.query('BEGIN');
      await reservePayout(pool, reservation('audit-required', 'audit-required-reserve', 1));
      await direct.query(`
        UPDATE network_payout_requests
        SET status='submitted',provider_reference='missing-audit-reference'
        WHERE request_id='audit-required'
      `);
      await assert.rejects(
        direct.query('COMMIT'),
        /network_payout_submitted_audit_required/
      );
    } finally {
      await direct.query('ROLLBACK').catch(() => {});
      direct.release();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
