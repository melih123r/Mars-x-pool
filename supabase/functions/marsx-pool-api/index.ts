import { createApp, D1Store } from "./worker.js";
import { loadRuntimeConfig, PostgresD1Database } from "./postgres-d1.ts";
import { createRuntimeConfigLoader } from "./runtime-config-loader.js";

const database = new PostgresD1Database(Deno.env.get("SUPABASE_DB_URL") ?? "");
const store = new D1Store(database);
store.kind = "postgres";
const application = createApp({ store });

const SECRET_NAMES: Record<string, string> = {
  marsx_pool_worker_token: "WORKER_TOKEN",
  marsx_pool_admin_token: "ADMIN_TOKEN",
  marsx_pool_license_pepper: "LICENSE_PEPPER",
  marsx_pool_license_session_secret: "LICENSE_SESSION_SECRET",
  marsx_pool_license_records_json: "LICENSE_RECORDS_JSON",
  marsx_pool_qonversion_secret_key: "QONVERSION_SECRET_KEY",
  marsx_pool_google_web_client_id: "GOOGLE_WEB_CLIENT_ID",
  marsx_pool_auth_subject_pepper: "AUTH_SUBJECT_PEPPER",
};

// The Vault read is safe to retry once on an actual transient DB CONNECT_TIMEOUT.
// No retries apply to nonce/session writes or any other API side effect.
const runtimeEnvironment = createRuntimeConfigLoader(async () => {
  const secrets = await loadRuntimeConfig(database);
  const environment: Record<string, string> = {
    LICENSE_TOKEN_TTL_SECONDS: "2592000",
    QONVERSION_ENTITLEMENT_IDS: "pro,farm",
    QONVERSION_SESSION_TTL_SECONDS: "86400",
    MIN_PAYOUT_UNITS: "1000000",
    DORMANT_AFTER_MS: "31536000000",
  };
  for (const [vaultName, environmentName] of Object.entries(SECRET_NAMES)) {
    if (secrets[vaultName]) environment[environmentName] = secrets[vaultName];
  }
  return environment;
});

function routeRequest(request: Request) {
  const url = new URL(request.url);
  const marker = "/marsx-pool-api";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex >= 0) {
    url.pathname = url.pathname.slice(markerIndex + marker.length) || "/";
  }
  return new Request(url, request);
}

Deno.serve(async (request: Request) => {
  try {
    return await application.fetch(routeRequest(request), await runtimeEnvironment());
  } catch (error) {
    // Postgres errors can include connection metadata; do not write secrets/PII to logs.
    const code = error && typeof error === "object" && "code" in error
      && typeof error.code === "string" ? error.code : "";
    console.error("MARS-X Supabase function failed",
      code === "CONNECT_TIMEOUT" ? "db_connect_timeout" : "service_unavailable");
    return Response.json(
      { ok: false, service: "marsx-pool-worker-api", version: "0.8.4", error: "service_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
});
