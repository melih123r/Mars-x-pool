// Opt-in MARS-X Network telemetry bridge. Node >=22; no external dependencies.
// This is not a proxy, bandwidth-sharing SDK, rewards engine, or payout service.
const ALLOWED_PATHS = new Set(["/register", "/heartbeat"]);
export function createNetworkBridge({ apiBase, getSession, hasConsent, fetchImpl = fetch, onEvent = async () => {}, timeoutMs = 8000 }) {
  const origin = new URL(apiBase);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error("HTTPS API required");
  if (typeof getSession !== "function" || typeof hasConsent !== "function") throw new TypeError("session and consent callbacks required");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new RangeError("timeoutMs must be 100..60000");
  const base = origin.href.replace(/\/$/, "");
  async function send(path, worker) {
    if (!ALLOWED_PATHS.has(path)) return { ok: false, reason: "invalid_path" };
    // Read once: hostile getters/proxies must not throw or mutate the identifier between validation and serialization.
    let workerId;
    try { workerId = worker && typeof worker === "object" && !Array.isArray(worker) ? worker.workerId : undefined; }
    catch { return { ok: false, reason: "invalid_worker" }; }
    if (typeof workerId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(workerId)) return { ok: false, reason: "invalid_worker" };
    // Treat failed consent/session callbacks as denial; never attempt a request.
    let consent;
    try { consent = await hasConsent(); } catch { return { ok: false, reason: "consent_required" }; }
    if (consent !== true) return { ok: false, reason: "consent_required" };
    let session;
    try { session = await getSession(); } catch { return { ok: false, reason: "license_required" }; }
    // Snapshot untrusted session properties once. Getters/proxies can throw or change values.
    let token, installId;
    try { token = session?.token; installId = session?.installId; }
    catch { return { ok: false, reason: "license_required" }; }
    if (typeof token !== "string" || !/^[A-Za-z0-9._~+\/-]{1,512}$/.test(token) ||
        typeof installId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(installId))
      return { ok: false, reason: "license_required" };
    try { consent = await hasConsent(); } catch { return { ok: false, reason: "consent_required" }; }
    if (consent !== true) return { ok: false, reason: "consent_required" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(base + path, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: "License " + token,
          "x-install-id": installId
        },
        body: JSON.stringify({ workerId })
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
