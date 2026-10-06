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
