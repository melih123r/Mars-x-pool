import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  getEntitlementBalance,
  recordPendingReceipt,
  settlePendingReceipt
} from './pending-earnings.mjs';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;

test('pending fiat entitlement settles once into exact 20/80 ledger allocation', {
  skip: !databaseUrl
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_pending_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of [
      '../../db/001_network_ledger.sql',
      '../../db/002_payout_reservation_audit.sql',
      '../../db/003_pending_earnings.sql'
    ]) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    const pendingInput = {
      transactionId: 'pending-tx-1',
      idempotencyKey: 'pending-idem-1',
      partnerId: 'licensed-test-partner',
      partnerReference: 'partner-pending-1',
      currency: 'EUR',
      expectedSettledMinor: 250,
      allocations: [{ userId: 'user-1', amountMinor: 200 }]
    };

    const first = await recordPendingReceipt(pool, pendingInput);
    assert.equal(first.duplicate, false);
    assert.equal((await recordPendingReceipt(pool, pendingInput)).duplicate, true);
    await assert.rejects(
      recordPendingReceipt(pool, { ...pendingInput, transactionId: 'pending-tx-conflict' }),
      /conflicting pending receipt retry/
    );

    assert.deepEqual(
      await getEntitlementBalance(pool, { userId: 'user-1', currency: 'EUR' }),
      { pendingMinor: 200, settledMinor: 0, reservedMinor: 0, availableMinor: 0 }
    );

    const settlementInput = {
      transactionId: pendingInput.transactionId,
      settledReceiptId: 'settled-receipt-1'
    };
    const results = await Promise.all([
      settlePendingReceipt(pool, settlementInput),
      settlePendingReceipt(pool, settlementInput)
    ]);
    assert.deepEqual(results.map(result => result.duplicate).sort(), [false, true]);

    assert.deepEqual(
      await getEntitlementBalance(pool, { userId: 'user-1', currency: 'EUR' }),
      { pendingMinor: 0, settledMinor: 200, reservedMinor: 0, availableMinor: 200 }
    );

    const receipt = await pool.query(
      `SELECT settled_minor,platform_minor,users_minor
       FROM network_revenue_receipts WHERE receipt_id=$1`,
      [settlementInput.settledReceiptId]
    );
    assert.deepEqual(receipt.rows[0], {
      settled_minor: '250',
      platform_minor: '50',
      users_minor: '200'
    });

    await assert.rejects(
      pool.query(
        `UPDATE network_pending_receipts
         SET transaction_id='mutated-transaction' WHERE transaction_id=$1`,
        [pendingInput.transactionId]
      ),
      /network_pending_identity_immutable/
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
