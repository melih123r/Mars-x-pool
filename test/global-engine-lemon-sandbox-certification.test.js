import test from "node:test";
import assert from "node:assert/strict";
import { LemonBrokerAdapter } from "../global-engine/adapters/lemon-markets.js";
import { certifyLemonSandboxReadOnly } from "../global-engine/lemon-sandbox-certification.js";

const json=(value,status=200)=>Response.json(value,{status});

function fixtureAdapter({failPath}={}){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const u=new URL(url); calls.push({path:u.pathname+u.search,method:options.method,headers:options.headers});
    if(failPath&&u.pathname.includes(failPath)) return new Response("sensitive-provider-body",{status:401});
    if(u.pathname==="/v1/company") return json({id:"ten_fixture",name:"MARS-X Test Partner"});\n    if(u.pathname==="/v1/agreements") return json({results:[{id:"agr-1"}]});
    if(u.pathname==="/v1/instruments") return json({results:[{isin:"US0378331005"}],pagination:{next_cursor:null}});
    if(u.pathname==="/v1/product_contracts") return json({results:[{id:"pc-1"}],pagination:{next_cursor:null}});
    if(u.pathname==="/v1/accounts/fixture-account") return json({id:"fixture-account",status:"created"});
    if(u.pathname==="/v1/accounts/fixture-account/checks") return json({results:[]});
    if(u.pathname==="/v1/accounts/fixture-account/authenticators") return json({results:[],pagination:{next_cursor:null}});
    throw new Error("Unexpected local Lemon fixture route: "+u.pathname);
  };
  return {
    calls,
    adapter:new LemonBrokerAdapter({apiKey:"fixture-key",fetchImpl})
  };
}

test("Lemon read-only certification blocks without credentials and makes zero requests",async()=>{
  let calls=0;
  const adapter=new LemonBrokerAdapter({apiKey:"",fetchImpl:async()=>{calls++;return json({});}});
  const report=await certifyLemonSandboxReadOnly({adapter,accountId:"fixture-account"});
  assert.equal(report.certified,false);
  assert.equal(report.phases.authentication.reason,"CREDENTIALS_NOT_CONFIGURED");
  assert.equal(report.writesPerformed,false);
  assert.equal(calls,0);
});

test("LOCAL CONTRACT Lemon certification performs only bounded reads",async()=>{
  const {adapter,calls}=fixtureAdapter();
  const report=await certifyLemonSandboxReadOnly({adapter,accountId:"fixture-account",principal:"marsx-fixture-user"});
  assert.equal(report.certified,true);
  assert.equal(report.scope,"READ_ONLY_SANDBOX_CONNECTIVITY");
  assert.equal(report.liveExecution,false);
  assert.equal(report.withdrawals,false);
  assert.equal(report.custody,false);
  assert.equal(report.writesPerformed,false);
  assert.ok(Object.values(report.phases).every(x=>x.status==="PASS"));
  assert.ok(calls.length>=7);
  assert.ok(calls.every(x=>x.method==="GET"));
  assert.ok(calls.every(x=>x.headers["LMG-Data-Privacy-Access-Principal"]==="marsx-fixture-user"));
  assert.equal(JSON.stringify(report).includes("fixture-key"),false);
});

test("Lemon certification without account id stops before account-specific reads",async()=>{
  const {adapter,calls}=fixtureAdapter();
  const report=await certifyLemonSandboxReadOnly({adapter,accountId:""});
  assert.equal(report.certified,false);
  assert.equal(report.phases.account_snapshot.status,"BLOCKED");
  assert.equal(report.phases.account_snapshot.reason,"SANDBOX_ACCOUNT_ID_REQUIRED");
  assert.equal(report.phases.kyc_snapshot.status,"NOT_RUN");
  assert.equal(calls.length,4);
  assert.ok(calls.every(x=>!x.path.includes("/accounts/")));
});

test("Lemon certification redacts provider failures",async()=>{
  const {adapter}=fixtureAdapter({failPath:"/agreements"});
  const report=await certifyLemonSandboxReadOnly({adapter,accountId:"fixture-account"});
  assert.equal(report.certified,false);
  assert.equal(report.phases.authentication.reason,"PROVIDER_HTTP_401");
  assert.equal(JSON.stringify(report).includes("sensitive-provider-body"),false);
});
