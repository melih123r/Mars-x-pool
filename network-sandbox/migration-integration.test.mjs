import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const databaseUrl = process.env.MARSX_NETWORK_TEST_DATABASE_URL;

test('v1 receipts survive upgrade and revocation closes sessions atomically', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    const v1 = await readFile(new URL('./sql/001_mock_device_points.sql', import.meta.url), 'utf8');
    await client.query(v1);
    await client.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_upgrade_0001',$1,'GRANTED','v1',now())`,
      ['a'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_network_demo.test_point_receipts
       (receipt_id,mock_device_id,idempotency_key,points,receipt_kind,consent_version)
       VALUES ('receipt_upgrade_001','device_upgrade_0001','receipt-key-upgrade-01',1,'MOCK_HEARTBEAT','v1')`
    );

    const v2 = await readFile(new URL('./sql/002_session_consent_lifecycle.sql', import.meta.url), 'utf8');
    await client.query(v2);
    await client.query(
      `INSERT INTO marsx_network_demo.mock_sessions
       (session_id,mock_device_id,idempotency_key,consent_version,started_at)
       VALUES ('session_upgrade_001','device_upgrade_0001','session-key-upgrade-01','v1',now())`
    );

    const v3 = await readFile(new URL('./sql/003_atomic_consent_transition.sql', import.meta.url), 'utf8');
    await client.query(v3);
    const args = [
      'consent-upgrade-001', 'device_upgrade_0001', 'consent-key-upgrade-01',
      'REVOKED', 'v1', new Date().toISOString()
    ];
    const first = await client.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)',
      args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)',
      args
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);

    const state = await client.query(
      `SELECT d.consent_status,s.session_status,
              (SELECT count(*)::integer FROM marsx_network_demo.test_point_receipts) AS receipt_count
       FROM marsx_network_demo.mock_devices d
       JOIN marsx_network_demo.mock_sessions s USING (mock_device_id)`
    );
    assert.deepEqual(state.rows[0], {
      consent_status: 'REVOKED',
      session_status: 'REVOKED',
      receipt_count: 1
    });
    await assert.rejects(
      client.query(
        `INSERT INTO marsx_network_demo.test_point_receipts
         (receipt_id,mock_device_id,idempotency_key,points,receipt_kind,consent_version)
         VALUES ('receipt_upgrade_002','device_upgrade_0001','receipt-key-upgrade-02',1,'MOCK_HEARTBEAT','v1')`
      ),
      /network_consent_required_for_receipt/
    );
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});
