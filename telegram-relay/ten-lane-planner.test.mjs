import test from 'node:test';
import assert from 'node:assert/strict';
import { TEN_LANES, planTenLaneTasks } from './ten-lane-planner.mjs';

test('ten unique immutable tasks share one intake and identical content', () => {
  const tasks = planTenLaneTasks(42, 'Inspect backend');
  assert.equal(tasks.length, 10);
  assert.equal(TEN_LANES.length, 10);
  assert.equal(new Set(tasks.map(task => task.taskId)).size, 10);
  assert.deepEqual(tasks.map(task => task.laneNumber), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.ok(tasks.every(task => task.message === 'Inspect backend' && task.updateId === 42));
  assert.ok(Object.isFrozen(tasks) && tasks.every(Object.isFrozen));
});

test('invalid input is rejected before creating tasks', () => {
  for (const updateId of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => planTenLaneTasks(updateId, 'valid'), /invalid_update_id/);
  }
  for (const message of ['', '  ', 'x'.repeat(4001)]) {
    assert.throws(() => planTenLaneTasks(1, message), /invalid_message/);
  }
});
