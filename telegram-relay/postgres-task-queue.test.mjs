import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresTaskQueue } from './postgres-task-queue.mjs';
import { planLaneTasks } from './lane-planner.mjs';

function fakePool({ duplicate = false, failAt = -1 } = {}) {
  const calls = [];
  let count = 0;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      count++;
      if (count === failAt) throw new Error('database_failure');
      if (sql.startsWith('INSERT INTO marsx_telegram.intakes')) return { rowCount: duplicate ? 0 : 1 };
      if (sql.startsWith('SELECT count(*)')) return { rows: [{ count: 10 }] };
      if (sql.startsWith('SELECT update_id FROM marsx_telegram.tasks WHERE task_id=')) return { rows: [{ update_id: 9 }] };
      if (sql.includes('WITH expired AS')) return { rows: [] };
      if (sql.includes('WITH available AS')) return { rows: [{ task_id: 'telegram-9-lane-1', update_id: 9, status: 'claimed' }] };
      if (sql.startsWith('UPDATE marsx_telegram.tasks')) return { rows: [{ task_id: params[0], update_id: 9, status: 'claimed' }] };
      if (sql.startsWith('SELECT status FROM marsx_telegram.tasks')) return { rows: [{ status: 'queued' }] };
      return { rowCount: 1 };
    },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  return { calls, async connect() { return client; }, async query(...args) { return client.query(...args); }, async end() {} };
}
test('ten tasks and encrypted intake are written in one transaction', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.enqueueAtomic({ updateId: 9, tasks: planLaneTasks(9, 'Sensitive Türkçe 🚀') });
  assert.deepEqual(result, { committed: true, taskCount: 10, duplicate: false });
  assert.equal(pool.calls.filter(x => x.sql.startsWith('INSERT INTO marsx_telegram.tasks')).length, 10);
  assert.equal(pool.calls.filter(x => x.sql === 'COMMIT').length, 1);
  const payload = pool.calls.find(x => x.sql.startsWith('INSERT INTO marsx_telegram.intakes')).params[1];
  assert.ok(Buffer.isBuffer(payload));
  assert.ok(!payload.includes(Buffer.from('Sensitive')));
});
test('duplicate update cannot enqueue another ten tasks', async () => {
  const pool = fakePool({ duplicate: true });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const result = await queue.enqueueAtomic({ updateId: 9, tasks: planLaneTasks(9, 'task') });
  assert.equal(result.duplicate, true);
  assert.equal(pool.calls.filter(x => x.sql.startsWith('INSERT INTO marsx_telegram.tasks')).length, 0);
});
test('database error triggers rollback and never commits', async () => {
  const pool = fakePool({ failAt: 3 });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(queue.enqueueAtomic({ updateId: 9, tasks: planLaneTasks(9, 'task') }), /database_failure/);
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
  assert.ok(pool.calls.some(x => x.sql === 'BEGIN'));
  assert.ok(pool.calls.some(x => x.sql === 'COMMIT'));
  assert.ok(pool.calls.some(x => x.sql === 'RELEASE'));
  await assert.rejects(queue.recoverExpired(0), /invalid_limit/);
});

test('encrypted message retrieval rejects unknown encryption versions', async () => {
  const pool = fakePool();
  pool.query = async () => ({ rows: [{ payload_ciphertext: Buffer.from('x'), encryption_key_version: 99 }] });
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await assert.rejects(queue.getEncryptedMessage(1), /unsupported_key_version/);
  await assert.rejects(queue.getEncryptedMessage(-1), /invalid_update_id/);
});

