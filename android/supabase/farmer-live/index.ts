/**
 * Private, read-only farmer-account totals. NEVER return the provider API key,
 * raw peer device list, IP addresses, agent JWTs, or payout credentials.
 *
 * Setup (Supabase secrets):
 *   PROXIES_SX_FARMER_API_KEY       = provider account SDK/device key (server only)
 *   MARSX_FARMER_OPERATOR_USER_ID  = Supabase Auth user UUID of this account owner
 *
 * Supabase function verify_jwt=true. Auth is also rechecked with /auth/v1/user
 * and the operator user ID is matched server-side (not user_metadata).
 *
 * Does not register devices, start proxy traffic, or initiate payouts.
 */
const UPSTREAM = "https://api.proxies.sx/v1/peer/my-devices";
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
function reply(payload: Record<string, unknown>, status: number, extras = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...HEADERS, ...extras },
  });
}
function nonnegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
    value < 1e15 ? value : null;
}
Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return reply({ status: "error", error: "method_not_allowed" }, 405, {
      allow: "GET",
    });
  }
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~+\/-]+$/.test(bearer)) {
    return reply({ status: "error", error: "unauthorized" }, 401);
  }
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const owner = Deno.env.get("MARSX_FARMER_OPERATOR_USER_ID");
  if (!base || !anon || !owner) {
    return reply({ status: "unavailable", error: "operator_not_configured" }, 503);
  }
  try {
    const userResponse = await fetch(base + "/auth/v1/user", {
      method: "GET",
      headers: { "apikey": anon, "authorization": bearer },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok) {
      return reply({ status: "error", error: "unauthorized" }, 401);
    }
    const user = await userResponse.json();
    if (!user || typeof user.id !== "string" || user.is_anonymous === true) {
      return reply({ status: "error", error: "unauthorized" }, 401);
    }
    if (user.id !== owner) {
      return reply({ status: "error", error: "forbidden" }, 403);
    }
    const key = Deno.env.get("PROXIES_SX_FARMER_API_KEY");
    if (!key) {
      return reply({
        status: "not_configured",
        source: "proxies.sx",
        scope: "farmer_account_private",
        error: "provider_key_missing",
      }, 503);
    }
    const provider = await fetch(UPSTREAM, {
      method: "GET",
      headers: {
        "X-API-Key": key,
        "Accept": "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!provider.ok) {
      return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
    }
    const raw = await provider.text();
    if (raw.length > 1000000) throw new Error("response_too_large");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.devices) || parsed.devices.length > 50000) {
      throw new Error("unexpected_device_list");
    }

    let online = 0, verified = 0, listed = 0, mobile = 0, residential = 0, datacenter = 0;
    let trafficGB = 0, reportedEarned = 0;
    let trafficComplete = true, earningsComplete = true;
    for (const d of parsed.devices) {
      if (!d || typeof d !== "object") throw new Error("bad_device");
      if (d.status === "online") online++;
      if (d.verified === true) verified++;
      if (d.listedForSale === true) listed++;
      if (d.ipType === "mobile") mobile++;
      if (d.ipType === "residential") residential++;
      if (d.ipType === "datacenter") datacenter++;
      const t = nonnegativeNumber(d.trafficGB);
      const e = nonnegativeNumber(d.totalEarned);
      if (t === null) trafficComplete = false; else trafficGB += t;
      if (e === null) earningsComplete = false; else reportedEarned += e;
    }
    return reply({
      schema_version: 1,
      status: "live",
      source: "proxies.sx",
      scope: "farmer_account_private",
      account_specific: true,
      sampled_at: new Date().toISOString(),
      devices: {
        total: parsed.devices.length, online, verified, listed,
        mobile, residential, datacenter,
      },
      traffic_gb: trafficComplete ? Number(trafficGB.toFixed(6)) : null,
      provider_reported_earnings: earningsComplete
        ? Number(reportedEarned.toFixed(6))
        : null,
      sharing_enabled_by_this_endpoint: false,
      payouts_triggered: false,
    }, 200);
  } catch (_error) {
    return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
  }
});
