import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  releasePayoutReservation,
  reservePayout
} from './payout-reservation.mjs';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;
const migrations = [
  '../../db/001_network_ledger.sql',
  '../../db/002_payout_reservation_audit.sql',
  '../../db/004_consent_audit.sql',
  '../../db/005_payout_consent_gate.sql',
  '../../db/006_payout_reservation_consistency.sql',
  '../../db/007_payout_terminal_state.sql'
];

test('payout terminal transitions are ordered, audited and race-safe', {
  skip: !databaseUrl,
  timeout: 90_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_terminal_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 8,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of migrations) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }
    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      VALUES('terminal-user','network-v1',now())
    `);
    await pool.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,idempotency_key,currency,amount_minor,entry_type)
      VALUES('terminal-credit','terminal-user','terminal-credit-idem',
             'EUR',500,'settled_credit')
    `);

    const destinationAddress = '0x' + '7'.repeat(40);
    const reserve = requestId => reservePayout(pool, {
      requestId,
      idempotencyKey: requestId + '-idem',
      userId: 'terminal-user',
      currency: 'EUR',
      amountMinor: 50,
      chain: 'base',
      destinationAddress
    });

    await reserve('settled-request');
    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='settled',provider_reference='provider-settled'
        WHERE request_id='settled-request'
      `),
      /network_invalid_payout_state_transition/
    );
    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='submitted'
        WHERE request_id='settled-request'
      `),
      /network_payout_provider_reference_required/
    );
    await pool.query(`
      UPDATE network_payout_requests
      SET status='submitted',provider_reference='provider-settled'
      WHERE request_id='settled-request'
    `);
    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET provider_reference='provider-replaced'
        WHERE request_id='settled-request'
      `),
      /network_payout_provider_reference_immutable/
    );

    const settleClient = await pool.connect();
    try {
      await settleClient.query('BEGIN');
      await settleClient.query(`
        INSERT INTO network_payout_audit
          (audit_id,request_id,event_key,event_kind,actor_kind,details)
        VALUES('settled-request:settled','settled-request',
               'payout:settled-request:settled','settled','approved_partner',
               '{"mode":"isolated_test"}'::jsonb)
      `);
      await settleClient.query(`
        UPDATE network_payout_requests
        SET status='settled',updated_at=now()
        WHERE request_id='settled-request'
      `);
      await settleClient.query('COMMIT');
    } finally {
      await settleClient.query('ROLLBACK').catch(() => {});
      settleClient.release();
    }
    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='failed'
        WHERE request_id='settled-request'
      `),
      /network_payout_terminal_state_immutable/
    );

    await reserve('failed-request');
    const failedClient = await pool.connect();
    try {
      await failedClient.query('BEGIN');
      await failedClient.query(`
        INSERT INTO network_payout_audit
          (audit_id,request_id,event_key,event_kind,actor_kind,details)
        VALUES('failed-request:failed','failed-request',
               'payout:failed-request:failed','failed','system',
               '{"mode":"isolated_test"}'::jsonb)
      `);
      await failedClient.query(`
        UPDATE network_payout_requests SET status='failed'
        WHERE request_id='failed-request'
      `);
      await failedClient.query('COMMIT');
    } finally {
      await failedClient.query('ROLLBACK').catch(() => {});
      failedClient.release();
    }
    await assert.rejects(
      pool.query(`
        UPDATE network_payout_requests
        SET status='submitted',provider_reference='late-provider'
        WHERE request_id='failed-request'
      `),
      /network_payout_terminal_state_immutable/
    );

    await reserve('race-request');
    const race = await Promise.allSettled([
      pool.query(`
        UPDATE network_payout_requests
        SET status='submitted',provider_reference='race-provider'
        WHERE request_id='race-request'
      `),
      releasePayoutReservation(pool, {
        requestId: 'race-request',
        idempotencyKey: 'race-release-idem'
      })
    ]);
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(race.filter(result => result.status === 'rejected').length, 1);

    const final = await pool.query(`
      SELECT status,provider_reference,release_entry_id
      FROM network_payout_requests WHERE request_id='race-request'
    `);
    assert.ok(['submitted', 'cancelled'].includes(final.rows[0].status));
    if (final.rows[0].status === 'submitted') {
      assert.equal(final.rows[0].provider_reference, 'race-provider');
      assert.equal(final.rows[0].release_entry_id, null);
    } else {
      assert.equal(final.rows[0].provider_reference, null);
      assert.equal(final.rows[0].release_entry_id, 'race-request:release');
    }

    const terminalAudits = await pool.query(`
      SELECT request_id,event_kind FROM network_payout_audit
      WHERE request_id IN ('settled-request','failed-request','race-request')
        AND event_kind IN ('settled','failed','released')
      ORDER BY request_id,event_kind
    `);
    assert.ok(terminalAudits.rows.some(row =>
      row.request_id === 'settled-request' && row.event_kind === 'settled'
    ));
    assert.ok(terminalAudits.rows.some(row =>
      row.request_id === 'failed-request' && row.event_kind === 'failed'
    ));
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
