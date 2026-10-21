import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getConsentState, recordConsentDecision } from './consent.mjs';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;

test('consent grants and revocations are durable, idempotent and append-only', {
  skip: !databaseUrl
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_consent_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of [
      '../../db/001_network_ledger.sql',
      '../../db/004_consent_audit.sql'
    ]) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    const grant = {
      eventId: 'consent-event-1',
      idempotencyKey: 'consent-idem-1',
      userId: 'user-1',
      consentVersion: 'network-v1',
      decision: 'granted',
      occurredAt: '2026-10-20T13:00:00.000Z'
    };
    assert.equal((await recordConsentDecision(pool, grant)).duplicate, false);
    assert.equal((await recordConsentDecision(pool, grant)).duplicate, true);
    await assert.rejects(
      recordConsentDecision(pool, { ...grant, eventId: 'conflict-event' }),
      /conflicting consent retry/
    );
    assert.deepEqual(await getConsentState(pool, 'user-1'), {
      consentVersion: 'network-v1',
      consentAt: grant.occurredAt,
      revokedAt: null,
      active: true
    });

    const revoke = {
      eventId: 'consent-event-2',
      idempotencyKey: 'consent-idem-2',
      userId: 'user-1',
      consentVersion: 'network-v1',
      decision: 'revoked',
      occurredAt: '2026-10-20T13:05:00.000Z'
    };
    const revocations = await Promise.all([
      recordConsentDecision(pool, revoke),
      recordConsentDecision(pool, revoke)
    ]);
    assert.deepEqual(revocations.map(item => item.duplicate).sort(), [false, true]);
    assert.deepEqual(await getConsentState(pool, 'user-1'), {
      consentVersion: 'network-v1',
      consentAt: grant.occurredAt,
      revokedAt: revoke.occurredAt,
      active: false
    });

    await assert.rejects(
      pool.query(`UPDATE network_consent_events SET decision='granted'
                  WHERE event_id='consent-event-2'`),
      /network_consent_events_append_only/
    );
    await assert.rejects(
      pool.query(`DELETE FROM network_consent_events
                  WHERE event_id='consent-event-2'`),
      /network_consent_events_append_only/
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
