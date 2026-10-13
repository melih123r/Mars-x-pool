import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTaskQueue } from './task-queue.mjs';
import { enqueueFiveDurably, DurableQueueNotConfiguredError } from './durable-queue-contract.mjs';

test('in-memory queue is rejected for production delivery', async () => {
  await assert.rejects(enqueueFiveDurably(new InMemoryTaskQueue(), 1, 'test'), DurableQueueNotConfiguredError);
});

test('storage without atomic claim and ack is rejected', async () => {
  await assert.rejects(enqueueFiveDurably({ durable: true, enqueueAtomic: async () => ({ committed: true, taskCount: 5 }) }, 1, 'test'), DurableQueueNotConfiguredError);
});

test('storage must confirm committed five-task transaction', async () => {
  const queue = { durable: true, enqueueAtomic: async () => ({ committed: false, taskCount: 5 }), claimAtomic() {}, ackAtomic() {} };
  await assert.rejects(enqueueFiveDurably(queue, 1, 'test'), /durable_enqueue_not_confirmed/);
  queue.enqueueAtomic = async () => ({ committed: true, taskCount: 5 });
  const result = await enqueueFiveDurably(queue, 1, 'test');
  assert.equal(result.taskCount, 5);
});
