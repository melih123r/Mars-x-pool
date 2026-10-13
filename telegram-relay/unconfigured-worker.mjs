import { PostgresTaskQueue } from './postgres-task-queue.mjs';
import { LANES } from './lane-planner.mjs';

// Safety-first worker: no AI, financial orders, or ChatGPT session impersonation.
// Explicitly marks each lane as not configured, so Telegram receives a truthful
// terminal status rather than a fabricated success. Only run in an opt-in test.
export async function runUnconfiguredLaneOnce({ queue, lane, workerId }) {
  if (!queue || typeof queue.claimNextTask !== 'function' || typeof queue.markTaskNotConfigured !== 'function')
    throw new Error('worker_queue_required');
  const task = await queue.claimNextTask(workerId, lane);
  if (!task) return { processed: false };
  const recorded = await queue.markTaskNotConfigured(task.task_id, workerId);
  return { processed: Boolean(recorded), taskId: task.task_id, outcome: recorded ? 'not_configured' : 'lease_lost' };
}

export async function runAllUnconfiguredLanesOnce(queue) {
  const results = [];
  for (let lane = 1; lane <= LANES.length; lane++) {
    results.push(await runUnconfiguredLaneOnce({ queue, lane, workerId: 'unconfigured_lane_' + lane }));
  }
  return results;
}

// This standalone script is deliberately not auto-started by the relay.
if (process.argv[1]?.endsWith('/unconfigured-worker.mjs') && process.env.MARSX_ALLOW_UNCONFIGURED_WORKERS === 'true') {
  const queue = new PostgresTaskQueue({
    connectionString: process.env.DATABASE_URL,
    encryptionKeyHex: process.env.MARSX_MESSAGE_ENCRYPTION_KEY
  });
  try { console.log(JSON.stringify(await runAllUnconfiguredLanesOnce(queue))); }
  finally { await queue.close(); }
}
