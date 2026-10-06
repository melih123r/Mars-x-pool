import test from "node:test";
import assert from "node:assert/strict";
import { executionGate,validateQuoteRisk } from "../global-engine/risk.js";
import { filterOutliers } from "../global-engine/consensus.js";

test("live execution remains hard-gated",()=>assert.equal(executionGate().reason,"LIVE_EXECUTION_DISABLED"));
test("wide spread is vetoed",()=>assert.equal(validateQuoteRisk({metadata:{bid:99,ask:101}},{maxSpreadBps:50}).reason,"SPREAD_TOO_WIDE"));
test("bad venue price is removed by consensus",()=>{
 const qs=[{price:100},{price:100.2},{price:140}];
 assert.equal(filterOutliers(qs,{maxDeviationBps:200}).length,2);
});


test("two venues with material disagreement fail closed", async()=>{
  const { MarsXGlobalEngine }=await import("../global-engine/engine.js");
  const { PaperVenue }=await import("../global-engine/venue.js");
  const { order, quote }=await import("../global-engine/core.js");
  const engine=new MarsXGlobalEngine([
    new PaperVenue("a",["CRYPTO"],async()=>quote({venue:"a",price:100,fee:0})),
    new PaperVenue("b",["CRYPTO"],async()=>quote({venue:"b",price:110,fee:0}))
  ]);
  const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO"},side:"BUY",amount:1000});
  await assert.rejects(()=>engine.route(o),/VENUE_DISAGREEMENT/);
});
