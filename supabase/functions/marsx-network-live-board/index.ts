/** Public aggregate Proxies.sx agent statistics. No account/device data. */
const UPSTREAM = "https://api.proxies.sx/v1/peer/agents/stats/summary";
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};
let cache: { expires: number; value: Record<string, unknown> } | null = null;

function reply(body: Record<string, unknown>, status: number, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

function integer(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000) return value;
  }
  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") return reply({ status: "error", error: "method_not_allowed" }, 405, { allow: "GET" });
  if (cache && cache.expires > Date.now()) return reply(cache.value, 200);
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
    if (!upstream.ok) return reply({ status: "unavailable", error: "provider_unavailable" }, 502);
    const raw = await upstream.text();
    if (raw.length > 200_000) throw new Error("response_too_large");
    const value = JSON.parse(raw);
    const stats = value?.stats ?? value?.summary ?? value;
    const total = integer(stats?.total, stats?.totalAgents, stats?.totalDevices);
    const online = integer(stats?.online, stats?.onlineAgents, stats?.onlineDevices);
    const mobile = integer(stats?.mobile, stats?.byIpType?.mobile);
    const residential = integer(stats?.residential, stats?.byIpType?.residential);
    const datacenter = integer(stats?.datacenter, stats?.byIpType?.datacenter);
    if ([total, online, mobile, residential, datacenter].some((v) => v === null) || online! > total!) {
      throw new Error("unexpected_provider_shape");
    }
    const result = {
      schema_version: 1,
      source: "proxies.sx",
      scope: "global_public_peer_board",
      status: "live",
      sampled_at: new Date().toISOString(),
      metrics: { total, online, mobile, residential, datacenter },
      account_specific: false,
      sdk_credentials_issued: false,
      sharing_enabled: false,
    };
    cache = { expires: Date.now() + 60_000, value: result };
    return reply(result, 200);
  } catch (_error) {
    return reply({ status: "unavailable", error: "provider_unavailable_or_invalid_response" }, 502);
  }
});
