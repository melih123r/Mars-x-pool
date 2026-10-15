import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresTaskQueue } from './postgres-task-queue.mjs';

function fakePool({ duplicate = false, existing } = {}) {
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
