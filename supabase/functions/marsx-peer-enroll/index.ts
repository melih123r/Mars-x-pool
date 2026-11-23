/**
 * Operator-only Proxies.sx device enrollment and status endpoint.
 * The farmer API key is consumed server-side and is never returned to Android.
 */
const DEVICES_URL = "https://api.proxies.sx/v1/peer/my-devices";
const AUTH_URL =
  "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api/auth/me";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function reply(payload: Record<string, unknown>, status: number, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}
function validSession(value: string) {
  return /^Bearer [A-Za-z0-9._~+\/-]{24,512}$/.test(value);
}
function validInstall(value: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(value);
}
function validDevice(value: unknown): value is string {
  return typeof value === "string" && /^(?:psx_|agent_)[A-Za-z0-9_-]{8,64}$/.test(value);
}
async function authorize(request: Request) {
  const bearer = request.headers.get("authorization") ?? "";
  const installId = request.headers.get("x-install-id") ?? "";
  if (!validSession(bearer) || !validInstall(installId)) return { error: 401 };

  const operatorId = Deno.env.get("MARSX_FARMER_OPERATOR_USER_ID") ?? "";
  const operatorEmail = (Deno.env.get("MARSX_FARMER_OPERATOR_EMAIL") ?? "")
    .trim().toLowerCase();
  const providerKey = Deno.env.get("PROXIES_SX_FARMER_API_KEY") ?? "";
  if ((!operatorId && !operatorEmail) || !providerKey) return { error: 503 };

  try {
    const authenticated = await fetch(AUTH_URL, {
      method: "GET",
      headers: { authorization: bearer, "x-install-id": installId },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!authenticated.ok) return { error: 401 };
    const identity = await authenticated.json();
    const id = typeof identity?.user?.user_id === "string"
      ? identity.user.user_id : "";
    const email = typeof identity?.user?.email === "string"
      ? identity.user.email.trim().toLowerCase() : "";
    if (!email) return { error: 401 };
    if ((operatorId && id !== operatorId) ||
      (operatorEmail && email !== operatorEmail)) return { error: 403 };
    return { providerKey, installId };
  } catch (_) {
    return { error: 401 };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return reply({ status: "error", error: "method_not_allowed" }, 405, {
      allow: "GET, POST",
    });
  }
  const auth = await authorize(request);
  if ("error" in auth) {
    const error = auth.error === 403 ? "forbidden" :
      auth.error === 503 ? "operator_not_configured" : "unauthorized";
    return reply({ status: "error", error }, auth.error);
  }

  try {
    if (request.method === "POST") {
      const rawBody = await request.text();
      if (rawBody.length > 8192) return reply({ status: "error", error: "bad_request" }, 400);
      const body = JSON.parse(rawBody);
      // Server must receive an explicit, current consent assertion before
      // calling the vendor registration API. The Android UI also checks this.
      if (body?.consent !== true || body?.proxies_notice !== true ||
          body?.action !== "register_after_explicit_consent") {
        return reply({ status: "error", error: "explicit_consent_required" }, 403);
      }
      // The Android SDK must enroll on the handset using a supported pilot credential.
      return reply({ status: "unavailable", error: "android_pilot_enrollment_unavailable" }, 503);
    }

    const requestUrl = new URL(request.url);
    const deviceId = requestUrl.searchParams.get("device_id");
    if (!validDevice(deviceId)) return reply({ status: "error", error: "bad_request" }, 400);
    const upstream = await fetch(DEVICES_URL, {
      method: "GET",
      headers: { "X-API-Key": auth.providerKey, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      console.warn("peer_status_provider_http", upstream.status);
      return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
    }
    const responseText = await upstream.text();
    if (responseText.length > 1_000_000) throw new Error("response_too_large");
    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed?.devices)) throw new Error("unexpected_device_list");
    const device = parsed.devices.find((item: unknown) =>
      item && typeof item === "object" &&
      ((item as Record<string, unknown>).deviceId === deviceId ||
       (item as Record<string, unknown>).id === deviceId));
    const providerStatus = device && typeof device.status === "string"
      ? device.status.toLowerCase() : "not_found";
    return reply({
      schema_version: 1,
      status: "live",
      source: "proxies.sx",
      scope: "pilot_device_status",
      device_id: deviceId,
      online: providerStatus === "online",
      provider_status: providerStatus,
      sampled_at: new Date().toISOString(),
    }, 200);
  } catch (error) {
    const known = ["response_too_large", "unexpected_provider_response", "unexpected_device_list"];
    const reason = error instanceof Error && known.includes(error.message) ? error.message
      : error instanceof SyntaxError ? "invalid_json"
      : error instanceof Error && error.name === "TimeoutError" ? "timeout" : "request_failed";
    console.warn("peer_request_failed", request.method, reason);
    return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
  }
});

