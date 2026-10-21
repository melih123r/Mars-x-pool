import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { recordConsentDecision } from './consent.mjs';
import {
  releasePayoutReservation,
  reservePayout
} from './payout-reservation.mjs';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;
const migrations = [
  '../../db/001_network_ledger.sql',
  '../../db/002_payout_reservation_audit.sql',
  '../../db/003_pending_earnings.sql',
  '../../db/004_consent_audit.sql',
  '../../db/005_payout_consent_gate.sql',
  '../../db/006_payout_reservation_consistency.sql'
];

test('1,000 consented users reserve and release fiat idempotently under load', {
  skip: !databaseUrl,
  timeout: 240_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_reservation_load_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 24,
    connectionTimeoutMillis: 10_000,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of migrations) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      SELECT 'load-user-' || user_no, 'network-v1', now()
      FROM generate_series(1,1000) AS users(user_no)
    `);
    await pool.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      SELECT 'load-credit-' || user_no,
             'load-user-' || user_no,
             'load-credit-idem-' || user_no,
             'EUR',100,'settled_credit'
      FROM generate_series(1,1000) AS users(user_no)
    `);

    const destinationAddress = '0x' + '1'.repeat(40);
    const inputs = Array.from({ length: 1000 }, (_, index) => {
      const userNo = index + 1;
      return {
        requestId: 'load-request-' + userNo,
        idempotencyKey: 'load-request-idem-' + userNo,
        userId: 'load-user-' + userNo,
        currency: 'EUR',
        amountMinor: 40,
        chain: 'base',
        destinationAddress
      };
    });

    const first = await Promise.all(inputs.map(input => reservePayout(pool, input)));
    assert.equal(first.length, 1000);
    assert.ok(first.every(result => result.duplicate === false));

    const retries = await Promise.all(inputs.map(input => reservePayout(pool, input)));
    assert.equal(retries.length, 1000);
    assert.ok(retries.every(result => result.duplicate === true));

    const persisted = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_payout_requests
          WHERE status='reserved') AS requests,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE event_kind='reserved') AS audits,
        (SELECT count(*)::int FROM network_ledger_entries
          WHERE entry_type='payout_reservation') AS reservations
    `);
    assert.deepEqual(persisted.rows[0], {
      requests: 1000,
      audits: 1000,
      reservations: 1000
    });

    const reservedBalances = await pool.query(`
      SELECT user_id,
             sum(amount_minor) FILTER
               (WHERE entry_type='settled_credit')::bigint AS settled_minor,
             sum(amount_minor) FILTER
               (WHERE entry_type='payout_reservation')::bigint AS reservation_minor,
             sum(amount_minor)::bigint AS available_minor
      FROM network_ledger_entries
      GROUP BY user_id
    `);
    assert.equal(reservedBalances.rowCount, 1000);
    assert.ok(reservedBalances.rows.every(row =>
      row.settled_minor === '100' &&
      row.reservation_minor === '-40' &&
      row.available_minor === '60'
    ));

    await pool.query('SET enable_seqscan=off');
    const explain = await pool.query(`
      EXPLAIN (FORMAT JSON)
      SELECT entry_id,amount_minor,created_at
      FROM network_ledger_entries
      WHERE user_id='load-user-500' AND currency='EUR'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    assert.match(
      JSON.stringify(explain.rows[0]['QUERY PLAN']),
      /network_ledger_user_currency_time/
    );

    const revokedAt = new Date(Date.now() + 60_000).toISOString();
    const concurrentResults = await Promise.all(inputs.flatMap((input, index) => {
      const userNo = index + 1;
      const release = {
        requestId: input.requestId,
        idempotencyKey: 'load-release-idem-' + userNo
      };
      const revoke = {
        eventId: 'load-revoke-' + userNo,
        idempotencyKey: 'load-revoke-idem-' + userNo,
        userId: input.userId,
        consentVersion: 'network-v1',
        decision: 'revoked',
        occurredAt: revokedAt
      };
      return [
        releasePayoutReservation(pool, release),
        releasePayoutReservation(pool, release),
        recordConsentDecision(pool, revoke)
      ];
    }));
    const releaseAttempts = concurrentResults.filter(result =>
      Object.hasOwn(result, 'requestId')
    );
    const revocations = concurrentResults.filter(result =>
      result.decision === 'revoked'
    );
    assert.equal(releaseAttempts.length, 2000);
    assert.equal(revocations.length, 1000);
    assert.ok(revocations.every(result => result.duplicate === false));
    assert.equal(
      releaseAttempts.filter(result => result.duplicate === false).length,
      1000
    );
    assert.equal(
      releaseAttempts.filter(result => result.duplicate === true).length,
      1000
    );

    const released = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_payout_requests
          WHERE status='cancelled') AS requests,
        (SELECT count(*)::int FROM network_payout_audit
          WHERE event_kind='released') AS audits,
        (SELECT count(*)::int FROM network_ledger_entries
          WHERE entry_type='payout_release') AS releases,
        (SELECT count(*)::int FROM network_accounts
          WHERE revoked_at IS NOT NULL) AS revoked_accounts,
        (SELECT count(*)::int FROM network_consent_events
          WHERE decision='revoked') AS revocation_events
    `);
    assert.deepEqual(released.rows[0], {
      requests: 1000,
      audits: 1000,
      releases: 1000,
      revoked_accounts: 1000,
      revocation_events: 1000
    });

    const restoredBalances = await pool.query(`
      SELECT user_id,
             sum(amount_minor) FILTER
               (WHERE entry_type='settled_credit')::bigint AS settled_minor,
             sum(amount_minor) FILTER
               (WHERE entry_type='payout_reservation')::bigint AS reservation_minor,
             sum(amount_minor) FILTER
               (WHERE entry_type='payout_release')::bigint AS release_minor,
             sum(amount_minor)::bigint AS available_minor
      FROM network_ledger_entries
      GROUP BY user_id
    `);
    assert.equal(restoredBalances.rowCount, 1000);
    assert.ok(restoredBalances.rows.every(row =>
      row.settled_minor === '100' &&
      row.reservation_minor === '-40' &&
      row.release_minor === '40' &&
      row.available_minor === '100'
    ));

    await assert.rejects(
      releasePayoutReservation(pool, {
        requestId: 'load-request-1',
        idempotencyKey: 'conflicting-release-retry'
      }),
      /conflicting payout release retry/
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
