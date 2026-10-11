import test from "node:test";
import assert from "node:assert/strict";
import { verifyLemonWebhookSignature, parseLemonWebhookEvent } from "../global-engine/lemon-webhook.js";

test("Lemon webhook verifier matches official HMAC test vector",()=>{
  const result=verifyLemonWebhookSignature({
    body:"{}",
    header:"t=0,v1=3523dcc0013f08dfa1855772441107330218793f399d7452bd3ff2159c6e0285",
    secret:"0000000000000000000000000000000000000000000000000000000000000000",
    nowSec:0,
    toleranceSec:0
  });
  assert.equal(result.valid,true);
  assert.equal(result.reason,null);
});

test("Lemon webhook verifier rejects tampering and replay windows",()=>{
  const secret="0000000000000000000000000000000000000000000000000000000000000000";
  const header="t=0,v1=3523dcc0013f08dfa1855772441107330218793f399d7452bd3ff2159c6e0285";
  assert.equal(verifyLemonWebhookSignature({body:'{"x":1}',header,secret,nowSec:0,toleranceSec:0}).reason,"SIGNATURE_MISMATCH");
  assert.equal(verifyLemonWebhookSignature({body:"{}",header,secret,nowSec:301,toleranceSec:300}).reason,"TIMESTAMP_OUT_OF_WINDOW");
});

test("Lemon webhook verifier validates header and secret inputs",()=>{
  assert.throws(()=>verifyLemonWebhookSignature({body:"{}",header:"bad",secret:"x".repeat(64)}),/invalid Lemon signature header/);
  assert.throws(()=>verifyLemonWebhookSignature({body:"{}",header:"t=0,v1="+"0".repeat(64),secret:"short"}),/invalid Lemon signature secret/);
  assert.throws(()=>verifyLemonWebhookSignature({body:"{}",header:"t=0,v1="+"0".repeat(64),secret:"x".repeat(64),toleranceSec:5000}),/invalid Lemon signature tolerance/);
});

test("Lemon webhook body parser is bounded and JSON-only",()=>{
  const event=parseLemonWebhookEvent('{"id":"evt_12345678","type":"account.created","created_at":"2026-10-11T00:00:00Z","context":{"account":"cusa_fixture"}}');
  assert.equal(event.id,"evt_12345678");
  assert.throws(()=>parseLemonWebhookEvent("not-json"),/invalid Lemon webhook JSON/);
  assert.throws(()=>parseLemonWebhookEvent("x".repeat(256*1024+1)),/invalid Lemon webhook body/);
});
