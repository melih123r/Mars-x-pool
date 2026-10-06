const TF={ "1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1D":86400 };
const PRODUCT=new Set(["BTC-USD","ETH-USD"]);
export class CoinbaseHistoricalAdapter{
 constructor({baseUrl="https://api.exchange.coinbase.com"}={}){this.name="coinbase-history";this.baseUrl=baseUrl;}
 async fetchBars({symbol,timeframe="1h",limit=300}){
  const s=String(symbol).toUpperCase(),g=TF[timeframe];if(!PRODUCT.has(s)||!g)throw new Error("unsupported Coinbase historical request");
  const res=await fetch(`${this.baseUrl}/products/${s}/candles?granularity=${g}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw new Error(`Coinbase candles HTTP ${res.status}`);const p=await res.json();
  return p.slice(0,Math.min(Number(limit)||300,300)).map(x=>({time:new Date(Number(x[0])*1000).toISOString(),low:Number(x[1]),high:Number(x[2]),open:Number(x[3]),close:Number(x[4]),volume:Number(x[5])})).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 }
}
const KPAIR={ "BTC-USD":"XBTUSD","ETH-USD":"ETHUSD" },KINT={"1m":1,"5m":5,"15m":15,"1h":60,"4h":240,"1D":1440,"1W":10080};
export class KrakenHistoricalAdapter{
 constructor({baseUrl="https://api.kraken.com"}={}){this.name="kraken-history";this.baseUrl=baseUrl;}
 async fetchBars({symbol,timeframe="1h",limit=720}){
  const pair=KPAIR[String(symbol).toUpperCase()],i=KINT[timeframe];if(!pair||!i)throw new Error("unsupported Kraken historical request");
  const res=await fetch(`${this.baseUrl}/0/public/OHLC?pair=${pair}&interval=${i}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw new Error(`Kraken OHLC HTTP ${res.status}`);const p=await res.json();if(p.error?.length)throw new Error(p.error.join(","));
  const k=Object.keys(p.result||{}).find(x=>x!=="last"),rows=k?p.result[k]:[];
  return rows.slice(-Math.min(Number(limit)||720,720)).map(x=>({time:new Date(Number(x[0])*1000).toISOString(),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[6])}));
 }
}
