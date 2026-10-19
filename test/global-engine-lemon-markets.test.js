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

test("order and withdrawal confirmation require SCA",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid",allowOrderSubmission:true,allowWithdrawals:true});
  assert.throws(()=>a.confirmOrder("acct-1","ord-1",null),/SCA confirmation required/);
  assert.throws(()=>a.confirmWithdrawal("acct-1","wd-1",null),/SCA confirmation required/);
});

test("identity verification validates redirect contract before network call",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
  assert.throws(()=>a.startIdentityVerification("acct-1",{redirectSuccess:"marsx://ok"}),/redirectFailure required/);
});

test("webhook requires at least one event",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
  assert.throws(()=>a.createWebhook({url:"https://example.test/hook",events:[]}),/webhook events required/);
});

test("generic live execution remains disabled", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  await assert.rejects(()=>a.placeOrder(),/generic live execution disabled/);
});


test("order submission requires an idempotency key before network access", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid",allowOrderSubmission:true});
  await assert.rejects(()=>a.createOrder("acct-1",{side:"buy",type:"market",instrument:"US0378331005",amount:"10",fees:{type:"fixed",amount:"0"},currency:"EUR"}),/idempotencyKey required/);
});

test("order confirmation forwards SCA, appropriateness consent and actor", async()=>{
  const originalFetch=global.fetch;
  let captured;
  global.fetch=async(url,options)=>{
    captured={url,options};
    return {ok:true,status:200,text:async()=>JSON.stringify({id:"ord-1",status:"confirmed"})};
  };
  try{
    const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v1",allowOrderSubmission:true});
    const result=await a.confirmOrder(
      "acct-1","ord-1",{challenge:"signed"},
      {principal:"backend-acct-1",appropriatenessConsent:true,actor:{type:"customer",id:"acct-1"}}
    );
    assert.equal(result.status,"confirmed");
    assert.equal(captured.url,"https://sandbox.api.lemon.markets/v1/accounts/acct-1/orders/ord-1/confirm");
    const body=JSON.parse(captured.options.body);
    assert.deepEqual(body.sca,{challenge:"signed"});
    assert.equal(body.appropriateness_consent,true);
    assert.deepEqual(body.actor,{type:"customer",id:"acct-1"});
    assert.equal(captured.options.headers["LMG-Data-Privacy-Access-Principal"],"backend-acct-1");
  } finally {
    global.fetch=originalFetch;
  }
});

test("order confirmation validates optional regulatory fields",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid",allowOrderSubmission:true});
  assert.throws(()=>a.confirmOrder("acct-1","ord-1",{challenge:"x"},{appropriatenessConsent:"yes"}),/appropriateness consent must be boolean/);
  assert.throws(()=>a.confirmOrder("acct-1","ord-1",{challenge:"x"},{actor:"customer"}),/actor must be an object/);
});
