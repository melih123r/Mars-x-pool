/**
 * Operator-only Proxies.sx device enrollment and status endpoint.
 * The farmer API key is consumed server-side and is never returned to Android.
 */
const REGISTER_URL = "https://api.proxies.sx/v1/peer/agents/register";
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
function safeText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : "";
}
function validRelay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "wss:" &&
      (url.hostname === "proxies.sx" || url.hostname.endsWith(".proxies.sx")) &&
      (!url.port || url.port === "443") && !url.username && !url.password &&
      !url.search && !url.hash;
  } catch (_) {
    return false;
  }
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
      const deviceId = body?.device_id;
      const model = safeText(body?.model, 80);
      const osVersion = safeText(body?.os_version, 80);
      const country = typeof body?.country === "string" && /^[A-Z]{2}$/.test(body.country)
        ? body.country : "";
      if (!validDevice(deviceId) || !model || !osVersion) {
        return reply({ status: "error", error: "bad_request" }, 400);
      }
      const upstream = await fetch(REGISTER_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          accept: "application/json",
        },
        body: JSON.stringify({
          // Stable per-phone identity for re-registration.
          name: deviceId,
          type: "android",
          apiKey: auth.providerKey,
          model,
          osVersion,
          ...(country ? { country } : {}),
        }),
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) {
        return reply({ status: "unavailable", error: upstream.status === 401 ||
          upstream.status === 403 ? "provider_authentication_failed" : "provider_unavailable" }, 502);
      }
      const responseText = await upstream.text();
      if (responseText.length > 65536) throw new Error("response_too_large");
      const parsed = JSON.parse(responseText);
      const returnedId = parsed?.deviceId;
      const token = parsed?.jwt;
      const relay = parsed?.relay;
      if (!validDevice(returnedId) || typeof token !== "string" ||
        !/^[A-Za-z0-9._~+\/=-]{24,4096}$/.test(token) || !validRelay(relay)) {
        throw new Error("unexpected_provider_response");
      }
      return reply({
        schema_version: 1,
        status: "enrolled",
        source: "proxies.sx",
        scope: "pilot_device_credential",
        device_id: returnedId,
        client_request_id: deviceId,
        device_token: token,
        relay_url: relay,
        farmer_api_key_included: false,
      }, 200);
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
    if (!upstream.ok) return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
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
  } catch (_) {
    return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
  }
});

