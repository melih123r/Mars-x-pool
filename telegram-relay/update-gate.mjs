export function createUpdateGate({ maxRecent = 1000 } = {}) {
  if (!Number.isSafeInteger(maxRecent) || maxRecent < 1) throw new TypeError('invalid_recent_limit');
  const recent = new Set();
  const processing = new Set();
  return Object.freeze({
    begin(updateId) {
      if (!Number.isSafeInteger(updateId) || updateId < 0) return 'invalid';
      if (recent.has(updateId)) return 'duplicate';
      if (processing.has(updateId)) return 'processing';
      processing.add(updateId);
      return 'accepted';
    },
    finish(updateId, succeeded) {
      processing.delete(updateId);
      if (!succeeded) return;
      recent.add(updateId);
      if (recent.size > maxRecent) recent.delete(recent.values().next().value);
    }
  });
}
