import http from "node:http";
import { instrument, order } from "./core.js";
import { MarsXGlobalEngine } from "./engine.js";
import { coinbaseBtcUsd, krakenBtcUsd } from "./adapters/public-crypto.js";
import { PublicFxAdapter } from "./adapters/public-fx.js";
import { AlpacaMarketDataAdapter } from "./adapters/alpaca.js";

export function buildEngine(){
  const adapters=[coinbaseBtcUsd(),krakenBtcUsd(),new PublicFxAdapter()];
  if(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) adapters.push(new AlpacaMarketDataAdapter());
  return new MarsXGlobalEngine(adapters,{maxStaleMs:Number(process.env.MARSX_MAX_STALE_MS||15000),maxSpreadBps:Number(process.env.MARSX_MAX_SPREAD_BPS||50),minConsensus:Number(process.env.MARSX_MIN_CONSENSUS||1)});
}

export function createApi(engine=buildEngine()){
  return http.createServer(async(req,res)=>{
    res.setHeader("content-type","application/json");
    try{
      const url=new URL(req.url,"http://localhost");
      if(req.method==="GET" && url.pathname==="/health") return res.end(JSON.stringify({ok:true,mode:"READ_ONLY",liveExecution:false,venues:engine.health.snapshot()}));
      if(req.method==="GET" && ["/quote","/route"].includes(url.pathname)){
        const i=instrument({symbol:url.searchParams.get("symbol"),assetClass:url.searchParams.get("assetClass"),quoteCurrency:url.searchParams.get("quoteCurrency")||"USD"});
        const o=order({instrument:i,side:url.searchParams.get("side")||"BUY",amount:Number(url.searchParams.get("amount")||1)});
        const routed=await engine.route(o);
        return res.end(JSON.stringify(url.pathname==="/quote"?routed.quotes:routed));
      }
      res.statusCode=404; return res.end(JSON.stringify({error:"NOT_FOUND"}));
    }catch(e){ res.statusCode=400; return res.end(JSON.stringify({error:String(e.message||e)})); }
  });
}

if(import.meta.url===`file://${process.argv[1]}`) createApi().listen(Number(process.env.PORT||8080));
