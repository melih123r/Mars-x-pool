// MARS-X / Proxies.sx provisioning readiness endpoint.
// Does not register devices, issue credentials, or enable proxy traffic.
// Deploy only after reviewing authentication and credential model.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const bearer = req.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publishable) return json({ error: "server_configuration_missing" }, 503);
  const client = createClient(url, publishable);
  const { data: { user }, error } = await client.auth.getUser(bearer.slice(7));
  if (error || !user || user.is_anonymous) return json({ error: "authentication_required" }, 401);
  // Never return the farmer/SDK key or provision via a client-supplied device identity.
  return json({
    status: "not_ready",
    sharing_enabled: false,
    sdk_credentials_issued: false,
    reason: "Per-device Proxies.sx SDK credential compatibility and revocation not verified"
  }, 503);
});
