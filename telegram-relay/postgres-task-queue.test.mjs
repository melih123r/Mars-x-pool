import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresTaskQueue } from './postgres-task-queue.mjs';
import { planFiveLaneTasks } from './lane-planner.mjs';

function fakePool({ duplicate = false, failAt = -1 } = {}) {
  const calls = [];
  let count = 0;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      count++;
      if (count === failAt) throw new Error('database_failure');
      if (sql.startsWith('INSERT INTO marsx_telegram.intakes')) return { rowCount: duplicate ? 0 : 1 };
      if (sql.startsWith('SELECT count(*)')) return { rows: [{ count: 5 }] };
      if (sql.startsWith('UPDATE marsx_telegram.tasks')) return { rows: [{ task_id: params[0], status: 'claimed' }] };
      return { rowCount: 1 };
    },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  return { calls, async connect() { return client; }, async query(...args) { return client.query(...args); }, async end() {} };
}
test('five tasks and encrypted intake are written in one transaction', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.enqueueAtomic({ updateId: 9, tasks: planFiveLaneTasks(9, 'Sensitive Türkçe 🚀') });
  assert.deepEqual(result, { committed: true, taskCount: 5, duplicate: false });
  assert.equal(pool.calls.filter(x => x.sql.startsWith('INSERT INTO marsx_telegram.tasks')).length, 5);
  assert.equal(pool.calls.filter(x => x.sql === 'COMMIT').length, 1);
  const payload = pool.calls.find(x => x.sql.startsWith('INSERT INTO marsx_telegram.intakes')).params[1];
  assert.ok(Buffer.isBuffer(payload));
  assert.ok(!payload.includes(Buffer.from('Sensitive')));
});
test('duplicate update cannot enqueue another five tasks', async () => {
  const pool = fakePool({ duplicate: true });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.enqueueAtomic({ updateId: 9, tasks: planFiveLaneTasks(9, 'task') });
  assert.equal(result.duplicate, true);
  assert.equal(pool.calls.filter(x => x.sql.startsWith('INSERT INTO marsx_telegram.tasks')).length, 0);
});
test('database error triggers rollback and never commits', async () => {
  const pool = fakePool({ failAt: 3 });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(queue.enqueueAtomic({ updateId: 9, tasks: planFiveLaneTasks(9, 'task') }), /database_failure/);
  assert.ok(pool.calls.some(x => x.sql === 'ROLLBACK'));
  assert.ok(!pool.calls.some(x => x.sql === 'COMMIT'));
});
test('worker claims and acknowledgements require validated IDs', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  assert.ok(await queue.claimAtomic('telegram-9-lane-1', 'worker_1'));
  assert.ok(await queue.ackAtomic('telegram-9-lane-1', 'worker_1', 'succeeded'));
  await assert.rejects(queue.claimAtomic('bad', 'worker_1'), /invalid_task_id/);
  await assert.rejects(queue.ackAtomic('telegram-9-lane-1', 'worker_1', 'queued'), /invalid_outcome/);
});

test('expired worker leases are atomically recovered', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await queue.recoverExpired(25);
  const sql = pool.calls.find(x => x.sql.includes('FOR UPDATE SKIP LOCKED'));
  assert.ok(sql);
  assert.deepEqual(sql.params, [25]);
  await assert.rejects(queue.recoverExpired(0), /invalid_limit/);
});

test('encrypted message retrieval rejects unknown encryption versions', async () => {
  const pool = fakePool();
  pool.query = async () => ({ rows: [{ payload_ciphertext: Buffer.from('x'), encryption_key_version: 99 }] });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(queue.getEncryptedMessage(1), /unsupported_key_version/);
  await assert.rejects(queue.getEncryptedMessage(-1), /invalid_update_id/);
});

test('completion event is recorded only after all five lanes finish', async () => {
  const pool = fakePool();
  const query = pool.connect;
  pool.connect = async () => {
    const client = await query();
    const original = client.query;
    client.query = async (sql, params) => {
      if (sql.startsWith('SELECT lane,status')) return { rows: [1,2,3,4,5].map(lane => ({ lane, status: 'succeeded' })) };
      if (sql.startsWith('INSERT INTO marsx_telegram.outbox')) return { rowCount: 1 };
      return original(sql, params);
    };
    return client;
  };
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  assert.deepEqual(await queue.recordCompletionEvent(9), { ready: true, eventKind: 'completed', newlyRecorded: true });
});

test('incomplete task sets never create a completion event', async () => {
  const pool = fakePool();
  const connect = pool.connect;
  pool.connect = async () => {
    const client = await connect();
    const original = client.query;
    client.query = async (sql, params) => sql.startsWith('SELECT lane,status')
      ? { rows: [{ lane: 1, status: 'succeeded' }] }
      : original(sql, params);
    return client;
  };
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  assert.deepEqual(await queue.recordCompletionEvent(9), { ready: false });
  assert.ok(!pool.calls.some(x => x.sql.startsWith('INSERT INTO marsx_telegram.outbox')));
});