test('completion event is recorded only after all ten lanes finish', async () => {
  const pool = fakePool();
  const query = pool.connect;
  pool.connect = async () => {
    const client = await query();
    const original = client.query;
    client.query = async (sql, params) => {
      if (sql.startsWith('SELECT lane,status')) return { rows: [1,2,3,4,5,6,7,8,9,10].map(lane => ({ lane, status: 'succeeded' })) };
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

test('outbox claim uses SKIP LOCKED and returns unique lease token', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const claimed = await queue.claimOutbox(5, 90);
  assert.match(claimed.token, /^[0-9a-f-]{36}$/i);
  assert.ok(pool.calls.some(x => x.sql.includes('FOR UPDATE SKIP LOCKED')));
  await assert.rejects(queue.claimOutbox(0, 90), /invalid_limit/);
  await assert.rejects(queue.claimOutbox(5, 1), /invalid_lease/);
});

test('outbox acknowledgement requires matching claim token and active lease', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const token = '11111111-1111-4111-8111-111111111111';
  await queue.markClaimedOutboxDelivered(1, token);
  assert.ok(pool.calls.some(x => x.sql.includes('claim_token=$2::uuid AND claim_until > now()')));
  await assert.rejects(queue.markClaimedOutboxDelivered(1, 'bad'), /invalid_claim_token/);
});

test('last worker acknowledgement creates outbox event inside same transaction', async () => {
  const pool = fakePool();
  const originalConnect = pool.connect;
  pool.connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query;
    client.query = async (sql, params) => {
      if (sql.startsWith('SELECT status FROM marsx_telegram.tasks'))
        return { rows: Array.from({ length: 10 }, () => ({ status: 'succeeded' })) };
      return originalQuery(sql, params);
    };
    return client;
  };
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await queue.ackAtomic('telegram-9-lane-5', 'worker_5', 'succeeded');
  assert.ok(pool.calls.some(x => x.sql.startsWith('INSERT INTO marsx_telegram.outbox')));
  assert.ok(pool.calls.some(x => x.sql === 'COMMIT'));
});

test('worker polls only its assigned lane using atomic SKIP LOCKED', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const task = await queue.claimNextTask('android_worker', 1);
  assert.ok(task);
  const claim = pool.calls.find(x => x.sql.includes("WHERE lane=$2 AND status='queued'"));
  assert.ok(claim);
  assert.match(claim.sql, /FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(claim.params, ['android_worker', 1, 90]);
  await assert.rejects(queue.claimNextTask('worker', 11), /invalid_lane/);
  await assert.rejects(queue.claimNextTask('bad worker', 1), /invalid_worker_id/);
});

test('legitimate worker task ID can be marked not configured', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  assert.ok(await queue.markTaskNotConfigured('telegram-9-lane-1', 'worker_1'));
  assert.ok(pool.calls.some(x => x.sql.includes("status='not_configured'")));
  await assert.rejects(queue.markTaskNotConfigured('telegram-x-lane-1', 'worker_1'), /invalid_task_id/);
});

test('expired last-attempt worker generates failed outbox report', async () => {
  const pool = fakePool();
  const connect = pool.connect;
  pool.connect = async () => {
    const client = await connect();
    const original = client.query;
    client.query = async (sql, params) => {
      if (sql.includes('WITH expired AS')) {
        pool.calls.push({ sql, params });
        return { rows: [{ task_id: 'telegram-9-lane-5', update_id: 9, status: 'failed' }] };
      }
      if (sql.startsWith('SELECT status FROM marsx_telegram.tasks'))
        return { rows: ['succeeded','succeeded','succeeded','succeeded','succeeded','succeeded','succeeded','succeeded','succeeded','failed'].map(status => ({ status })) };
      return original(sql, params);
    };
    return client;
  };
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  await queue.recoverExpired();
  assert.ok(pool.calls.some(x => x.sql.includes("VALUES ($1,'failed')")));
  assert.ok(pool.calls.some(x => x.sql === 'COMMIT'));
});

test('malformed or oversized intake cannot write anything to database', async () => {
  const pool = fakePool();
  const queue = new PostgresTaskQueue({ pool, encryptionKeyHex: 'ab'.repeat(32) });
  const oversized = planLaneTasks(9, 'valid').map(task => ({ ...task, message: 'x'.repeat(4001) }));
  await assert.rejects(queue.enqueueAtomic({ updateId: 9, tasks: oversized }), /invalid_message/);
  const tampered = [...planLaneTasks(9, 'hello')];
  tampered[3] = { ...tampered[3], updateId: 10 };
  await assert.rejects(queue.enqueueAtomic({ updateId: 9, tasks: tampered }), /task_plan_mismatch/);
  assert.equal(pool.calls.length, 0);
});
