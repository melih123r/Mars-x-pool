import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PostgresTaskQueue } from './postgres-task-queue.mjs';

function fakePool({ duplicate = false, auditDuplicate = false, auditExisting, existing } = {}) {
  const calls = [];
  const stored = existing || {
    command_id: 'telegram-86-chat', update_id: 86, command_kind: 'chat',
    project: 'finance', status: 'pending', attempt_count: 0
  };
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('INSERT INTO marsx_telegram.command_inbox'))
        return { rowCount: duplicate ? 0 : 1 };
      if (sql.startsWith('INSERT INTO marsx_telegram.command_audit_log'))
        return { rowCount: auditDuplicate ? 0 : 1, rows: auditDuplicate ? [] : [{ audit_event_id: 'audit_test' }] };
      if (sql.startsWith('SELECT event_kind,lane_number,actor_ref_hash,metadata'))
        return { rows: [auditExisting || {
          event_kind: 'CLAIMED', lane_number: 10, actor_ref_hash: 'a'.repeat(64),
          metadata: { worker: 'command_worker' }
        }] };
      if (sql.startsWith('SELECT command_id,update_id,command_kind'))
        return { rows: [stored] };
      if (sql.includes('WITH available AS'))
        return { rows: [{ ...stored, status: 'claimed', worker_id: params[0], attempt_count: 1 }] };
      if (sql.startsWith('UPDATE marsx_telegram.command_inbox'))
        return { rows: [{ ...stored, status: 'pending', worker_id: null, attempt_count: 1 }] };
      return { rowCount: 1, rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  return { calls, async connect() { return client; }, async query(...args) { return client.query(...args); }, async end() {} };
}

test('chat command is encrypted and committed atomically', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.storeCommandAtomic({ updateId: 86, kind: 'chat', project: 'finance', message: 'özel mesaj' });
  assert.deepEqual(result, { commandId: 'telegram-86-chat', status: 'pending', duplicate: false });
  const insert = pool.calls.find(call => call.sql.startsWith('INSERT INTO marsx_telegram.command_inbox'));
  assert.ok(Buffer.isBuffer(insert.params[4]));
  assert.ok(!insert.params[4].includes(Buffer.from('özel mesaj')));
  assert.ok(pool.calls.some(call => call.sql === 'BEGIN'));
  assert.ok(pool.calls.some(call => call.sql === 'COMMIT'));
});

test('Telegram retry returns the existing durable command without a second record', async () => {
  const pool = fakePool({ duplicate: true });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.storeCommandAtomic({ updateId: 86, kind: 'chat', project: 'finance', message: 'retry' });
  assert.deepEqual(result, { commandId: 'telegram-86-chat', status: 'pending', duplicate: true });
  assert.equal(pool.calls.filter(call => call.sql.startsWith('INSERT INTO marsx_telegram.command_inbox')).length, 1);
});

test('same update ID cannot be reused for another command scope', async () => {
  const pool = fakePool({ duplicate: true, existing: {
    command_id: 'telegram-86-task', update_id: 86, command_kind: 'task',
    project: 'pool', status: 'pending', attempt_count: 0
  } });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(
    queue.storeCommandAtomic({ updateId: 86, kind: 'chat', project: 'finance', message: 'collision' }),
    /update_id_conflict/
  );
  assert.ok(pool.calls.some(call => call.sql === 'ROLLBACK'));
});

test('invalid projects are rejected before database access', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(
    queue.storeCommandAtomic({ updateId: 86, kind: 'task', project: '../secret', message: 'do work' }),
    /invalid_project/
  );
  assert.equal(pool.calls.length, 0);
});

test('command claim and retry use a bounded atomic lease', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const claimed = await queue.claimNextCommand('command_worker', 60);
  assert.equal(claimed.status, 'claimed');
  assert.ok(pool.calls.some(call => call.sql.includes('FOR UPDATE SKIP LOCKED')));
  await queue.retryCommand('telegram-86-chat', 'command_worker', 'temporary_failure', 30);
  const retry = pool.calls.find(call => call.sql.startsWith('UPDATE marsx_telegram.command_inbox'));
  assert.match(retry.sql, /attempt_count < 10/);
  assert.deepEqual(retry.params, ['telegram-86-chat', 'command_worker', 'temporary_failure', 30]);
  await assert.rejects(queue.claimNextCommand('worker', 301), /invalid_lease/);
  await assert.rejects(queue.retryCommand('telegram-86-chat', 'worker', 'bad code!', 30), /invalid_error_code/);
});

