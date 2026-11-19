/**
 * Private read-only Proxies.sx farmer totals.
 *
 * Authentication is the existing MARS-X Google session, revalidated through
 * marsx-pool-api and bound to X-Install-Id. The provider key and operator
 * allow-list remain Supabase secrets. This endpoint cannot start sharing,
 * change listings, write wallets, or request payouts.
 */
const PROVIDER_URL = "https://api.proxies.sx/v1/peer/my-devices";
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

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      value < 1e15
    ? value
    : null;
}

function validSession(value: string): boolean {
  return /^Bearer [A-Za-z0-9._~+\/-]{24,512}$/.test(value);
}

function validInstall(value: string): boolean {
  return /^[A-Za-z0-9_-]{3,64}$/.test(value);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return reply({ status: "error", error: "method_not_allowed" }, 405, {
      allow: "GET",
    });
  }

  const bearer = request.headers.get("authorization") ?? "";
  const installId = request.headers.get("x-install-id") ?? "";
  if (!validSession(bearer) || !validInstall(installId)) {
    return reply({ status: "error", error: "unauthorized" }, 401);
  }

  const operatorId = Deno.env.get("MARSX_FARMER_OPERATOR_USER_ID") ?? "";
  const operatorEmail = (Deno.env.get("MARSX_FARMER_OPERATOR_EMAIL") ?? "")
    .trim().toLowerCase();
  const providerKey = Deno.env.get("PROXIES_SX_FARMER_API_KEY") ?? "";
  if ((!operatorId && !operatorEmail) || !providerKey) {
    return reply({ status: "unavailable", error: "operator_not_configured" }, 503);
  }

  try {
    const authenticated = await fetch(AUTH_URL, {
      method: "GET",
      headers: { authorization: bearer, "x-install-id": installId },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!authenticated.ok) {
      return reply({ status: "error", error: "unauthorized" }, 401);
    }
    const identity = await authenticated.json();
    const id = typeof identity?.user?.user_id === "string"
      ? identity.user.user_id
      : "";
    const email = typeof identity?.user?.email === "string"
      ? identity.user.email.trim().toLowerCase()
      : "";
    if (!email) {
      return reply({ status: "error", error: "unauthorized" }, 401);
    }
    if ((operatorId && (!id || id !== operatorId)) ||
      (operatorEmail && email !== operatorEmail)) {
      return reply({ status: "error", error: "forbidden" }, 403);
    }

    const upstream = await fetch(PROVIDER_URL, {
      method: "GET",
      headers: { "X-API-Key": providerKey, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (upstream.status === 401 || upstream.status === 403) {
      return reply({ status: "unavailable", error: "provider_authentication_failed" }, 502);
    }
    if (!upstream.ok) {
      return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
    }
    const raw = await upstream.text();
    if (raw.length > 1_000_000) throw new Error("response_too_large");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.devices) || parsed.devices.length > 50_000) {
      throw new Error("unexpected_device_list");
    }

    let online = 0;
    let verified = 0;
    let listed = 0;
    let mobile = 0;
    let residential = 0;
    let datacenter = 0;
    let traffic = 0;
    let earnings = 0;
    let trafficComplete = true;
    let earningsComplete = true;
    for (const device of parsed.devices) {
      if (!device || typeof device !== "object") throw new Error("bad_device");
      if (device.status === "online") online++;
      if (device.verified === true) verified++;
      if (device.listedForSale === true) listed++;
      if (device.ipType === "mobile") mobile++;
      if (device.ipType === "residential") residential++;
      if (device.ipType === "datacenter") datacenter++;
      const t = safeNumber(device.trafficGB);
      const e = safeNumber(device.totalEarned);
      if (t === null) trafficComplete = false;
      else traffic += t;
      if (e === null) earningsComplete = false;
      else earnings += e;
    }

    return reply({
      schema_version: 1,
      status: "live",
      source: "proxies.sx",
      scope: "farmer_account_private",
      account_specific: true,
      sampled_at: new Date().toISOString(),
      devices: {
        total: parsed.devices.length,
        online,
        verified,
        listed,
        mobile,
        residential,
        datacenter,
      },
      traffic_gb: trafficComplete ? Number(traffic.toFixed(6)) : null,
      provider_reported_earnings: earningsComplete
        ? Number(earnings.toFixed(6))
        : null,
      sharing_enabled_by_this_endpoint: false,
      payouts_triggered: false,
    }, 200);
  } catch (_error) {
    return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
  }
});
