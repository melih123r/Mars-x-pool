// Shared server-side Loops adapter. No real sends unless explicitly enabled.
// Does not store credentials or customer PII in logs.
const PROJECTS = new Set(["network", "finance", "telegram"]);
const EVENTS = new Set(["device_registered", "device_offline", "security_alert", "task_completed", "task_failed"]);
export function createLoopsNotifier({ apiKey, transactionalIds = {}, enabled = false, fetchImpl = fetch, timeoutMs = 6000 }) {
  async function notify({ project, event, email, data = {}, optedIn = false }) {
    if (!PROJECTS.has(project) || !EVENTS.has(event)) return { ok: false, reason: "unsupported_event" };
    if (!optedIn) return { ok: false, reason: "consent_required" };
    if (!enabled) return { ok: false, reason: "disabled" };
    if (!apiKey) return { ok: false, reason: "not_configured" };
    const transactionalId = transactionalIds[project + "." + event];
    if (typeof transactionalId !== "string" || !/^[A-Za-z0-9_-]{6,128}$/.test(transactionalId)) return { ok: false, reason: "template_not_configured" };
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, reason: "invalid_recipient" };
    if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, reason: "invalid_data" };
    // Explicitly whitelist safe template values, never send credentials, tokens, wallet or balance.
    const safeData = {};
    for (const key of ["status", "timestamp", "reference"]) {
      if (typeof data[key] === "string") safeData[key] = data[key].slice(0, 120);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl("https://app.loops.so/api/v1/transactional", {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
        body: JSON.stringify({ transactionalId, email, dataVariables: safeData })
      });
      return response.ok ? { ok: true, status: response.status } : { ok: false, status: response.status };
    } catch (error) {
      return { ok: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" };
    } finally { clearTimeout(timer); }
  }
  return { notify };
}
