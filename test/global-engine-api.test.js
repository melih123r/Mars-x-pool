import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../global-engine/api.js";
import { MarsXGlobalEngine } from "../global-engine/engine.js";
import { PaperVenue } from "../global-engine/venue.js";
import { quote } from "../global-engine/core.js";

test("read-only API exposes health and route",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const port=server.address().port;
  const health=await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.mode,"READ_ONLY"); assert.equal(health.liveExecution,false);
  const route=await (await fetch(`http://127.0.0.1:${port}/route?symbol=BTC-USD&assetClass=CRYPTO&side=BUY&amount=1000`)).json();
  assert.equal(route.best.venue,"paper");
 } finally { await new Promise(r=>server.close(r)); }
});
