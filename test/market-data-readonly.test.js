import test from "node:test";
import assert from "node:assert/strict";
import {validateMarketSymbol,fetchPublicOrderBook} from "../global-engine/market-data-readonly.js";
test("market symbols use strict allowlist",()=>{
 assert.equal(validateMarketSymbol("btcusdt"),"BTCUSDT");
 assert.throws(()=>validateMarketSymbol("BTCUSDT&limit=5000"),/unsupported_symbol/);
});
test("depth snapshot is read only and validated",async()=>{
 const fetchImpl=async(url)=>{assert.match(url,/symbol=BTCUSDT&limit=20/);return {ok:true,json:async()=>({lastUpdateId:10,bids:[["100","2"]],asks:[["101","3"]]})}};
 const r=await fetchPublicOrderBook("BTCUSDT",{fetchImpl});
 assert.equal(r.executable,false);assert.equal(r.mode,"READ_ONLY");assert.equal(r.bids[0][0],"100");
});
test("upstream failure is not disguised as empty order book",async()=>{
 await assert.rejects(fetchPublicOrderBook("BTCUSDT",{fetchImpl:async()=>({ok:false})}),/market_data_unavailable/);
});

test("rejects malformed and crossed market books",async()=>{
 const invalid=[
  {lastUpdateId:1,bids:[["NaN","2"]],asks:[["101","3"]]},
  {lastUpdateId:1,bids:[["100","-1"]],asks:[["101","3"]]},
  {lastUpdateId:1,bids:[["102","1"]],asks:[["101","3"]]},
  {lastUpdateId:1,bids:[["100","1"],["101","1"]],asks:[["102","1"]]},
  {lastUpdateId:1,bids:[["100","1"]],asks:[["102","1"],["101","1"]]},
  {lastUpdateId:1,bids:[["100","1"]],asks:[["101","1"]],extra:"ignored"},
  {lastUpdateId:-1,bids:[],asks:[]}
 ];
 for (const payload of invalid.filter((_,i)=>i!==5)) {
  await assert.rejects(fetchPublicOrderBook("BTCUSDT",{fetchImpl:async()=>({ok:true,json:async()=>payload})}),/invalid_market_data/);
 }
});
test("rejects broken upstream JSON and invalid timeout",async()=>{
 await assert.rejects(fetchPublicOrderBook("BTCUSDT",{fetchImpl:async()=>({ok:true,json:async()=>{throw Error("bad json")}})}),/invalid_market_data/);
 await assert.rejects(fetchPublicOrderBook("BTCUSDT",{fetchImpl:async()=>{throw Error("network")}}),/market_data_unavailable/);
 await assert.rejects(fetchPublicOrderBook("BTCUSDT",{timeoutMs:99999}),/invalid_timeout/);
});

test("rejects streamed order book responses above the byte cap",async()=>{
 const payload={lastUpdateId:10,bids:[["100","2"]],asks:[["101","3"]],padding:"x".repeat(256*1024)};
 const fetchImpl=async()=>new Response(JSON.stringify(payload),{status:200,headers:{"content-type":"application/json"}});
 await assert.rejects(fetchPublicOrderBook("BTCUSDT",{fetchImpl}),/market_data_too_large/);
});
