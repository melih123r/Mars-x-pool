import test from 'node:test';
import assert from 'node:assert/strict';
import { runAllUnconfiguredLanesOnce, runUnconfiguredLaneOnce } from './unconfigured-worker.mjs';

test('ten safe workers report not_configured without pretending to execute AI', async () => {
  const claimed = [];
  const acknowledged = [];
  const queue = {
    async claimNextTask(worker, lane) {
      claimed.push({ worker, lane });
      return { task_id: 'telegram-99-lane-' + lane };
    },
    async markTaskNotConfigured(taskId, worker) {
      acknowledged.push({ taskId, worker });
      return { task_id: taskId, status: 'not_configured' };
    }
  };
  const result = await runAllUnconfiguredLanesOnce(queue);
  assert.equal(result.length, 10);
  assert.ok(result.every(x => x.outcome === 'not_configured' && x.processed));
  assert.deepEqual(claimed.map(x => x.lane), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(acknowledged.length, 10);
});
test('idle worker does not invent an outcome', async () => {
  const queue = { claimNextTask: async () => null, markTaskNotConfigured: async () => { throw Error('unexpected'); } };
  assert.deepEqual(await runUnconfiguredLaneOnce({ queue, lane: 1, workerId: 'worker_1' }), { processed: false });
});
