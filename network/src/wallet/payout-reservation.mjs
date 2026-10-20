const SUPPORTED_CURRENCIES = new Set(['EUR', 'USD']);
const SUPPORTED_CHAINS = new Set(['solana', 'base', 'polygon']);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid ' + name);
  return value.trim();
}

function requireAmount(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('invalid amount');
  return value;
}

function validateDestinationAddress(chain, address) {
  if (chain === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error('invalid Solana address format');
    }
    return address;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('invalid EVM address format');
  }
  return address;
}

function validateReservation(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid reservation');
  const normalized = {
    requestId: requireText(input.requestId, 'requestId'),
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    userId: requireText(input.userId, 'userId'),
    currency: requireText(input.currency, 'currency'),
    amountMinor: requireAmount(input.amountMinor),
    chain: requireText(input.chain, 'chain'),
    destinationAddress: requireText(input.destinationAddress, 'destinationAddress')
  };
  if (!SUPPORTED_CURRENCIES.has(normalized.currency)) throw new Error('unsupported currency');
  if (!SUPPORTED_CHAINS.has(normalized.chain)) throw new Error('unsupported chain');
  validateDestinationAddress(normalized.chain, normalized.destinationAddress);
  return normalized;
}

function asSafeNumber(value, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(label + ' exceeds safe integer range');
  return result;
}

export async function getNetworkBalance(queryable, { userId, currency }) {
  if (!queryable || typeof queryable.query !== 'function') throw new Error('database required');
  const uid = requireText(userId, 'userId');
  const code = requireText(currency, 'currency');
  if (!SUPPORTED_CURRENCIES.has(code)) throw new Error('unsupported currency');
  const result = await queryable.query(
    `SELECT
       COALESCE(SUM(amount_minor) FILTER
         (WHERE entry_type IN ('settled_credit','correction')),0)::bigint AS settled_minor,
       COALESCE(SUM(amount_minor) FILTER
         (WHERE entry_type IN ('payout_reservation','payout_release')),0)::bigint AS reservation_delta
     FROM network_ledger_entries
     WHERE user_id=$1 AND currency=$2`,
    [uid, code]
  );
  const settledMinor = asSafeNumber(result.rows[0].settled_minor, 'settled balance');
  const reservationDelta = asSafeNumber(result.rows[0].reservation_delta, 'reservation balance');
  const reservedMinor = Math.max(0, -reservationDelta);
  const availableMinor = settledMinor + reservationDelta;
  if (!Number.isSafeInteger(availableMinor) || availableMinor < 0) {
    throw new Error('invalid persisted balance');
  }
  return { pendingMinor: 0, settledMinor, reservedMinor, availableMinor };
}

function sameReservation(row, input) {
  return row.request_id === input.requestId &&
    row.user_id === input.userId &&
    row.idempotency_key === input.idempotencyKey &&
    row.currency === input.currency &&
    Number(row.amount_minor) === input.amountMinor &&
    row.chain === input.chain &&
    row.destination_address === input.destinationAddress;
}

export async function reservePayout(pool, rawInput) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  const input = validateReservation(rawInput);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [input.userId + ':' + input.currency]
    );
    const existing = await client.query(
      `SELECT request_id,user_id,idempotency_key,currency,amount_minor,chain,
              destination_address,status
       FROM network_payout_requests
       WHERE idempotency_key=$1`,
      [input.idempotencyKey]
    );
    if (existing.rowCount > 0) {
      if (!sameReservation(existing.rows[0], input) ||
          !['reserved', 'cancelled'].includes(existing.rows[0].status)) {
        throw new Error('conflicting payout retry');
      }
      await client.query('COMMIT');
      return { duplicate: true, requestId: existing.rows[0].request_id, input };
    }

    const balance = await getNetworkBalance(client, input);
    if (balance.availableMinor < input.amountMinor) {
      throw new Error('insufficient available balance');
    }

    const reservationEntryId = input.requestId + ':reservation';
    await client.query(
      `INSERT INTO network_ledger_entries
       (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
       VALUES($1,$2,$3,$4,$5,'payout_reservation')`,
      [reservationEntryId, input.userId, 'ledger:' + input.idempotencyKey,
       input.currency, -input.amountMinor]
    );
    await client.query(
      `INSERT INTO network_payout_requests
       (request_id,user_id,idempotency_key,currency,amount_minor,asset,chain,
        destination_address,status,reservation_entry_id)
       VALUES($1,$2,$3,$4,$5,'USDC',$6,$7,'reserved',$8)`,
      [input.requestId, input.userId, input.idempotencyKey, input.currency,
       input.amountMinor, input.chain, input.destinationAddress, reservationEntryId]
    );
    await client.query(
      `INSERT INTO network_payout_audit
       (audit_id,request_id,event_key,event_kind,actor_kind,details)
       VALUES($1,$2,$3,'reserved','system',$4::jsonb)`,
      [input.requestId + ':reserved', input.requestId,
       'payout:' + input.requestId + ':reserved',
       JSON.stringify({ amountMinor: input.amountMinor, currency: input.currency })]
    );
    await client.query('COMMIT');
    return { duplicate: false, requestId: input.requestId, input };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function releasePayoutReservation(pool, rawInput) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  const requestId = requireText(rawInput?.requestId, 'requestId');
  const idempotencyKey = requireText(rawInput?.idempotencyKey, 'idempotencyKey');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT request_id,user_id,currency,amount_minor,status,release_entry_id
       FROM network_payout_requests WHERE request_id=$1 FOR UPDATE`,
      [requestId]
    );
    if (result.rowCount === 0) throw new Error('payout request not found');
    const request = result.rows[0];
    const auditEventKey = 'payout:' + requestId + ':released:' + idempotencyKey;

    if (request.status === 'cancelled') {
      const audit = await client.query(
        'SELECT 1 FROM network_payout_audit WHERE event_key=$1',
        [auditEventKey]
      );
      if (audit.rowCount === 0) throw new Error('conflicting payout release retry');
      await client.query('COMMIT');
      return { duplicate: true, requestId };
    }
    if (request.status !== 'reserved') throw new Error('payout is not releasable');

    const releaseEntryId = requestId + ':release';
    await client.query(
      `INSERT INTO network_ledger_entries
       (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
       VALUES($1,$2,$3,$4,$5,'payout_release')`,
      [releaseEntryId, request.user_id, 'ledger:' + idempotencyKey,
       request.currency, asSafeNumber(request.amount_minor, 'release amount')]
    );
    await client.query(
      `UPDATE network_payout_requests
       SET status='cancelled',release_entry_id=$2,updated_at=now()
       WHERE request_id=$1`,
      [requestId, releaseEntryId]
    );
    await client.query(
      `INSERT INTO network_payout_audit
       (audit_id,request_id,event_key,event_kind,actor_kind,details)
       VALUES($1,$2,$3,'released','system',$4::jsonb)`,
      [requestId + ':released', requestId, auditEventKey,
       JSON.stringify({ reason: 'reservation_rollback' })]
    );
    await client.query('COMMIT');
    return { duplicate: false, requestId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
