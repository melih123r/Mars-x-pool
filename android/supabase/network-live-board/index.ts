/**
 * Live, PUBLIC Proxies.sx peer-network board.
 *
 * Critical: this is the vendor's *GLOBAL* board, NOT the current publisher's
 * device fleet, earnings, account balance, or proof of proxy admission.
 * Do not expose peer names, IPs, device IDs, earnings, or upstream JSON.
 * The optional SDK/device key, if configured, stays SERVER-SIDE and is used
 * only to read aggregate upstream stats. No SDK initialization or proxy
 * traffic is involved. Avoid logging upstream responses or secrets.
 */
const BOARD_URL = "https://api.proxies.sx/v1/peer/board";
// 60-second best-effort per-isolate cache limits vendor polling for public reads.
let cache: { expires: number; response: Record<string, unknown> } | null = null;
const COMMON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function respond(body: Record<string, unknown>, status: number, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...COMMON_HEADERS, ...headers },
  });
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) && value >= 0 && value <= 100000000
    ? value
    : null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return respond({ status: "error", error: "method_not_allowed" }, 405, {
      allow: "GET",
    });
  }

  if (cache && cache.expires > Date.now()) {
    return respond(cache.response, 200);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const serverKey = Deno.env.get("PROXIES_SX_FARMER_API_KEY");
    const upstream = await fetch(BOARD_URL, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(serverKey ? { "X-API-Key": serverKey } : {}),
      },
      signal: controller.signal,
      redirect: "error",
    });
    if (upstream.status === 401 || upstream.status === 403) {
      return respond({
        schema_version: 1,
        source: "proxies.sx",
        scope: "global_public_peer_board",
        status: "not_configured",
        error: "provider_authentication_required",
      }, 503);
    }
    if (!upstream.ok) {
      return respond({
        schema_version: 1,
        source: "proxies.sx",
        scope: "global_public_peer_board",
        status: "unavailable",
        error: "provider_unavailable",
      }, 502);
    }
    const length = Number(upstream.headers.get("content-length") || "0");
    if (length > 2000000) throw new Error("upstream_too_large");
    const raw = await upstream.text();
    if (raw.length > 2000000) throw new Error("upstream_too_large");
    const board = JSON.parse(raw);
    const stats = board?.stats;
    // Data stays unavailable until the vendor produces the documented shape.
    // Missing data MUST NOT be displayed as zero devices.
    const total = nonnegativeInteger(stats?.total);
    const online = nonnegativeInteger(stats?.online);
    const mobile = nonnegativeInteger(stats?.mobile);
    const residential = nonnegativeInteger(stats?.residential);
    const datacenter = nonnegativeInteger(stats?.datacenter);
    if ([total, online, mobile, residential, datacenter].some((n) => n === null)
      || online! > total!) {
      throw new Error("invalid_provider_board");
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
    cache = { expires: Date.now() + 60000, response: result };
    return respond(result, 200);
  } catch (_error) {
    return respond({
      schema_version: 1,
      source: "proxies.sx",
      scope: "global_public_peer_board",
      status: "unavailable",
      error: "provider_unavailable_or_invalid_response",
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
