const OUTCOMES = new Set(['settled', 'failed']);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid ' + name);
  return value.trim();
}

function requirePool(pool) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
}

function eventKey(requestId, eventKind, idempotencyKey) {
  return 'payout:' + requestId + ':' + eventKind + ':' + idempotencyKey;
}

async function exactAuditExists(client, key) {
  const result = await client.query(
    'SELECT 1 FROM network_payout_audit WHERE event_key=$1',
    [key]
  );
  return result.rowCount > 0;
}

async function eventKindExists(client, requestId, eventKind) {
  const result = await client.query(
    `SELECT 1 FROM network_payout_audit
     WHERE request_id=$1 AND event_kind=$2
     LIMIT 1`,
    [requestId, eventKind]
  );
  return result.rowCount > 0;
}

export async function recordPayoutSubmission(pool, rawInput) {
  requirePool(pool);
  const requestId = requireText(rawInput?.requestId, 'requestId');
  const idempotencyKey = requireText(rawInput?.idempotencyKey, 'idempotencyKey');
  const providerReference = requireText(rawInput?.providerReference, 'providerReference');
  const key = eventKey(requestId, 'submitted', idempotencyKey);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT request_id,status,provider_reference
       FROM network_payout_requests
       WHERE request_id=$1 FOR UPDATE`,
      [requestId]
    );
    if (result.rowCount === 0) throw new Error('payout request not found');
    const request = result.rows[0];

    if (await exactAuditExists(client, key)) {
      if (request.provider_reference !== providerReference) {
        throw new Error('conflicting payout submission retry');
      }
      await client.query('COMMIT');
      return { duplicate: true, requestId, providerReference };
    }

    if (await eventKindExists(client, requestId, 'submitted') ||
        request.provider_reference != null) {
      throw new Error('conflicting payout submission retry');
    }
    if (request.status !== 'reserved') throw new Error('payout is not submittable');

    await client.query(
      `INSERT INTO network_payout_audit
       (audit_id,request_id,event_key,event_kind,actor_kind,details)
       VALUES($1,$2,$3,'submitted','approved_partner',$4::jsonb)`,
      [requestId + ':submitted', requestId, key,
       JSON.stringify({ providerReference })]
    );
    await client.query(
      `UPDATE network_payout_requests
       SET status='submitted',provider_reference=$2,updated_at=now()
       WHERE request_id=$1`,
      [requestId, providerReference]
    );
    await client.query('COMMIT');
    return { duplicate: false, requestId, providerReference };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordPayoutOutcome(pool, rawInput) {
  requirePool(pool);
  const requestId = requireText(rawInput?.requestId, 'requestId');
  const idempotencyKey = requireText(rawInput?.idempotencyKey, 'idempotencyKey');
  const outcome = requireText(rawInput?.outcome, 'outcome');
  if (!OUTCOMES.has(outcome)) throw new Error('unsupported payout outcome');
  const key = eventKey(requestId, outcome, idempotencyKey);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT request_id,status
       FROM network_payout_requests
       WHERE request_id=$1 FOR UPDATE`,
      [requestId]
    );
    if (result.rowCount === 0) throw new Error('payout request not found');
    const request = result.rows[0];

    if (request.status === outcome && await exactAuditExists(client, key)) {
      await client.query('COMMIT');
      return { duplicate: true, requestId, outcome };
    }

    if (await eventKindExists(client, requestId, outcome) ||
        ['settled', 'failed', 'cancelled'].includes(request.status)) {
      throw new Error('conflicting payout outcome retry');
    }
    if (outcome === 'settled' && request.status !== 'submitted') {
      throw new Error('payout is not settleable');
    }
    if (outcome === 'failed' && !['reserved', 'submitted'].includes(request.status)) {
      throw new Error('payout is not fail-able');
    }

    await client.query(
      `INSERT INTO network_payout_audit
       (audit_id,request_id,event_key,event_kind,actor_kind,details)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [requestId + ':' + outcome, requestId, key, outcome,
       outcome === 'settled' ? 'approved_partner' : 'system',
       JSON.stringify({ source: 'payout_state_service' })]
    );
    await client.query(
      `UPDATE network_payout_requests
       SET status=$2,updated_at=now()
       WHERE request_id=$1`,
      [requestId, outcome]
    );
    await client.query('COMMIT');
    return { duplicate: false, requestId, outcome };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
