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
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v1"});
  await assert.rejects(()=>a.createOrder("acct-1",{side:"buy"}),/order submission disabled/);
  assert.throws(()=>a.createWithdrawal("acct-1",{amount:"10.00"}),/withdrawals disabled/);
});

test("order and withdrawal confirmation require SCA",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v1",allowOrderSubmission:true,allowWithdrawals:true});
  assert.throws(()=>a.confirmOrder("acct-1","ord-1",null),/SCA confirmation required/);
  assert.throws(()=>a.confirmWithdrawal("acct-1","wd-1",null),/SCA confirmation required/);
});

test("identity verification validates redirect contract before network call",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v1"});
  assert.throws(()=>a.startIdentityVerification("acct-1",{redirectSuccess:"marsx://ok"}),/redirectFailure required/);
});

test("webhook requires at least one event",()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v1"});
  assert.throws(()=>a.createWebhook({url:"https://example.test/hook",events:[]}),/webhook events required/);
});

test("generic live execution remains disabled", async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  await assert.rejects(()=>a.placeOrder(),/generic live execution disabled/);
});


test("rejects non-official lemon base URLs",()=>{
  assert.throws(()=>new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"http://sandbox.api.lemon.markets/v1"}),/invalid lemon.markets base URL/);
  assert.throws(()=>new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid/v1"}),/invalid lemon.markets base URL/);
  assert.throws(()=>new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://sandbox.api.lemon.markets/v2"}),/invalid lemon.markets API version path/);
});

test("identity verification request uses backend auth and privacy headers",async()=>{
  const original=globalThis.fetch;
  let seen=null;
  globalThis.fetch=async(url,opts)=>{
    seen={url:String(url),opts};
    return new Response(JSON.stringify({id:"verification-1"}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const a=new LemonBrokerAdapter({apiKey:"sandbox-secret"});
    const result=await a.startIdentityVerification("acct/1",{
      redirectSuccess:"https://marsx.example/kyc/success",
      redirectFailure:"https://marsx.example/kyc/failure"
    },{principal:"marsx-backend-test",justification:"onboarding.identity_verification"});
    assert.equal(result.id,"verification-1");
    assert.equal(seen.url,"https://sandbox.api.lemon.markets/v1/accounts/acct%2F1/identity_verification");
    assert.equal(seen.opts.method,"POST");
    assert.equal(seen.opts.headers.Authorization,"Bearer sandbox-secret");
    assert.equal(seen.opts.headers["LMG-Data-Privacy-Access-Principal"],"marsx-backend-test");
    assert.equal(seen.opts.headers["LMG-Data-Privacy-Access-Justification"],"onboarding.identity_verification");
    assert.deepEqual(JSON.parse(seen.opts.body),{
      redirect_success:"https://marsx.example/kyc/success",
      redirect_failure:"https://marsx.example/kyc/failure"
    });
  } finally {
    globalThis.fetch=original;
  }
});
