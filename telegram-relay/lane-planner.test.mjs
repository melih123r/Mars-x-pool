import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, planFiveLaneTasks, summarizeLaneResults } from './lane-planner.mjs';

test('one message deterministically produces exactly five distinct lane tasks', () => {
  const tasks = planFiveLaneTasks(100, 'Build a safe release');
  assert.equal(tasks.length, 5);
  assert.deepEqual(tasks.map(task => task.lane), LANES);
  assert.equal(new Set(tasks.map(task => task.taskId)).size, 5);
  assert.deepEqual(tasks, planFiveLaneTasks(100, 'Build a safe release'));
  assert.ok(tasks.every(task => task.state === 'queued'));
});

test('different Telegram updates cannot reuse task identifiers', () => {
  const first = planFiveLaneTasks(100, 'A');
  const second = planFiveLaneTasks(101, 'A');
  assert.ok(first.every((task, i) => task.taskId !== second[i].taskId));
});

test('invalid inputs are rejected before planning', () => {
  for (const updateId of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => planFiveLaneTasks(updateId, 'task'));
  }
  for (const message of ['', ' ', 'x'.repeat(4001), null]) {
    assert.throws(() => planFiveLaneTasks(1, message));
  }
});

test('lane-specific completion summary is truthful', () => {
  const tasks = planFiveLaneTasks(42, 'task').map((task, i) => ({ ...task, state: i === 0 ? 'succeeded' : 'not_configured' }));
  const summary = summarizeLaneResults(tasks);
  assert.match(summary, /Android: succeeded/);
  assert.match(summary, /QA ve Test: not_configured/);
  assert.throws(() => summarizeLaneResults([...tasks.slice(0, 4), tasks[0]]));
  assert.throws(() => summarizeLaneResults(tasks.slice(0, 4)));
});
