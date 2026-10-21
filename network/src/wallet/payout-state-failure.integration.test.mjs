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

function createBrokenTransactionPool() {
  const originalError = new Error('simulated transaction query failure');
  const rollbackError = new Error('simulated rollback connection failure');
  let released = false;

  const client = {
    async query(sql) {
      if (sql === 'BEGIN') return { rowCount: 0, rows: [] };
      if (sql === 'ROLLBACK') throw rollbackError;
      throw originalError;
    },
    release() {
      released = true;
    }
  };

  return {
    pool: {
      async connect() {
        return client;
      }
    },
    originalError,
    rollbackError,
    wasReleased() {
      return released;
    }
  };
}

const cases = [
  {
    name: 'submission',
    operation: recordPayoutSubmission,
    input: {
      requestId: 'failure-request-submission',
      idempotencyKey: 'failure-submission-idempotency',
      providerReference: 'isolated-provider-failure'
    }
  },
  {
    name: 'outcome',
    operation: recordPayoutOutcome,
    input: {
      requestId: 'failure-request-outcome',
      idempotencyKey: 'failure-outcome-idempotency',
      outcome: 'settled'
    }
  }
];

for (const scenario of cases) {
  test(scenario.name + ' preserves the original database error when rollback also fails', async () => {
    const broken = createBrokenTransactionPool();

    await assert.rejects(
      scenario.operation(broken.pool, scenario.input),
      error => error === broken.originalError
    );
    assert.equal(broken.wasReleased(), true);
  });
}

test('row-lock timeout rolls back cleanly and the pool remains reusable', {
  skip: !databaseUrl,
  timeout: 30_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_state_failure_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 5_000,
    options: `-c search_path=${schema},public`
  });
  let blocker;

  try {
    for (const file of migrations) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      VALUES('lock-user','network-v1',now());

      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      VALUES
        ('lock-credit','lock-user','lock-credit-idem','EUR',100,'settled_credit'),
        ('lock-request:reservation','lock-user','lock-reservation-idem',
         'EUR',-40,'payout_reservation');

      INSERT INTO network_payout_requests
        (request_id,user_id,idempotency_key,currency,amount_minor,asset,chain,
         destination_address,status,reservation_entry_id)
      VALUES
        ('lock-request','lock-user','lock-request-idem','EUR',40,'USDC','base',
         '0x9999999999999999999999999999999999999999','reserved',
         'lock-request:reservation');

      INSERT INTO network_payout_audit
        (audit_id,request_id,event_key,event_kind,actor_kind,details)
      VALUES
        ('lock-request:reserved','lock-request',
         'payout:lock-request:reserved','reserved','system','{}'::jsonb);
    `);

    blocker = await pool.connect();
    await blocker.query('BEGIN');
    await blocker.query(`
      SELECT request_id
      FROM network_payout_requests
      WHERE request_id='lock-request'
      FOR UPDATE
    `);

    const startedAt = Date.now();
    await assert.rejects(
      recordPayoutSubmission(pool, {
        requestId: 'lock-request',
        idempotencyKey: 'lock-submit-idem',
        providerReference: 'isolated-provider-lock'
      }),
      error => error?.code === '55P03'
    );
    assert.ok(Date.now() - startedAt < 10_000);

    const unchanged = await pool.query(`
      SELECT status,provider_reference,
        (SELECT count(*)::int
         FROM network_payout_audit
         WHERE request_id='lock-request' AND event_kind='submitted')
          AS submitted_audits
      FROM network_payout_requests
      WHERE request_id='lock-request'
    `);
    assert.deepEqual(unchanged.rows[0], {
      status: 'reserved',
      provider_reference: null,
      submitted_audits: 0
    });

    await blocker.query('ROLLBACK');
    blocker.release();
    blocker = null;

    const recovered = await recordPayoutSubmission(pool, {
      requestId: 'lock-request',
      idempotencyKey: 'lock-submit-idem',
      providerReference: 'isolated-provider-lock'
    });
    assert.equal(recovered.duplicate, false);

    const finalState = await pool.query(`
      SELECT status,provider_reference,
        (SELECT count(*)::int
         FROM network_payout_audit
         WHERE request_id='lock-request' AND event_kind='submitted')
          AS submitted_audits
      FROM network_payout_requests
      WHERE request_id='lock-request'
    `);
    assert.deepEqual(finalState.rows[0], {
      status: 'submitted',
      provider_reference: 'isolated-provider-lock',
      submitted_audits: 1
    });
  } finally {
    if (blocker) {
      await blocker.query('ROLLBACK').catch(() => {});
      blocker.release();
    }
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
