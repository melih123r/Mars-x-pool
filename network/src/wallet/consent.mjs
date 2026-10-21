const DECISIONS = new Set(['granted', 'revoked']);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid ' + name);
  return value.trim();
}

function requireTimestamp(value) {
  const date = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(date.getTime())) {
    throw new Error('invalid occurredAt');
  }
  return date.toISOString();
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function normalizeDecision(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid consent decision');
  const result = {
    eventId: requireText(input.eventId, 'eventId'),
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    userId: requireText(input.userId, 'userId'),
    consentVersion: requireText(input.consentVersion, 'consentVersion'),
    decision: requireText(input.decision, 'decision'),
    occurredAt: requireTimestamp(input.occurredAt)
  };
  if (!DECISIONS.has(result.decision)) throw new Error('invalid decision');
  return result;
}

function sameDecision(row, input) {
  return row.event_id === input.eventId &&
    row.idempotency_key === input.idempotencyKey &&
    row.user_id === input.userId &&
    row.consent_version === input.consentVersion &&
    row.decision === input.decision &&
    iso(row.occurred_at) === input.occurredAt;
}

export async function getConsentState(queryable, rawUserId) {
  if (!queryable || typeof queryable.query !== 'function') throw new Error('database required');
  const userId = requireText(rawUserId, 'userId');
  const result = await queryable.query(
    `SELECT consent_version,consent_at,revoked_at
     FROM network_accounts WHERE user_id=$1`,
    [userId]
  );
  if (result.rowCount === 0) {
    return { consentVersion: null, consentAt: null, revokedAt: null, active: false };
  }
  const row = result.rows[0];
  return {
    consentVersion: row.consent_version,
    consentAt: iso(row.consent_at),
    revokedAt: iso(row.revoked_at),
    active: row.consent_at != null && row.revoked_at == null
  };
}

export async function recordConsentDecision(pool, rawInput) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  const input = normalizeDecision(rawInput);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      ['network-consent:' + input.userId]
    );

    const existing = await client.query(
      `SELECT event_id,user_id,idempotency_key,consent_version,decision,occurred_at
       FROM network_consent_events
       WHERE event_id=$1 OR idempotency_key=$2
       FOR UPDATE`,
      [input.eventId, input.idempotencyKey]
    );
    if (existing.rowCount > 0) {
      if (existing.rowCount !== 1 || !sameDecision(existing.rows[0], input)) {
        throw new Error('conflicting consent retry');
      }
      await client.query('COMMIT');
      return { duplicate: true, eventId: input.eventId, decision: input.decision };
    }

    await client.query(
      'INSERT INTO network_accounts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',
      [input.userId]
    );
    const stateResult = await client.query(
      `SELECT consent_version,consent_at,revoked_at
       FROM network_accounts WHERE user_id=$1 FOR UPDATE`,
      [input.userId]
    );
    const state = stateResult.rows[0];

    if (input.decision === 'granted') {
      if (state.consent_at != null && state.revoked_at == null) {
        throw new Error('consent already active');
      }
      if (state.revoked_at != null && new Date(input.occurredAt) < new Date(state.revoked_at)) {
        throw new Error('consent decision out of order');
      }
      await client.query(
        `UPDATE network_accounts
         SET consent_version=$2,consent_at=$3,revoked_at=NULL
         WHERE user_id=$1`,
        [input.userId, input.consentVersion, input.occurredAt]
      );
    } else {
      if (state.consent_at == null || state.revoked_at != null) {
        throw new Error('no active consent to revoke');
      }
      if (state.consent_version !== input.consentVersion) {
        throw new Error('consent version mismatch');
      }
      if (new Date(input.occurredAt) < new Date(state.consent_at)) {
        throw new Error('consent decision out of order');
      }
      await client.query(
        'UPDATE network_accounts SET revoked_at=$2 WHERE user_id=$1',
        [input.userId, input.occurredAt]
      );
    }

    await client.query(
      `INSERT INTO network_consent_events
       (event_id,user_id,idempotency_key,consent_version,decision,occurred_at)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [input.eventId, input.userId, input.idempotencyKey,
       input.consentVersion, input.decision, input.occurredAt]
    );
    await client.query('COMMIT');
    return { duplicate: false, eventId: input.eventId, decision: input.decision };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
