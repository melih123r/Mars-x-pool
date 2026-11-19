/**
 * MARS-X peer SDK auto-provisioning for individually authorised devices.
 *
 * This is NOT a shared farmer-key vending endpoint. It issues ONLY a
 * provider-created, revocable, PER-DEVICE SDK key assigned by the operator.
 * The provider's account/master key is never read or returned here.
 *
 * Operator-managed Supabase Edge Secret MARSX_PROXIES_DEVICE_KEYS_JSON:
 * {"node-<install UUID>":{"user_id":"usr_<MARS-X user id>",
 *  "sdk_key":"psx_<individual vendor SDK device key>","enabled":true}}
 *
 * User signs into their MARS-X account, not Proxies.sx. Their app requests its
 * device's credential only AFTER explicit, revocable, in-app consent.
 * The admin must configure one unique vendor key per approved install.
 * Missing/unapproved configuration always FAILS CLOSED without fake status.
 */
const AUTH_ME =
  "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api/auth/me";
const RET = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "access-control-allow-origin": "https://marsx.invalid",
};
function answer(status: number, state: string, error?: string,
  extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ schema_version: 1, status: state,
    ...(error ? { error } : {}), ...extra }), { status, headers: RET });
}
const installPattern = /^node-[0-9a-f]{32}$/i;
const userPattern = /^usr_[0-9a-f]{32}$/i;
const keyPattern = /^psx_[A-Za-z0-9]{20,160}$/;
type Assignment = { user_id: string; sdk_key: string; enabled: boolean };
function getAssignment(installId: string): Assignment | null {
  const raw = Deno.env.get("MARSX_PROXIES_DEVICE_KEYS_JSON");
  if (!raw || raw.length > 100000) return null;
  const all = JSON.parse(raw);
  if (!all || typeof all !== "object" || Array.isArray(all)) return null;
  const entry = Object.prototype.hasOwnProperty.call(all, installId)
    ? all[installId] : null;
  if (!entry || typeof entry !== "object" || entry.enabled !== true
    || !userPattern.test(entry.user_id) || !keyPattern.test(entry.sdk_key)) return null;
  // Never allow a vendor SDK key to be silently shared by two devices.
  for (const [otherId, other] of Object.entries(all)) {
    if (otherId !== installId && typeof other === "object" && other !== null
      && (other as Assignment).sdk_key === entry.sdk_key) return null;
  }
  return entry as Assignment;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ schema_version: 1,
      status: "error", error: "method_not_allowed" }), {
      status: 405, headers: { ...RET, allow: "POST" },
    });
  }
  const token = req.headers.get("authorization") ?? "";
  const installId = req.headers.get("x-install-id") ?? "";
  if (!/^Bearer [A-Za-z0-9._~+/\\-]{24,512}$/.test(token)
      || !installPattern.test(installId)) {
    return answer(401, "unauthorized", "marsx_login_required");
  }
  let body: Record<string, unknown>;
  try {
    if (Number(req.headers.get("content-length") ?? "0") > 2048) {
      return answer(413, "error", "request_too_large");
    }
    const input = await req.text();
    if (input.length > 2048) return answer(413, "error", "request_too_large");
    body = JSON.parse(input);
    if (!body || body.consent !== true || body.proxies_notice !== true
        || body.action !== "provision_for_explicit_start") {
      return answer(403, "consent_required", "explicit_consent_required");
    }
  } catch {
    return answer(400, "error", "invalid_request");
  }

  try {
    const authenticated = await fetch(AUTH_ME, {
      method: "GET",
      redirect: "error",
      headers: { "Authorization": token, "X-Install-Id": installId,
        "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (authenticated.status === 401 || authenticated.status === 403) {
      return answer(401, "unauthorized", "marsx_login_required");
    }
    if (!authenticated.ok) return answer(503, "unavailable", "identity_server_unavailable");
    const raw = await authenticated.text();
    if (raw.length > 8192) return answer(503, "unavailable", "invalid_identity_response");
    const profile = JSON.parse(raw);
    const userId = profile?.user?.user_id;
    if (profile?.ok !== true || typeof userId !== "string" ||
        !userPattern.test(userId)) return answer(401, "unauthorized", "marsx_login_required");
    const assignment = getAssignment(installId);
    if (!assignment || assignment.user_id !== userId) {
      return answer(503, "awaiting_provisioning", "device_not_assigned");
    }
    return answer(200, "ready", undefined, {
      scope: "single_device",
      device_binding: installId,
      sdk_device_key: assignment.sdk_key,
      sharing_started: false,
      // No master key, refresh token, farmer account ID or earnings.
    });
  } catch {
    return answer(503, "unavailable", "provisioning_unavailable");
  }
});
