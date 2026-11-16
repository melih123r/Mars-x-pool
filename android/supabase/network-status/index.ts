// Public, read-only MARS-X Network readiness status.
// This function never provisions credentials, contacts the Proxies.sx relay,
// authenticates users, or starts traffic. Safe to expose without a JWT.
Deno.serve((request: Request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...headers, Allow: "GET" }
    });
  }
  return new Response(JSON.stringify({
    schema_version: 1,
    service: "marsx-network-status",
    status: "not_ready",
    sharing_enabled: false,
    sdk_credentials_issued: false,
    proxies_relay_connected: false,
    reason_code: "DEVICE_CREDENTIAL_INTEGRATION_PENDING",
    checked_at: new Date().toISOString()
  }), { status: 200, headers });
});
