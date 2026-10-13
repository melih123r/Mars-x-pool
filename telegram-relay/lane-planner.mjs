// Pure task planner. It does not send messages or execute ChatGPT sessions.
// A production dispatcher must persist these records atomically before acknowledging intake.
export const LANES = Object.freeze([
  'Android', 'Grafik ve UI', 'Backend ve API', 'Finance ve Exchange', 'QA ve Test'
]);
export const TASK_STATES = Object.freeze([
  'queued', 'claimed', 'running', 'succeeded', 'failed', 'not_configured'
]);
const MAX_MESSAGE_LENGTH = 4000;

export function planFiveLaneTasks(updateId, message) {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('invalid_update_id');
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH)
    throw new TypeError('invalid_message');
  return LANES.map((lane, index) => Object.freeze({
    taskId: `telegram-${updateId}-lane-${index + 1}`,
    updateId,
    lane,
    state: 'queued',
    // Never log or publish message to public GitHub issues.
    message
  }));
}

export function summarizeLaneResults(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== LANES.length) throw new TypeError('five_tasks_required');
  const ids = new Set();
  const lanes = new Set();
  for (const task of tasks) {
    if (!task || !TASK_STATES.includes(task.state) || !LANES.includes(task.lane))
      throw new TypeError('invalid_task');
    if (ids.has(task.taskId) || lanes.has(task.lane)) throw new TypeError('duplicate_task');
    ids.add(task.taskId);
    lanes.add(task.lane);
  }
  if (lanes.size !== LANES.length) throw new TypeError('missing_lane');
  return tasks.map(task => `${task.lane}: ${task.state}`).join('\n');
}
