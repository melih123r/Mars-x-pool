/**
 * Server-only partner boundary.
 *
 * This function deliberately does not guess TraffMonetizer endpoints or
 * payloads. The access token is read from Supabase secrets and is never
 * returned, logged, or sent to Android. Until the partner supplies the
 * signed API/SDK contract, every live operation remains fail-closed.
 */

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function configured() {
  const token = Deno.env.get("TRAFFMONETIZER_ACCESS_TOKEN")?.trim() ?? "";
  const baseUrl = Deno.env.get("TRAFFMONETIZER_API_BASE_URL")?.trim() ?? "";
  const live = Deno.env.get("TRAFFMONETIZER_LIVE_ENABLED") === "true";
  return { hasToken: token.length > 0, hasBaseUrl: baseUrl.length > 0, live };
}

function path(request: Request) {
  const url = new URL(request.url);
  const marker = "/traffmonetizer-gateway";
  const index = url.pathname.indexOf(marker);
  return index >= 0 ? url.pathname.slice(index + marker.length) || "/" : url.pathname;
}

Deno.serve((request: Request) => {
  const config = configured();
  const operation = path(request);

  if (request.method === "GET" && operation === "/status") {
    return Promise.resolve(json({
      ok: true,
      provider: "traffmonetizer",
      liveTraffic: false,
      configured: config.hasToken && config.hasBaseUrl && config.live,
      reason: config.hasToken && config.hasBaseUrl && config.live
        ? "awaiting_official_contract_verification"
        : "provider_configuration_incomplete",
    }));
  }

  // No provider request is made until the endpoint, payload and receipt
  // contract have been reviewed. A token by itself is insufficient.
  return Promise.resolve(json({
    ok: false,
    error: config.hasToken ? "provider_contract_not_verified" : "provider_secret_missing",
    liveTraffic: false,
  }, 423));
});
