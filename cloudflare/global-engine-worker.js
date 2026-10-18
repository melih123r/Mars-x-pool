import { MarsXGlobalEngine } from "../global-engine/engine.js";
import { order } from "../global-engine/core.js";
import { coinbaseBtcUsd, krakenBtcUsd } from "../global-engine/adapters/public-crypto.js";

const engine=new MarsXGlobalEngine([coinbaseBtcUsd(),krakenBtcUsd()],{minConsensus:1,maxStaleMs:15000});

export default {
 async fetch(request){
  const url=new URL(request.url);
  const headers={"content-type":"application/json","cache-control":"no-store"};
  try{
   if(url.pathname==="/health") return Response.json({ok:true,mode:"READ_ONLY",liveExecution:false,service:"marsx-global-engine-edge"},{headers});
   if(url.pathname==="/route"){
    const symbol=url.searchParams.get("symbol")||"BTC-USD";
    if(symbol!=="BTC-USD") return Response.json({error:"EDGE_V01_SUPPORTS_BTC_USD_ONLY"},{status:400,headers});
    const o=order({instrument:{symbol,assetClass:"CRYPTO",quoteCurrency:"USD"},side:url.searchParams.get("side")||"BUY",amount:Number(url.searchParams.get("amount")||1)});
    return Response.json(await engine.route(o),{headers});
   }
   return Response.json({error:"NOT_FOUND"},{status:404,headers});
  }catch(e){ return Response.json({error:String(e?.message||e)},{status:400,headers}); }
 }
};
