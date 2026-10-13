// Public exchange market data ONLY. Never submit orders, store secrets, or handle funds.
const ALLOWED = new Set(["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT","LTCUSDT"]);
const MAX_RESPONSE_BYTES = 256 * 1024;
async function readBoundedJson(response) {
  if (!response.body?.getReader) return response.json();
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let bytes=0,text="";
  while (true) {
    const {done,value}=await reader.read();
    if (done) break;
    bytes+=value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw Object.assign(new Error("market_data_too_large"),{status:502});
    }
    text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  return JSON.parse(text);
}
export function validateMarketSymbol(input) {
  const symbol = String(input ?? "BTCUSDT").toUpperCase();
  if (!ALLOWED.has(symbol)) throw Object.assign(new Error("unsupported_symbol"), {status:400});
  return symbol;
}
export async function fetchPublicOrderBook(symbol, {fetchImpl=fetch, timeoutMs=5000}={}) {
  const s=validateMarketSymbol(symbol);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 15000)
    throw Object.assign(new Error("invalid_timeout"), {status:400});
  let response;
  try {
    response=await fetchImpl(`https://data-api.binance.vision/api/v3/depth?symbol=${s}&limit=20`, {
      signal:AbortSignal.timeout(timeoutMs),headers:{"accept":"application/json"}
    });
  } catch {
    throw Object.assign(new Error("market_data_unavailable"),{status:503});
  }
  if (!response?.ok) throw Object.assign(new Error("market_data_unavailable"),{status:503});
  let payload;
  try { payload=await readBoundedJson(response); }
  catch (error) {
    if (error?.message === "market_data_too_large") throw error;
    throw Object.assign(new Error("invalid_market_data"),{status:502});
  }
  if (!Number.isSafeInteger(payload?.lastUpdateId) || payload.lastUpdateId < 0 ||
      !Array.isArray(payload.bids) || !Array.isArray(payload.asks))
    throw Object.assign(new Error("invalid_market_data"),{status:502});
  const clean=(levels)=>{
    if (levels.length > 20) throw Object.assign(new Error("invalid_market_data"),{status:502});
    return levels.map(level=>{
      if (!Array.isArray(level) || level.length < 2 ||
          typeof level[0] !== "string" || typeof level[1] !== "string" ||
          !/^\d+(?:\.\d+)?$/.test(level[0]) || !/^\d+(?:\.\d+)?$/.test(level[1]) ||
          !(Number(level[0]) > 0) || !(Number(level[1]) > 0) ||
          !Number.isFinite(Number(level[0])) || !Number.isFinite(Number(level[1])))
        throw Object.assign(new Error("invalid_market_data"),{status:502});
      return [level[0],level[1]];
    });
  };
  const bids=clean(payload.bids),asks=clean(payload.asks);
  if (bids.some((v,i)=>i>0 && Number(bids[i-1][0])<=Number(v[0])) ||
      asks.some((v,i)=>i>0 && Number(asks[i-1][0])>=Number(v[0])) ||
      (bids.length && asks.length && Number(bids[0][0])>=Number(asks[0][0])))
    throw Object.assign(new Error("invalid_market_data"),{status:502});
  return {provider:"Binance Spot public data",symbol:s,mode:"READ_ONLY",executable:false,
    orderBookType:"EXTERNAL_MARKET_SNAPSHOT",lastUpdateId:payload.lastUpdateId,
    receivedAt:new Date().toISOString(),bids,asks};
}
