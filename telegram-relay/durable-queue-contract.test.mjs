import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTaskQueue } from './task-queue.mjs';
import { enqueueTenDurably, DurableQueueNotConfiguredError } from './durable-queue-contract.mjs';

test('in-memory queue is rejected for production delivery', async () => {
  await assert.rejects(enqueueTenDurably(new InMemoryTaskQueue(), 1, 'test'), DurableQueueNotConfiguredError);
});

test('storage without atomic claim and ack is rejected', async () => {
  await assert.rejects(enqueueTenDurably({ durable: true, enqueueAtomic: async () => ({ committed: true, taskCount: 10 }) }, 1, 'test'), DurableQueueNotConfiguredError);
});

test('storage must confirm committed ten-task transaction', async () => {
  const queue = { durable: true, enqueueAtomic: async () => ({ committed: false, taskCount: 10 }), claimAtomic() {}, ackAtomic() {} };
  await assert.rejects(enqueueTenDurably(queue, 1, 'test'), /durable_enqueue_not_confirmed/);
  queue.enqueueAtomic = async () => ({ committed: true, taskCount: 10 });
  const result = await enqueueTenDurably(queue, 1, 'test');
  assert.equal(result.taskCount, 10);
});
