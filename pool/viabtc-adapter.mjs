import { createHmac } from "node:crypto";
import { normalizePoolSnapshot } from "./settlement.mjs";

const DEFAULT_BASE = "https://www.viabtc.com";

function requireHttps(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("provider base URL must use https");
  return parsed;
}

function secret(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

export function createViaBtcAdapter({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  const apiKey = secret(env, "VIABTC_API_KEY");
  const apiSecret = secret(env, "VIABTC_API_SECRET");
  const account = secret(env, "VIABTC_ACCOUNT");
  const base = requireHttps(env.VIABTC_API_BASE || DEFAULT_BASE);

  async function request(path, params = {}) {
    // ViaBTC authentication details can change; keep signing isolated here.
    // Production enablement requires matching this canonical request to the
    // currently documented official API before REAL_POOL_ENABLED is set.
    const timestamp = String(now());
    const query = new URLSearchParams({ ...params, account, tonce: timestamp });
    const canonical = query.toString();
    const signature = createHmac("sha256", apiSecret).update(canonical).digest("hex");
    const url = new URL(path, base);
    url.search = canonical;
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
        "X-SIGNATURE": signature,
      },
      signal: AbortSignal.timeout(8_000),
    });
    const raw = await response.text();
    if (raw.length > 512_000) throw new Error("provider response too large");
    let body;
    try { body = JSON.parse(raw || "{}"); } catch { throw new Error("provider returned invalid JSON"); }
    if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
    return body;
  }

  return Object.freeze({
    provider: "viabtc",
    request,
    normalizeSettlement({ asset, workerId, grossUnits, acceptedShares, rejectedShares, hashrate, reference, observedAt }) {
      return normalizePoolSnapshot({
        provider: "viabtc",
        asset,
        workerId,
        grossUnits,
        acceptedShares,
        rejectedShares,
        hashrate,
        providerReference: reference,
        observedAt,
      });
    },
  });
}

export function assertRealPoolEnabled(env = process.env) {
  if (env.REAL_POOL_ENABLED !== "true") throw new Error("real pool integration is disabled");
  if (env.REAL_PAYOUTS_ENABLED === "true") {
    throw new Error("safety stop: real payouts require a separately reviewed signer/custody adapter");
  }
  return true;
}
