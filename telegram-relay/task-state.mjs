// Pure worker state transitions; persistence and authentication must be supplied by a real queue.
const TERMINAL = new Set(['succeeded', 'failed', 'not_configured']);
const ACTIVE = new Set(['queued', 'claimed', 'running']);
const ALLOWED = Object.freeze({
  queued: ['claimed', 'not_configured'],
  claimed: ['running', 'queued', 'failed'],
  running: ['succeeded', 'failed', 'queued'],
  succeeded: [],
  failed: [],
  not_configured: []
});

export function transitionTask(task, nextState, { workerId, now, leaseMs = 60000 } = {}) {
  if (!task || typeof task !== 'object' || !ALLOWED[task.state])
    throw new TypeError('invalid_task');
  if (!ALLOWED[task.state].includes(nextState))
    throw new Error('invalid_transition');
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('invalid_time');
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000)
    throw new TypeError('invalid_lease');
  if (['claimed', 'running', 'succeeded', 'failed'].includes(nextState)) {
    if (typeof workerId !== 'string' || !workerId.trim()) throw new TypeError('worker_required');
  }
  if (task.state === 'claimed' || task.state === 'running') {
    if (task.workerId !== workerId) throw new Error('worker_mismatch');
    if (task.leaseUntil <= now && nextState !== 'queued') throw new Error('lease_expired');
  }
  const next = { ...task, state: nextState, updatedAt: now };
  if (nextState === 'claimed' || nextState === 'running') {
    next.workerId = workerId;
    next.leaseUntil = now + leaseMs;
  } else {
    delete next.leaseUntil;
    if (nextState === 'queued') delete next.workerId;
  }
  return Object.freeze(next);
}

export function isTerminal(task) {
  return Boolean(task && TERMINAL.has(task.state));
}

export function needsLeaseRecovery(task, now) {
  return Boolean(task && ACTIVE.has(task.state) && task.state !== 'queued' &&
    Number.isSafeInteger(now) && now >= task.leaseUntil);
}
