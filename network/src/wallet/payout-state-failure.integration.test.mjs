import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordPayoutOutcome,
  recordPayoutSubmission
} from './payout-state.mjs';

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
