// Shared server-side Loops adapter. No real sends unless explicitly enabled.
// Does not store credentials or customer PII in logs.
const PROJECTS = new Set(["network", "finance", "telegram"]);
const EVENTS = new Set(["device_registered", "device_offline", "security_alert", "task_completed", "task_failed"]);
export function createLoopsNotifier({ apiKey, transactionalIds = {}, enabled = false, fetchImpl = fetch, timeoutMs = 6000, maxAttempts = 3, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  async function notify({ project, event, email, data = {}, optedIn = false, idempotencyKey }) {
    if (!PROJECTS.has(project) || !EVENTS.has(event)) return { ok: false, reason: "unsupported_event" };
    if (!optedIn) return { ok: false, reason: "consent_required" };
    if (!enabled) return { ok: false, reason: "disabled" };
    if (!apiKey) return { ok: false, reason: "not_configured" };
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{8,100}$/.test(idempotencyKey)) return { ok: false, reason: "idempotency_key_required" };
    const transactionalId = transactionalIds[project + "." + event];
    if (typeof transactionalId !== "string" || !/^[A-Za-z0-9_-]{6,128}$/.test(transactionalId)) return { ok: false, reason: "template_not_configured" };
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, reason: "invalid_recipient" };
    if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, reason: "invalid_data" };
    // Explicitly whitelist safe template values, never send credentials, tokens, wallet or balance.
    const safeData = {};
    for (const key of ["status", "timestamp", "reference"]) {
      if (typeof data[key] === "string") safeData[key] = data[key].slice(0, 120);
    }
    // Persist idempotencyKey with the business event and reuse on every attempt.
    const attempts = Math.max(1, Math.min(3, Number.isInteger(maxAttempts) ? maxAttempts : 3));
    const body = JSON.stringify({ transactionalId, email, dataVariables: safeData, addToAudience: false });
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl("https://app.loops.so/api/v1/transactional", {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { authorization: "Bearer " + apiKey, "content-type": "application/json", "Idempotency-Key": idempotencyKey },
          body
        });
        if (response.ok) return { ok: true, status: response.status };
        if (response.status === 409) return { ok: false, status: 409, reason: "duplicate_or_conflict_reconcile" };
        if (response.status !== 429 && response.status < 500) return { ok: false, status: response.status };
        if (attempt === attempts - 1) return { ok: false, status: response.status, reason: "retry_exhausted" };
      } catch (error) {
        // A timeout can occur after Loops accepted the email; preserve the same key.
        if (attempt === attempts - 1) return { ok: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" };
      } finally { clearTimeout(timer); }
      await sleep(500 * 2 ** attempt);
    }
    return { ok: false, reason: "retry_exhausted" };
  }
  return { notify };
}
