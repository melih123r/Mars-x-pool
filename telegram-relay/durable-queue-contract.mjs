// Durable task storage contract: production adapters must guarantee atomic uniqueness.
// InMemoryTaskQueue is only for local tests and never satisfies this interface in production.
export class DurableQueueNotConfiguredError extends Error {
  constructor() { super('durable_queue_not_configured'); this.name = 'DurableQueueNotConfiguredError'; }
}

export function requireDurableQueue(queue) {
  if (!queue || queue.durable !== true ||
      typeof queue.enqueueAtomic !== 'function' ||
      typeof queue.claimAtomic !== 'function' ||
      typeof queue.ackAtomic !== 'function') {
    throw new DurableQueueNotConfiguredError();
  }
  return queue;
}

// Storage implementers MUST enforce:
// UNIQUE(update_id, lane), UNIQUE(task_id), durable encrypted message payload,
// transactional enqueue of all five tasks, worker lease CAS, and idempotent completion.
// Acknowledging Telegram before the durable transaction commits is forbidden.
export async function enqueueFiveDurably(queue, updateId, message) {
  const storage = requireDurableQueue(queue);
  const { planFiveLaneTasks } = await import('./lane-planner.mjs');
  const tasks = planFiveLaneTasks(updateId, message);
  const result = await storage.enqueueAtomic({ updateId, tasks });
  if (!result || result.committed !== true || result.taskCount !== 5)
    throw new Error('durable_enqueue_not_confirmed');
  return result;
}