test('expired command leases are recovered for bounded retry', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await queue.recoverExpired(25);
  const recovery = pool.calls.find(call => call.sql.includes('UPDATE marsx_telegram.command_inbox'));
  assert.ok(recovery);
  assert.match(recovery.sql, /attempt_count >= 10 THEN 'failed' ELSE 'pending'/);
  assert.match(recovery.sql, /FOR UPDATE SKIP LOCKED/);
});

const auditMigrationUrl = new URL('./sql/004_command_audit_log.sql', import.meta.url);

test('v2 audit log is append-only, idempotent and bounded to ten task lanes', async () => {
  const [inboxSql, auditSql] = await Promise.all([
    readFile(new URL('./sql/003_command_inbox.sql', import.meta.url), 'utf8'),
    readFile(auditMigrationUrl, 'utf8')
  ]);
  assert.match(inboxSql, /CREATE TABLE IF NOT EXISTS marsx_telegram\.command_inbox/);
  assert.match(auditSql, /^BEGIN;/);
  assert.match(auditSql, /CREATE TABLE IF NOT EXISTS marsx_telegram\.command_audit_log/);
  assert.match(auditSql, /lane_number INTEGER NOT NULL CHECK \(lane_number BETWEEN 1 AND 10\)/);
  assert.match(auditSql, /UNIQUE \(command_id, event_key\)/);
  assert.match(auditSql, /BEFORE UPDATE OR DELETE ON marsx_telegram\.command_audit_log/);
  assert.doesNotMatch(auditSql, /payload_ciphertext|DROP|TRUNCATE|ALTER TABLE marsx_telegram\.command_inbox/);
  assert.match(auditSql, /COMMIT;\s*$/);
});

test('bootstrap applies the audit migration after the durable inbox', async () => {
  const bootstrap = await readFile(new URL('./bootstrap-private-db.mjs', import.meta.url), 'utf8');
  const inbox = bootstrap.indexOf("./sql/003_command_inbox.sql");
  const audit = bootstrap.indexOf("./sql/004_command_audit_log.sql");
  assert.ok(inbox >= 0);
  assert.ok(audit > inbox);
});

test('command audit append is bounded and idempotent without payload storage', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const event = {
    commandId: 'telegram-86-chat',
    eventKey: 'worker-claim-0001',
    eventKind: 'CLAIMED',
    laneNumber: 10,
    actorRefHash: 'a'.repeat(64),
    metadata: { worker: 'command_worker' }
  };
  assert.deepEqual(await queue.appendCommandAudit(event), { recorded: true });
  const insert = pool.calls.find(call => call.sql.startsWith('INSERT INTO marsx_telegram.command_audit_log'));
  assert.match(insert.sql, /ON CONFLICT \(command_id,event_key\) DO NOTHING/);
  assert.deepEqual(insert.params, [
    event.commandId, event.eventKey, event.eventKind, event.laneNumber,
    event.actorRefHash, event.metadata
  ]);

  const retryPool = fakePool({ auditDuplicate: true });
  const retryQueue = new PostgresTaskQueue({ pool: retryPool, encryptionKeyHex: 'ab'.repeat(32) });
  assert.deepEqual(await retryQueue.appendCommandAudit(event), { recorded: false });
});

test('command audit rejects unsafe lanes, identifiers and oversized metadata before SQL', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const valid = {
    commandId: 'telegram-86-task',
    eventKey: 'worker-claim-0001',
    eventKind: 'CLAIMED',
    laneNumber: 1,
    actorRefHash: 'b'.repeat(64),
    metadata: {}
  };
  await assert.rejects(queue.appendCommandAudit({ ...valid, laneNumber: 11 }), /invalid_audit_lane/);
  await assert.rejects(queue.appendCommandAudit({ ...valid, eventKey: '../bad' }), /invalid_audit_event_key/);
  await assert.rejects(
    queue.appendCommandAudit({ ...valid, metadata: { value: 'x'.repeat(17000) } }),
    /audit_metadata_too_large/
  );
  assert.equal(pool.calls.length, 0);
});


test('audit retry rejects the same event key when immutable fields differ', async () => {
  const pool = fakePool({
    auditDuplicate: true,
    auditExisting: {
      event_kind: 'FAILED',
      lane_number: 10,
      actor_ref_hash: 'a'.repeat(64),
      metadata: { worker: 'command_worker' }
    }
  });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(
    queue.appendCommandAudit({
      commandId: 'telegram-86-chat',
      eventKey: 'worker-claim-0001',
      eventKind: 'CLAIMED',
      laneNumber: 10,
      actorRefHash: 'a'.repeat(64),
      metadata: { worker: 'command_worker' }
    }),
    /audit_idempotency_conflict/
  );
  assert.ok(pool.calls.some(call => call.sql === 'ROLLBACK'));
});
