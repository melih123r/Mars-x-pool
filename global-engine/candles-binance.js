// Public, read-only Binance spot OHLCV. No synthetic candles or credentials.
const SYMBOLS=new Set(["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT"]);
const INTERVALS=new Set(["1m","3m","5m","15m","30m","1h","4h","1d","1w"]);
export async function fetchBinanceCandles({symbol="BTCUSDT",interval="1m",limit=200,fetchImpl=fetch,signal}={}){
 if(!SYMBOLS.has(symbol))throw Error("UNSUPPORTED_SYMBOL");
 if(!INTERVALS.has(interval))throw Error("UNSUPPORTED_INTERVAL");
 if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error("INVALID_LIMIT");
 const url=new URL("https://api.binance.com/api/v3/klines");
 url.searchParams.set("symbol",symbol);url.searchParams.set("interval",interval);url.searchParams.set("limit",String(limit));
 const response=await fetchImpl(url.toString(),{signal,headers:{accept:"application/json"}});
 if(!response.ok)throw Error("BINANCE_CANDLES_HTTP_"+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>limit)throw Error("INVALID_CANDLES_RESPONSE");
 const candles=rows.map(row=>{
  if(!Array.isArray(row)||row.length<7)throw Error("INVALID_CANDLE");
  const [time,open,high,low,close,volume,closeTime]=row;
  const values=[open,high,low,close,volume].map(Number);
  if(!Number.isSafeInteger(time)||!Number.isSafeInteger(closeTime)||closeTime<time||values.some(v=>!Number.isFinite(v)||v<0)||values[1]<Math.max(values[0],values[3])||values[2]>Math.min(values[0],values[3])||values[2]>values[1])throw Error("INVALID_CANDLE");
  return {time,open:values[0],high:values[1],low:values[2],close:values[3],volume:values[4],closed:closeTime<Date.now()};
 });
 for(let i=1;i<candles.length;i++)if(candles[i].time<=candles[i-1].time)throw Error("UNSORTED_CANDLES");
 return {source:"binance-spot-public",mode:"READ_ONLY",symbol,interval,candles,receivedAt:Date.now(),executionReady:false};
}
