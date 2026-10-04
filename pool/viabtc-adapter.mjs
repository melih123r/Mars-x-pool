import { createHmac } from "node:crypto";
import { normalizePoolSnapshot } from "./settlement.mjs";

// Official ViaBTC pool OpenAPI host from viabtc/viapool_api examples.
const DEFAULT_BASE = "https://pool.viabtc.com";
const READ_ONLY_PATHS = new Set([
  "/res/openapi/v1/hashrate",
  "/res/openapi/v1/profit/history"
]);

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
function coin(asset) {
  const value = String(asset || "").toUpperCase();
  if (!new Set(["LTC","DOGE"]).has(value)) throw new Error("unsupported ViaBTC asset");
  return value;
}

export function createViaBtcAdapter({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const apiKey = secret(env, "VIABTC_API_KEY");
  const apiSecret = String(env.VIABTC_API_SECRET || "").trim();
  const base = requireHttps(env.VIABTC_API_BASE || DEFAULT_BASE);

  async function request(path, params = {}, { signed = false } = {}) {
    if (!READ_ONLY_PATHS.has(path)) throw new Error("endpoint not allowlisted");
    const queryParams = { ...params };
    const headers = { Accept: "application/json", "X-API-KEY": apiKey };
    if (signed) {
      if (!apiSecret) throw new Error("missing VIABTC_API_SECRET");
      queryParams.tonce = String(now());
    }
    const query = new URLSearchParams(queryParams);
    const canonical = query.toString();
    if (signed) headers["X-SIGNATURE"] = createHmac("sha256", apiSecret).update(canonical).digest("hex");
    const url = new URL(path, base);
    url.search = canonical;
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8_000) });
    const raw = await response.text();
    if (raw.length > 512_000) throw new Error("provider response too large");
    let body;
    try { body = JSON.parse(raw || "{}"); } catch { throw new Error("provider returned invalid JSON"); }
    if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
    if (Number(body.code) !== 0) throw new Error(`provider error ${body.code}: ${String(body.message || "unknown")}`);
    return body.data;
  }

  return Object.freeze({
    provider: "viabtc",
    accountHashrate: (asset) => request("/res/openapi/v1/hashrate", { coin: coin(asset) }),
    profitHistory: (asset, params = {}) => request("/res/openapi/v1/profit/history", { coin: coin(asset), ...params }),
    request,
    normalizeSettlement({ asset, workerId, grossUnits, acceptedShares, rejectedShares, hashrate, reference, observedAt }) {
      return normalizePoolSnapshot({ provider:"viabtc", asset:coin(asset), workerId, grossUnits, acceptedShares, rejectedShares, hashrate, providerReference:reference, observedAt });
    },
  });
}

export function assertRealPoolEnabled(env = process.env) {
  if (env.REAL_POOL_ENABLED !== "true") throw new Error("real pool integration is disabled");
  if (!env.VIABTC_API_KEY) throw new Error("real pool requires VIABTC_API_KEY");
  if (env.REAL_PAYOUTS_ENABLED === "true" || env.REAL_WITHDRAWALS_ENABLED === "true") {
    throw new Error("safety stop: real payouts/withdrawals require a separately reviewed signer/custody adapter");
  }
  return true;
}
