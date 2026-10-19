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


test('receipt persistence serializes behind consent revocation', { skip: !databaseUrl }, async () => {
  const setup = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  const revoker = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  const receiver = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await Promise.all([setup.connect(), revoker.connect(), receiver.connect()]);
  try {
    await setup.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql'
    ]) {
      await setup.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await setup.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_race_000001',$1,'GRANTED','v1',now())`,
      ['b'.repeat(64)]
    );

    const receiptArgs = [
      'receipt_race_0001', 'device_race_000001', 'receipt-race-key-001',
      1, 'MOCK_HEARTBEAT', 'v1', new Date().toISOString()
    ];
    const first = await setup.query(
      'SELECT * FROM marsx_network_demo.record_test_receipt($1,$2,$3,$4,$5,$6,$7)',
      receiptArgs
    );
    const retry = await setup.query(
      'SELECT * FROM marsx_network_demo.record_test_receipt($1,$2,$3,$4,$5,$6,$7)',
      receiptArgs
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);

    await revoker.query('BEGIN');
    await revoker.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)',
      [
        'consent_race_0001', 'device_race_000001', 'consent-race-key-001',
        'REVOKED', 'v1', new Date().toISOString()
      ]
    );
    const blockedReceipt = receiver.query(
      'SELECT * FROM marsx_network_demo.record_test_receipt($1,$2,$3,$4,$5,$6,$7)',
      [
        'receipt_race_0002', 'device_race_000001', 'receipt-race-key-002',
        1, 'MOCK_RESPONSE', 'v1', new Date().toISOString()
      ]
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    await revoker.query('COMMIT');
    await assert.rejects(blockedReceipt, /network_consent_required_for_receipt/);
  } finally {
    await revoker.query('ROLLBACK').catch(() => {});
    await setup.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await Promise.all([setup.end(), revoker.end(), receiver.end()]);
  }
});


