// Opt-in MARS-X Network telemetry bridge. Node >=22; no external dependencies.
// This is not a proxy, bandwidth-sharing SDK, rewards engine, or payout service.
const ALLOWED_PATHS = new Set(["/register", "/heartbeat"]);
export function createNetworkBridge({ apiBase, getSession, hasConsent, fetchImpl = fetch, onEvent = async () => {}, timeoutMs = 8000 }) {
  const origin = new URL(apiBase);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) throw new Error("HTTPS API required");
  if (typeof getSession !== "function" || typeof hasConsent !== "function") throw new TypeError("session and consent callbacks required");
  const base = origin.href.replace(/\/$/, "");
  async function send(path, worker) {
    if (!ALLOWED_PATHS.has(path)) return { ok: false, reason: "invalid_path" };
    if (!hasConsent()) return { ok: false, reason: "consent_required" };
    const session = await getSession();
    if (!session?.token || !session?.installId) return { ok: false, reason: "license_required" };
    if (!hasConsent()) return { ok: false, reason: "consent_required" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(base + path, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: "License " + session.token,
          "x-install-id": session.installId
        },
        body: JSON.stringify(worker)
      });
      if (!response.ok) return { ok: false, status: response.status };
      // Best effort; notification failures must not turn successful registration into failure.
      try { await onEvent({ type: path === "/heartbeat" ? "node_heartbeat" : "node_registered" }); } catch {}
      return { ok: true, status: response.status };
    } catch (error) {
      return { ok: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" };
    } finally { clearTimeout(timer); }
  }
  return { register: worker => send("/register", worker), heartbeat: worker => send("/heartbeat", worker) };
}
