// Read-only market data; this module never submits orders or handles funds.
// Public Binance Spot depth snapshot. Do not mistake exchange liquidity for MARS-X orders.
const ALLOWED = new Set(["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT","LTCUSDT"]);
export function validateMarketSymbol(input) {
  const symbol = String(input || "BTCUSDT").toUpperCase();
  if (!ALLOWED.has(symbol)) throw Object.assign(new Error("unsupported_symbol"), {status:400});
  return symbol;
}
export async function fetchPublicOrderBook(symbol, {fetchImpl=fetch, timeoutMs=5000}={}) {
  const s=validateMarketSymbol(symbol);
  const response=await fetchImpl(`https://data-api.binance.vision/api/v3/depth?symbol=${s}&limit=20`, {signal:AbortSignal.timeout(timeoutMs),headers:{"accept":"application/json"}});
  if (!response.ok) throw Object.assign(new Error("market_data_unavailable"),{status:503});
  const payload=await response.json();
  if (!Number.isSafeInteger(payload.lastUpdateId) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) throw Object.assign(new Error("invalid_market_data"),{status:502});
  const clean=(levels)=>levels.slice(0,20).map(v=>[String(v[0]),String(v[1])]);
  return {provider:"Binance Spot public data",symbol:s,mode:"READ_ONLY",executable:false,orderBookType:"EXTERNAL_MARKET_SNAPSHOT",lastUpdateId:payload.lastUpdateId,receivedAt:new Date().toISOString(),bids:clean(payload.bids),asks:clean(payload.asks)};
}