test('receipts bind idempotently to an active consented session', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_session_0001',$1,'GRANTED','v1',now())`,
      ['c'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_network_demo.mock_sessions
       (session_id,mock_device_id,idempotency_key,consent_version,started_at)
       VALUES ('session_receipt_001','device_session_0001','session-receipt-key-01','v1',now())`
    );
    const recordedAt = new Date().toISOString();
    const args = [
      'receipt_session_001', 'session_receipt_001', 'device_session_0001',
      'receipt-session-key-01', 2, 'MOCK_RESPONSE', 'v1', recordedAt
    ];
    const first = await client.query(
      'SELECT * FROM marsx_network_demo.record_session_receipt($1,$2,$3,$4,$5,$6,$7,$8)', args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_network_demo.record_session_receipt($1,$2,$3,$4,$5,$6,$7,$8)', args
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);
    const link = await client.query(
      'SELECT session_id FROM marsx_network_demo.receipt_session_links WHERE receipt_id=$1',
      [args[0]]
    );
    assert.equal(link.rows[0].session_id, args[1]);

    await client.query(
      `UPDATE marsx_network_demo.mock_sessions
          SET session_status='CLOSED',ended_at=now()
        WHERE session_id='session_receipt_001'`
    );
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_network_demo.record_session_receipt($1,$2,$3,$4,$5,$6,$7,$8)',
        ['receipt_session_002', args[1], args[2], 'receipt-session-key-02', 1, 'MOCK_HEARTBEAT', 'v1', new Date().toISOString()]
      ),
      /network_active_session_required_for_receipt/
    );
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});


test('session close is idempotent and blocks later session receipts', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql',
      '006_atomic_session_close.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_close_00001',$1,'GRANTED','v1',now())`,
      ['6'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_network_demo.mock_sessions
       (session_id,mock_device_id,idempotency_key,consent_version,started_at)
       VALUES ('session_close_0001','device_close_00001','session-close-key-001','v1',now())`
    );
    const eventTime = (await client.query("SELECT now() + interval '1 second' AS event_time")).rows[0].event_time;
    const args = ['session-event-0001', 'session_close_0001', 'session-close-event-01', eventTime];
    const first = await client.query(
      'SELECT * FROM marsx_network_demo.close_mock_session($1,$2,$3,$4)', args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_network_demo.close_mock_session($1,$2,$3,$4)', args
    );
    assert.deepEqual(first.rows[0], { session_event_id: args[0], inserted: true });
    assert.deepEqual(retry.rows[0], { session_event_id: args[0], inserted: false });
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_network_demo.record_session_receipt($1,$2,$3,$4,$5,$6,$7,$8)',
        ['receipt_close_0001', args[1], 'device_close_00001', 'receipt-close-key-001', 1, 'MOCK_HEARTBEAT', 'v1', new Date().toISOString()]
      ),
      /network_active_session_required_for_receipt/
    );
    const state = await client.query(
      `SELECT s.session_status,count(e.*)::integer AS event_count
         FROM marsx_network_demo.mock_sessions s
         JOIN marsx_network_demo.session_events e USING (session_id)
        WHERE s.session_id=$1 GROUP BY s.session_status`,
      [args[1]]
    );
    assert.deepEqual(state.rows[0], { session_status: 'CLOSED', event_count: 1 });
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});


test('consent revocation persists one append-only event for every active session', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql',
      '006_atomic_session_close.sql',
      '007_revocation_session_events.sql'
    ]) {
      await assert.doesNotReject(async () => {
        await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
      });
    }
    await client.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_revoke_0001',$1,'GRANTED','v1',now())`,
      ['7'.repeat(64)]
    );
    for (const sessionId of ['session_revoke_001', 'session_revoke_002']) {
      await client.query(
        `INSERT INTO marsx_network_demo.mock_sessions
         (session_id,mock_device_id,idempotency_key,consent_version,started_at)
         VALUES ($1,'device_revoke_0001',$2,'v1',now())`,
        [sessionId, `session-key-${sessionId}`]
      );
    }
    const revocationTime = (await client.query("SELECT now() + interval '1 second' AS event_time")).rows[0].event_time;
    const args = [
      'consent-revoke-0001', 'device_revoke_0001', 'consent-revoke-key-01',
      'REVOKED', 'v1', revocationTime
    ];
    const first = await client.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)', args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)', args
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);
    const events = await client.query(
      `SELECT event_kind,consent_event_id,count(*)::integer AS count
         FROM marsx_network_demo.session_events
        GROUP BY event_kind,consent_event_id`
    );
    assert.deepEqual(events.rows, [{
      event_kind: 'REVOKED', consent_event_id: args[0], count: 2
    }]);
    await assert.rejects(
      client.query(
        `UPDATE marsx_network_demo.session_events
            SET event_time=event_time + interval '1 second'
          WHERE consent_event_id=$1`,
        [args[0]]
      ),
      /network_session_events_are_append_only/
    );
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});


test('terminal session event links preserve close and revocation winners', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql',
      '006_atomic_session_close.sql',
      '007_revocation_session_events.sql',
      '008_terminal_session_event_link.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    for (const suffix of ['close', 'revoke']) {
      await client.query(
        `INSERT INTO marsx_network_demo.mock_devices
         (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
         VALUES ($1,$2,'GRANTED','v1',now())`,
        [`device_terminal_${suffix}`, (suffix === 'close' ? '8' : '9').repeat(64)]
      );
      await client.query(
        `INSERT INTO marsx_network_demo.mock_sessions
         (session_id,mock_device_id,idempotency_key,consent_version,started_at)
         VALUES ($1,$2,$3,'v1',now())`,
        [`session_terminal_${suffix}`, `device_terminal_${suffix}`, `session-terminal-${suffix}`]
      );
    }
    await client.query(
      'SELECT * FROM marsx_network_demo.close_mock_session($1,$2,$3,$4)',
      ['session-event-terminal-close', 'session_terminal_close', 'terminal-close-key-01', new Date().toISOString()]
    );
    await client.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)',
      ['consent-terminal-revoke', 'device_terminal_revoke', 'terminal-revoke-key-01', 'REVOKED', 'v1', new Date().toISOString()]
    );
    const links = await client.query(
      `SELECT s.session_id,s.session_status,e.event_kind
         FROM marsx_network_demo.mock_sessions s
         JOIN marsx_network_demo.session_events e
           ON e.session_event_id=s.terminal_session_event_id
        ORDER BY s.session_id`
    );
    assert.deepEqual(links.rows, [
      { session_id: 'session_terminal_close', session_status: 'CLOSED', event_kind: 'CLOSED' },
      { session_id: 'session_terminal_revoke', session_status: 'REVOKED', event_kind: 'REVOKED' }
    ]);
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});


