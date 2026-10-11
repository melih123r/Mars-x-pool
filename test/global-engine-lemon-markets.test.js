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
  assert.doesNotThrow(()=>new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://dev-brokerage.lemon.markets/v1"}));
  assert.throws(()=>new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://api.lemon.markets/v1"}),/invalid lemon.markets base URL/);
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


test("authenticator enrollment requires all SCA enrollment fields",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.createAuthenticator("acct-1",{name:"Pixel"}),/authenticator public key required/);
  const original=globalThis.fetch;
  let seen=null;
  globalThis.fetch=async(url,opts)=>{
    seen={url:String(url),opts};
    return new Response(JSON.stringify({id:"auth-1"}),{status:201,headers:{"content-type":"application/json"}});
  };
  try{
    const payload={
      name:"Android device",
      public_key:"base64url-public-key",
      client_credential_id:"cred-1",
      verification:{signature:"test-signature"}
    };
    const result=await a.createAuthenticator("acct-1",payload,{principal:"marsx-backend-test",justification:"sca.authenticator.enroll"});
    assert.equal(result.id,"auth-1");
    assert.equal(seen.url,"https://sandbox.api.lemon.markets/v1/accounts/acct-1/authenticators");
    assert.equal(seen.opts.method,"POST");
    assert.deepEqual(JSON.parse(seen.opts.body),payload);
  } finally { globalThis.fetch=original; }
});

test("instrument and product contract discovery remain bounded and read-only",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.listInstruments({limit:101}),/invalid instrument limit/);
  assert.throws(()=>a.listInstruments({type:"crypto"}),/invalid instrument type/);
  assert.throws(()=>a.listProductContracts({type:"unknown"}),/invalid product contract type/);
  const original=globalThis.fetch;
  const urls=[];
  globalThis.fetch=async(url)=>{
    urls.push(String(url));
    return new Response(JSON.stringify({results:[],pagination:{next_cursor:null}}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    await a.listInstruments({type:"etf",limit:50},{principal:"marsx-backend-test",justification:"market.instruments"});
    await a.listProductContracts({type:"brokerage",limit:25},{principal:"marsx-backend-test",justification:"market.product_contracts"});
    assert.equal(urls[0],"https://sandbox.api.lemon.markets/v1/instruments?limit=50&type=etf");
    assert.equal(urls[1],"https://sandbox.api.lemon.markets/v1/product_contracts?limit=25&type=brokerage");
  } finally { globalThis.fetch=original; }
});


test("identity verification rejects unsafe redirect schemes and permits MARS-X deep links",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.startIdentityVerification("acct-1",{
    redirectSuccess:"http://example.test/ok",
    redirectFailure:"https://example.test/fail"
  }),/redirectSuccess invalid/);
  assert.throws(()=>a.startIdentityVerification("acct-1",{
    redirectSuccess:"javascript:alert(1)",
    redirectFailure:"https://example.test/fail"
  }),/redirectSuccess invalid/);
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  try{
    const result=await a.startIdentityVerification("acct-1",{
      redirectSuccess:"marsx:/brokerage/success",
      redirectFailure:"marsx:/brokerage/failure"
    },{principal:"marsx-backend-test",justification:"onboarding.identity_verification"});
    assert.equal(result.ok,true);
  } finally { globalThis.fetch=original; }
});

test("authenticator recovery code and list pagination are validated",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.createAuthenticator("acct-1",{
    name:"Android device",
    public_key:"pk",
    client_credential_id:"cred-1",
    verification:{signature:"sig"},
    recovery_code:"12345"
  }),/invalid recovery code/);
  assert.throws(()=>a.listAuthenticators("acct-1",{limit:101}),/invalid authenticator limit/);
  const original=globalThis.fetch;
  let seen=null;
  globalThis.fetch=async(url,opts)=>{
    seen={url:String(url),opts};
    return new Response(JSON.stringify({results:[],pagination:{next_cursor:null}}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    await a.listAuthenticators("acct-1",{limit:25},{principal:"marsx-backend-test",justification:"sca.authenticator.list"});
    assert.equal(seen.url,"https://sandbox.api.lemon.markets/v1/accounts/acct-1/authenticators?limit=25");
    assert.equal(seen.opts.method,"GET");
  } finally { globalThis.fetch=original; }
});


test("portfolio read helpers validate bounds and filters",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.listOrders("acct-1",{limit:0}),/invalid order list limit/);
  assert.throws(()=>a.listOrders("acct-1",{status:"unknown"}),/invalid order status/);
  assert.throws(()=>a.listTransactions("acct-1",{limit:101}),/invalid transaction list limit/);
  assert.throws(()=>a.listAccounts({status:"pending"}),/invalid account status/);
  const original=globalThis.fetch;
  const urls=[];
  globalThis.fetch=async(url)=>{
    urls.push(String(url));
    return new Response(JSON.stringify({results:[],pagination:{next_cursor:null}}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    await a.listOrders("acct-1",{limit:25,status:"created",securitiesAccount:"seca-1"},{principal:"marsx-backend-test",justification:"portfolio.orders"});
    await a.listTransactions("acct-1",{limit:10},{principal:"marsx-backend-test",justification:"portfolio.transactions"});
    await a.listAccounts({limit:20,status:"opened",personCustomer:true},{principal:"marsx-backend-test",justification:"onboarding.account_list"});
    assert.equal(urls[0],"https://sandbox.api.lemon.markets/v1/accounts/acct-1/orders?limit=25&status=created&securities_account=seca-1");
    assert.equal(urls[1],"https://sandbox.api.lemon.markets/v1/accounts/acct-1/transactions?limit=10");
    assert.equal(urls[2],"https://sandbox.api.lemon.markets/v1/accounts?limit=20&status=opened&person_customer=true");
  } finally { globalThis.fetch=original; }
});

test("webhook registration rejects unsafe callback URLs and malformed events",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  assert.throws(()=>a.createWebhook({url:"http://example.test/hook",events:["account.created"]}),/invalid webhook url/);
  assert.throws(()=>a.createWebhook({url:"https://example.test/hook",events:["bad event"]}),/webhook events required/);
  const original=globalThis.fetch;
  let seen=null;
  globalThis.fetch=async(url,opts)=>{
    seen={url:String(url),opts};
    return new Response(JSON.stringify({id:"wbh-1",signature_secret:"secret"}),{status:201,headers:{"content-type":"application/json"}});
  };
  try{
    const result=await a.createWebhook({url:"https://marsx.example/webhooks/lemon",events:["account.created"]},{principal:"marsx-backend-test",justification:"webhook.configure"});
    assert.equal(result.id,"wbh-1");
    assert.equal(seen.url,"https://sandbox.api.lemon.markets/v1/webhooks");
    assert.equal(seen.opts.method,"POST");
  } finally { globalThis.fetch=original; }
});


test("external Lemon requests require an explicit end-user principal",async()=>{
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  await assert.rejects(()=>a.getAccount("acct-1"),/privacy principal required/);
  await assert.rejects(()=>a.listInstruments({limit:10}),/privacy principal required/);
});
