import test from "node:test";
import assert from "node:assert/strict";
import { LemonBrokerAdapter } from "../global-engine/adapters/lemon-markets.js";

test("lemon adapter uses current sandbox host and fails closed without credentials", async()=>{
  const a=new LemonBrokerAdapter({apiKey:""});
  assert.equal(a.baseUrl,"https://sandbox.api.lemon.markets/v1");
  assert.equal(a.configured(),false);
  await assert.rejects(()=>a.getAccount("acct-1"),/credential is not configured/);
});

test("privacy tracing headers are mandatory",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.headers({}),/privacy principal required/);
  const h=a.headers({principal:"backend-test",justification:"test.read"});
  assert.equal(h.Authorization,"Bearer test-only");
  assert.equal(h["LMG-Data-Privacy-Access-Principal"],"backend-test");
  assert.equal(h["LMG-Data-Privacy-Access-Justification"],"test.read");
});

test("order submission and withdrawals are disabled by default", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
  await assert.rejects(()=>a.createOrder("acct-1",{side:"buy"}),/order submission disabled/);
 assert.throws(()=>a.createWithdrawal("acct-1",{amount:"10.00"}),/withdrawals disabled/);
});

test("identity verification validates redirect contract before network call", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
 assert.throws(()=>a.startIdentityVerification("acct-1",{redirectSuccess:"marsx://ok"}),/redirectFailure required/);
});

test("webhook requires at least one event", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
 assert.throws(()=>a.createWebhook({url:"https://example.test/hook",events:[]}),/webhook events required/);
});

test("generic live execution remains disabled", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  await assert.rejects(()=>a.placeOrder(),/generic live execution disabled/);
});