test('deferred terminal-event constraint rejects orphaned terminal sessions', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql',
      '002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql',
      '004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql',
      '006_atomic_session_close.sql',
      '007_revocation_session_events.sql',
      '008_terminal_session_event_link.sql',
      '009_deferred_terminal_event_constraint.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_orphan_0001',$1,'GRANTED','v1',now())`,
      ['a'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_network_demo.mock_sessions
       (session_id,mock_device_id,idempotency_key,consent_version,started_at)
       VALUES ('session_orphan_001','device_orphan_0001','session-orphan-key-01','v1',now())`
    );
    await client.query('BEGIN');
    await client.query(
      `UPDATE marsx_network_demo.mock_sessions
          SET session_status='CLOSED',ended_at=now()
        WHERE session_id='session_orphan_001'`
    );
    await assert.rejects(client.query('COMMIT'), /network_terminal_session_event_required/);
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await client.end();
  }
});


test('concurrent manual close remains the persisted winner over later revocation', { skip: !databaseUrl }, async () => {
  const setup = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  const closer = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  const revoker = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await Promise.all([setup.connect(), closer.connect(), revoker.connect()]);
  try {
    await setup.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE');
    for (const name of [
      '001_mock_device_points.sql','002_session_consent_lifecycle.sql',
      '003_atomic_consent_transition.sql','004_atomic_receipt_api.sql',
      '005_session_receipt_binding.sql','006_atomic_session_close.sql',
      '007_revocation_session_events.sql','008_terminal_session_event_link.sql',
      '009_deferred_terminal_event_constraint.sql'
    ]) {
      await setup.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await setup.query(
      `INSERT INTO marsx_network_demo.mock_devices
       (mock_device_id,device_ref_hash,consent_status,consent_version,consented_at)
       VALUES ('device_terminal_race',$1,'GRANTED','v1',now())`,
      ['b'.repeat(64)]
    );
    await setup.query(
      `INSERT INTO marsx_network_demo.mock_sessions
       (session_id,mock_device_id,idempotency_key,consent_version,started_at)
       VALUES ('session_terminal_race','device_terminal_race','session-terminal-race','v1',now())`
    );
    await closer.query('BEGIN');
    await closer.query(
      'SELECT * FROM marsx_network_demo.close_mock_session($1,$2,$3,$4)',
      ['session-event-race-close','session_terminal_race','terminal-race-close-01',new Date().toISOString()]
    );
    const revoke = revoker.query(
      'SELECT * FROM marsx_network_demo.record_consent_transition($1,$2,$3,$4,$5,$6)',
      ['consent-event-race-revoke','device_terminal_race','terminal-race-revoke-01','REVOKED','v1',new Date().toISOString()]
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    await closer.query('COMMIT');
    await revoke;
    const winner = await setup.query(
      `SELECT s.session_status,e.event_kind
         FROM marsx_network_demo.mock_sessions s
         JOIN marsx_network_demo.session_events e
           ON e.session_event_id=s.terminal_session_event_id
        WHERE s.session_id='session_terminal_race'`
    );
    assert.deepEqual(winner.rows[0], { session_status: 'CLOSED', event_kind: 'CLOSED' });
  } finally {
    await closer.query('ROLLBACK').catch(() => {});
    await setup.query('DROP SCHEMA IF EXISTS marsx_network_demo CASCADE').catch(() => {});
    await Promise.all([setup.end(), closer.end(), revoker.end()]);
  }
});
