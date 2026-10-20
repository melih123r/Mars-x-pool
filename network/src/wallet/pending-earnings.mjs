import { splitReceipt } from './settlement.mjs';

const CURRENCIES = new Set(['EUR', 'USD']);

function textValue(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid ' + name);
  return value.trim();
}

function safeNumber(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(name + ' exceeds safe integer range');
  return number;
}

function normalizePending(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid pending receipt');
  const result = {
    transactionId: textValue(input.transactionId, 'transactionId'),
    idempotencyKey: textValue(input.idempotencyKey, 'idempotencyKey'),
    partnerId: textValue(input.partnerId, 'partnerId'),
    partnerReference: textValue(input.partnerReference, 'partnerReference'),
    currency: textValue(input.currency, 'currency'),
    expectedSettledMinor: input.expectedSettledMinor,
    allocations: input.allocations
  };
  if (!CURRENCIES.has(result.currency)) throw new Error('unsupported currency');
  return result;
}

function samePending(row, input, split) {
  return row.transaction_id === input.transactionId &&
    row.idempotency_key === input.idempotencyKey &&
    row.partner_id === input.partnerId &&
    row.partner_reference === input.partnerReference &&
    row.currency === input.currency &&
    Number(row.expected_settled_minor) === input.expectedSettledMinor &&
    Number(row.platform_minor) === split.platformMinor &&
    Number(row.users_minor) === split.usersMinor;
}

async function allocationsMatch(client, transactionId, allocations) {
  const stored = await client.query(
    `SELECT user_id,amount_minor FROM network_pending_allocations
     WHERE transaction_id=$1`,
    [transactionId]
  );
  const expected = new Map(
    allocations.filter(item => item.amountMinor > 0)
      .map(item => [item.userId, item.amountMinor])
  );
  return stored.rows.length === expected.size &&
    stored.rows.every(row => expected.get(row.user_id) === Number(row.amount_minor));
}

export async function recordPendingReceipt(pool, rawInput) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  const input = normalizePending(rawInput);
  const split = splitReceipt(input.expectedSettledMinor, input.allocations);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [input.partnerId + ':' + input.partnerReference]
    );
    const inserted = await client.query(
      `INSERT INTO network_pending_receipts
       (transaction_id,idempotency_key,partner_id,partner_reference,currency,
        expected_settled_minor,platform_minor,users_minor)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING
       RETURNING transaction_id`,
      [input.transactionId, input.idempotencyKey, input.partnerId,
       input.partnerReference, input.currency, input.expectedSettledMinor,
       split.platformMinor, split.usersMinor]
    );

    if (inserted.rowCount === 0) {
      const existing = await client.query(
        `SELECT * FROM network_pending_receipts
         WHERE idempotency_key=$1
            OR (partner_id=$2 AND partner_reference=$3)
         FOR UPDATE`,
        [input.idempotencyKey, input.partnerId, input.partnerReference]
      );
      const row = existing.rows[0];
      if (!row || !samePending(row, input, split) ||
          !(await allocationsMatch(client, row.transaction_id, input.allocations))) {
        throw new Error('conflicting pending receipt retry');
      }
      await client.query('COMMIT');
      return { duplicate: true, transactionId: row.transaction_id, ...split };
    }

    for (const allocation of input.allocations) {
      if (allocation.amountMinor === 0) continue;
      await client.query(
        'INSERT INTO network_accounts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',
        [allocation.userId]
      );
      await client.query(
        `INSERT INTO network_pending_allocations
         (transaction_id,user_id,amount_minor) VALUES($1,$2,$3)`,
        [input.transactionId, allocation.userId, allocation.amountMinor]
      );
    }
    await client.query('COMMIT');
    return { duplicate: false, transactionId: input.transactionId, ...split };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function settlePendingReceipt(pool, rawInput) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  const transactionId = textValue(rawInput?.transactionId, 'transactionId');
  const settledReceiptId = textValue(rawInput?.settledReceiptId, 'settledReceiptId');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pending = await client.query(
      `SELECT * FROM network_pending_receipts
       WHERE transaction_id=$1 FOR UPDATE`,
      [transactionId]
    );
    if (pending.rowCount === 0) throw new Error('pending receipt not found');
    const row = pending.rows[0];
    if (row.status === 'settled') {
      if (row.settled_receipt_id !== settledReceiptId) {
        throw new Error('conflicting settlement retry');
      }
      await client.query('COMMIT');
      return { duplicate: true, transactionId, settledReceiptId };
    }
    if (row.status !== 'pending') throw new Error('pending receipt is terminal');

    await client.query(
      `INSERT INTO network_revenue_receipts
       (receipt_id,partner_id,partner_reference,currency,settled_minor,
        platform_minor,users_minor)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [settledReceiptId, row.partner_id, row.partner_reference, row.currency,
       row.expected_settled_minor, row.platform_minor, row.users_minor]
    );
    const allocations = await client.query(
      `SELECT user_id,amount_minor FROM network_pending_allocations
       WHERE transaction_id=$1 ORDER BY user_id`,
      [transactionId]
    );
    for (const allocation of allocations.rows) {
      await client.query(
        `INSERT INTO network_ledger_entries
         (entry_id,user_id,receipt_id,idempotency_key,currency,amount_minor,entry_type)
         VALUES($1,$2,$3,$4,$5,$6,'settled_credit')`,
        [settledReceiptId + ':' + allocation.user_id, allocation.user_id,
         settledReceiptId, 'pending-settlement:' + transactionId + ':' + allocation.user_id,
         row.currency, allocation.amount_minor]
      );
    }
    await client.query(
      `UPDATE network_pending_receipts
       SET status='settled',settled_receipt_id=$2,updated_at=now()
       WHERE transaction_id=$1`,
      [transactionId, settledReceiptId]
    );
    await client.query('COMMIT');
    return { duplicate: false, transactionId, settledReceiptId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getEntitlementBalance(queryable, rawInput) {
  if (!queryable || typeof queryable.query !== 'function') throw new Error('database required');
  const userId = textValue(rawInput?.userId, 'userId');
  const currency = textValue(rawInput?.currency, 'currency');
  if (!CURRENCIES.has(currency)) throw new Error('unsupported currency');
  const result = await queryable.query(
    `SELECT
       (SELECT COALESCE(SUM(a.amount_minor),0)::bigint
          FROM network_pending_allocations a
          JOIN network_pending_receipts p ON p.transaction_id=a.transaction_id
         WHERE a.user_id=$1 AND p.currency=$2 AND p.status='pending') AS pending_minor,
       (SELECT COALESCE(SUM(amount_minor),0)::bigint
          FROM network_ledger_entries
         WHERE user_id=$1 AND currency=$2
           AND entry_type IN ('settled_credit','correction')) AS settled_minor,
       (SELECT COALESCE(SUM(amount_minor),0)::bigint
          FROM network_ledger_entries
         WHERE user_id=$1 AND currency=$2
           AND entry_type IN ('payout_reservation','payout_release')) AS reservation_delta`,
    [userId, currency]
  );
  const pendingMinor = safeNumber(result.rows[0].pending_minor, 'pending balance');
  const settledMinor = safeNumber(result.rows[0].settled_minor, 'settled balance');
  const reservationDelta = safeNumber(result.rows[0].reservation_delta, 'reservation balance');
  const reservedMinor = Math.max(0, -reservationDelta);
  const availableMinor = settledMinor + reservationDelta;
  if (!Number.isSafeInteger(availableMinor) || availableMinor < 0) {
    throw new Error('invalid persisted balance');
  }
  return { pendingMinor, settledMinor, reservedMinor, availableMinor };
}
