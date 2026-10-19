import test from "node:test"; import assert from "node:assert/strict";
import { instrument,order,quote } from "../global-engine/core.js";
import { executionTca,venueScore } from "../global-engine/tca.js";
const i=instrument({symbol:"BTC-USD",assetClass:"CRYPTO"});
test("rejects non-finite money inputs",()=>{ for(const x of [NaN,Infinity,-Infinity,0,-1]) assert.throws(()=>order({instrument:i,side:"BUY",amount:x})); assert.throws(()=>quote({venue:"x",price:Infinity})); });
test("TCA measures buy slippage and venue score",()=>{ const a=executionTca({side:"BUY",decisionPrice:100,arrivalPrice:101,fillPrice:102,fee:1,quantity:10,latencyMs:50,venue:"a"}); assert.ok(a.slippageBps>0); const s=venueScore([a]); assert.equal(s[0].venue,"a"); assert.equal(s[0].samples,1); });
