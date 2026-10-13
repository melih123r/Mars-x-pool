// Durable queue interface. This adapter is deliberately non-persistent and MUST NOT be used in production.
// It makes task execution contracts testable without claiming exactly-once delivery.
import { planFiveLaneTasks } from './lane-planner.mjs';
import { transitionTask } from './task-state.mjs';

export class InMemoryTaskQueue {
  #tasks = new Map();
  enqueue(updateId, message) {
    const tasks = planFiveLaneTasks(updateId, message);
    // Validate all identities before mutating the queue, so a repeated update is idempotent.
    if (tasks.some(task => this.#tasks.has(task.taskId))) {
      if (tasks.every(task => this.#tasks.has(task.taskId))) return { duplicate: true, tasks: this.list(updateId) };
      throw new Error('partial_update_collision');
    }
    for (const task of tasks) this.#tasks.set(task.taskId, Object.freeze(task));
    return { duplicate: false, tasks: this.list(updateId) };
  }
  list(updateId) {
    return [...this.#tasks.values()].filter(task => task.updateId === updateId);
  }
  claim(taskId, workerId, now) {
    const task = this.#tasks.get(taskId);
    if (!task) throw new Error('task_not_found');
    const updated = transitionTask(task, 'claimed', { workerId, now });
    this.#tasks.set(taskId, updated);
    return updated;
  }
  update(taskId, state, workerId, now) {
    const task = this.#tasks.get(taskId);
    if (!task) throw new Error('task_not_found');
    const updated = transitionTask(task, state, { workerId, now });
    this.#tasks.set(taskId, updated);
    return updated;
  }
  // Never expose this adapter over a public API: message plaintext is in memory.
}
