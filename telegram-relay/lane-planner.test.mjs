import test from 'node:test';
import assert from 'node:assert/strict';
import * as planner from './lane-planner.mjs';

const { LANES, planLaneTasks, summarizeLaneResults } = planner;

test('one message deterministically produces exactly ten distinct lane tasks', () => {
  const tasks = planLaneTasks(100, 'Build a safe release');
  assert.equal(tasks.length, 10);
  assert.deepEqual(tasks.map(task => task.lane), LANES);
  assert.equal(new Set(tasks.map(task => task.taskId)).size, 10);
  assert.deepEqual(tasks, planLaneTasks(100, 'Build a safe release'));
  assert.ok(tasks.every(task => task.state === 'queued'));
});

test('different Telegram updates cannot reuse task identifiers', () => {
  const first = planLaneTasks(100, 'A');
  const second = planLaneTasks(101, 'A');
  assert.ok(first.every((task, i) => task.taskId !== second[i].taskId));
});

test('invalid inputs are rejected before planning', () => {
  for (const updateId of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => planLaneTasks(updateId, 'task'));
  }
  for (const message of ['', ' ', 'x'.repeat(4001), null]) {
    assert.throws(() => planLaneTasks(1, message));
  }
});

test('lane-specific completion summary is truthful', () => {
  const tasks = planLaneTasks(42, 'task').map((task, i) => ({ ...task, state: i === 0 ? 'succeeded' : 'not_configured' }));
  const summary = summarizeLaneResults(tasks);
  assert.match(summary, /Android: succeeded/);
  assert.match(summary, /Entegrasyon ve son QA: not_configured/);
  assert.throws(() => summarizeLaneResults([...tasks.slice(0, 9), tasks[0]]));
  assert.throws(() => summarizeLaneResults(tasks.slice(0, 9)));
});

test('one Gemini call classifies across ten areas and returns a short Turkish advisory answer', async () => {
  assert.equal(typeof planner.answerWithGemini, 'function');
  const calls = [];
  const result = await planner.answerWithGemini('APK neden derlenmiyor?', async prompt => {
    calls.push(prompt);
    return 'Alan: Android\nYanıt: Gradle hata kaydını kontrol et ve başarısız görevi yeniden çalıştır.';
  });

  assert.equal(calls.length, 1);
  for (const lane of LANES) assert.match(calls[0], new RegExp(lane.replace('/', '\\/')));
  assert.match(calls[0], /yalnızca tavsiye veya analiz/i);
  assert.match(calls[0], /gerçek bir işlem yaptığını iddia etme/i);
  assert.deepEqual(result, {
    lane: 'Android',
    answer: 'Gradle hata kaydını kontrol et ve başarısız görevi yeniden çalıştır.'
  });
});
