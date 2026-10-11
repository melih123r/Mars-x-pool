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
