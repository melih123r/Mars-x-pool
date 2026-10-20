import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  getNetworkBalance,
  releasePayoutReservation,
  reservePayout
} from './payout-reservation.mjs';
import { recordConsentDecision } from './consent.mjs';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;

test('reservation is concurrency-safe, retryable and rollback restores available fiat', {
  skip: !databaseUrl
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_reservation_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`
  });

  try {
    const migration001 = await readFile(new URL('../../db/001_network_ledger.sql', import.meta.url), 'utf8');
    const migration002 = await readFile(new URL('../../db/002_payout_reservation_audit.sql', import.meta.url), 'utf8');
    const migration004 = await readFile(new URL('../../db/004_consent_audit.sql', import.meta.url), 'utf8');
    await pool.query(migration001);
    await pool.query(migration002);
    await pool.query(migration004);

    await pool.query(`INSERT INTO network_accounts(user_id) VALUES('user-1')`);
    await pool.query(`
      INSERT INTO network_revenue_receipts
        (receipt_id,partner_id,partner_reference,currency,settled_minor,platform_minor,users_minor)
      VALUES ('receipt-1','licensed-test-partner','partner-ref-1','EUR',250,50,200)
    `);
    await pool.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,receipt_id,idempotency_key,currency,amount_minor,entry_type)
      VALUES ('receipt-1:user-1','user-1','receipt-1','receipt:receipt-1:user-1','EUR',200,'settled_credit')
    `);

    const consentProtectedRequest = {
      requestId: 'request-without-consent',
      idempotencyKey: 'reserve-without-consent',
      userId: 'user-1',
      currency: 'EUR',
      amountMinor: 1,
      chain: 'base',
      destinationAddress: '0x' + 'c'.repeat(40)
    };
    await assert.rejects(
      reservePayout(pool, consentProtectedRequest),
      /active network consent required/
    );
    await recordConsentDecision(pool, {
      eventId: 'payout-consent-grant',
      idempotencyKey: 'payout-consent-grant-idem',
      userId: 'user-1',
      consentVersion: 'network-v1',
      decision: 'granted',
      occurredAt: '2026-10-20T13:00:00.000Z'
    });

    for (const [chain, destinationAddress] of [
      ['base', '0x1234'],
      ['polygon', 'not-an-evm-address'],
      ['solana', '0OIl']
    ]) {
      await assert.rejects(
        reservePayout(pool, {
          requestId: 'invalid-' + chain,
          idempotencyKey: 'invalid-address-' + chain,
          userId: 'user-1',
          currency: 'EUR',
          amountMinor: 1,
          chain,
          destinationAddress
        }),
        /invalid (EVM|Solana) address format/
      );
    }

    const initial = await getNetworkBalance(pool, { userId: 'user-1', currency: 'EUR' });
    assert.deepEqual(initial, { pendingMinor: 0, settledMinor: 200, reservedMinor: 0, availableMinor: 200 });

    const attempts = await Promise.allSettled([
      reservePayout(pool, {
        requestId: 'request-a',
        idempotencyKey: 'reserve-a',
        userId: 'user-1',
        currency: 'EUR',
        amountMinor: 150,
        chain: 'base',
        destinationAddress: '0x' + 'a'.repeat(40)
      }),
      reservePayout(pool, {
        requestId: 'request-b',
        idempotencyKey: 'reserve-b',
        userId: 'user-1',
        currency: 'EUR',
        amountMinor: 150,
        chain: 'base',
        destinationAddress: '0x' + 'b'.repeat(40)
      })
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    assert.match(attempts.find(result => result.status === 'rejected').reason.message, /insufficient available balance/);

    const winner = attempts.find(result => result.status === 'fulfilled').value;
    const retry = await reservePayout(pool, winner.input);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.requestId, winner.requestId);

    assert.deepEqual(
      await getNetworkBalance(pool, { userId: 'user-1', currency: 'EUR' }),
      { pendingMinor: 0, settledMinor: 200, reservedMinor: 150, availableMinor: 50 }
    );

    const released = await releasePayoutReservation(pool, {
      requestId: winner.requestId,
      idempotencyKey: 'release-' + winner.requestId
    });
    assert.equal(released.duplicate, false);
    const releasedRetry = await releasePayoutReservation(pool, {
      requestId: winner.requestId,
      idempotencyKey: 'release-' + winner.requestId
    });
    assert.equal(releasedRetry.duplicate, true);

    assert.deepEqual(
      await getNetworkBalance(pool, { userId: 'user-1', currency: 'EUR' }),
      { pendingMinor: 0, settledMinor: 200, reservedMinor: 0, availableMinor: 200 }
    );

    await recordConsentDecision(pool, {
      eventId: 'payout-consent-revoke',
      idempotencyKey: 'payout-consent-revoke-idem',
      userId: 'user-1',
      consentVersion: 'network-v1',
      decision: 'revoked',
      occurredAt: '2026-10-20T13:10:00.000Z'
    });
    await assert.rejects(
      reservePayout(pool, {
        ...consentProtectedRequest,
        requestId: 'request-after-revoke',
        idempotencyKey: 'reserve-after-revoke'
      }),
      /active network consent required/
    );

    const audit = await pool.query(
      'SELECT event_kind FROM network_payout_audit WHERE request_id=$1 ORDER BY created_at,event_key',
      [winner.requestId]
    );
    assert.deepEqual(audit.rows.map(row => row.event_kind).sort(), ['released', 'reserved']);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
