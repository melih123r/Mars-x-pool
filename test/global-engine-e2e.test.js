import test from "node:test";
import assert from "node:assert/strict";
import { order, quote } from "../global-engine/core.js";
import { MarsXGlobalEngine } from "../global-engine/engine.js";
import { PaperVenue } from "../global-engine/venue.js";

test("E2E: universal order -> multi-venue quotes -> best route -> paper fill",async()=>{
 const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO"},side:"BUY",amount:1000});
 const engine=new MarsXGlobalEngine([
  new PaperVenue("venue-a",["CRYPTO"],async()=>quote({venue:"venue-a",price:100,fee:0.4})),
  new PaperVenue("venue-b",["CRYPTO"],async()=>quote({venue:"venue-b",price:99.8,fee:0.1}))
 ],{minConsensus:2});
 const r=await engine.paperExecute(o);
 assert.equal(r.quotes.length,2);
 assert.equal(r.best.venue,"venue-b");
 assert.equal(r.execution.status,"FILLED");
 assert.equal(r.execution.paper,true);
 assert.equal(r.health["venue-a"].healthy,true);
 assert.equal(r.health["venue-b"].healthy,true);
});
