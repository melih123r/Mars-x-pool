import test from "node:test";import assert from "node:assert/strict";import {auditBars,compareProviders} from "../global-engine/history-quality.js";
const bar=(t,c=100)=>({time:new Date(t).toISOString(),open:c,high:c+1,low:c-1,close:c,volume:1});
test("quality detects gaps and stale data",()=>{const now=1700001000000,b=[bar(now-600000),bar(now-480000)];const q=auditBars(b,{timeframe:"1m",now});assert.ok(q.gaps>0);assert.equal(q.stale,true);assert.equal(q.ok,false);});
test("provider comparison detects divergence",()=>{const t=1700000000000;const q=compareProviders([bar(t,100)],[bar(t,120)],{maxDeviationBps:100});assert.equal(q.matched,1);assert.equal(q.outliers,1);assert.equal(q.ok,false);});
