import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionTask, isTerminal, needsLeaseRecovery } from './task-state.mjs';

const base = { taskId: 'telegram-10-lane-1', state: 'queued' };
test('worker can claim, run and complete one task', () => {
  const claimed = transitionTask(base, 'claimed', { workerId: 'worker-1', now: 1000 });
  assert.equal(claimed.leaseUntil, 61000);
  const running = transitionTask(claimed, 'running', { workerId: 'worker-1', now: 2000 });
  const done = transitionTask(running, 'succeeded', { workerId: 'worker-1', now: 3000 });
  assert.equal(isTerminal(done), true);
  assert.throws(() => transitionTask(done, 'running', { workerId: 'worker-1', now: 4000 }));
});

test('workers cannot hijack each other tasks', () => {
  const claimed = transitionTask(base, 'claimed', { workerId: 'worker-1', now: 1000 });
  assert.throws(() => transitionTask(claimed, 'running', { workerId: 'worker-2', now: 2000 }), /worker_mismatch/);
});

test('expired leases must be recovered before running', () => {
  const claimed = transitionTask(base, 'claimed', { workerId: 'worker-1', now: 1000, leaseMs: 1000 });
  assert.equal(needsLeaseRecovery(claimed, 2000), true);
  assert.throws(() => transitionTask(claimed, 'running', { workerId: 'worker-1', now: 2000 }), /lease_expired/);
  const queued = transitionTask(claimed, 'queued', { workerId: 'worker-1', now: 2000 });
  assert.equal(queued.workerId, undefined);
});

test('invalid state and missing worker are rejected', () => {
  assert.throws(() => transitionTask(base, 'succeeded', { workerId: 'worker-1', now: 1000 }));
  assert.throws(() => transitionTask(base, 'claimed', { now: 1000 }));
  assert.throws(() => transitionTask(base, 'claimed', { workerId: 'worker-1', now: -1 }));
});
