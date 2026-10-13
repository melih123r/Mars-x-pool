import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTaskQueue } from './task-queue.mjs';
import { summarizeLaneResults } from './lane-planner.mjs';

test('single update creates five tasks and retry creates no extra tasks', () => {
  const queue = new InMemoryTaskQueue();
  const first = queue.enqueue(7, 'Check project');
  assert.equal(first.duplicate, false);
  assert.equal(first.tasks.length, 5);
  const second = queue.enqueue(7, 'Check project');
  assert.equal(second.duplicate, true);
  assert.equal(queue.list(7).length, 5);
});

test('each lane is independently claimable and produces a truthful summary', () => {
  const queue = new InMemoryTaskQueue();
  const tasks = queue.enqueue(8, 'Build release').tasks;
  for (const task of tasks) {
    const worker = task.taskId + '-worker';
    queue.claim(task.taskId, worker, 1000);
    queue.update(task.taskId, 'running', worker, 2000);
    queue.update(task.taskId, 'succeeded', worker, 3000);
  }
  const summary = summarizeLaneResults(queue.list(8));
  assert.equal(summary.split('\n').length, 5);
  assert.ok(summary.split('\n').every(line => line.endsWith(': succeeded')));
});

test('unknown task IDs and unauthorized worker transitions fail', () => {
  const queue = new InMemoryTaskQueue();
  assert.throws(() => queue.claim('missing', 'worker', 1000), /task_not_found/);
  const task = queue.enqueue(9, 'Test').tasks[0];
  queue.claim(task.taskId, 'worker-1', 1000);
  assert.throws(() => queue.update(task.taskId, 'running', 'worker-2', 2000), /worker_mismatch/);
});
