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

test("ChangeNOW HTTP surface is read-only and fail-closed",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await fetch(base+"/changenow/health")).json();
  assert.equal(health.provider,"ChangeNOW");assert.equal(health.mode,"READ_ONLY");assert.equal(health.executionReady,false);assert.equal(health.capabilities.createTransaction,false);
  const bad=await fetch(base+"/changenow/quote?fromCurrency=btc&toCurrency=sol&fromAmount=0");
  assert.equal(bad.status,400);const body=await bad.json();assert.equal(JSON.stringify(body).includes("CHANGENOW_API_KEY"),false);
  const post=await fetch(base+"/changenow/quote",{method:"POST"});assert.equal(post.status,404);
  const create=await fetch(base+"/changenow/transaction",{method:"POST"});assert.equal(create.status,404);
 } finally { await new Promise(r=>server.close(r)); }
});

test("Pool ChangeNOW bridge remains quote-only",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const invalid=await fetch(base+"/pool/changenow/quote?toCurrency=sol&fromAmount=0");
  assert.equal(invalid.status,400);
  const create=await fetch(base+"/pool/changenow/transaction",{method:"POST"});
  assert.equal(create.status,404);
 } finally { await new Promise(r=>server.close(r)); }
});

test("provider-neutral Convert API is ready for users but execution stays locked",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await fetch(base+"/convert/health")).json();
  assert.equal(health.provider,"MARS-X Engine");assert.equal(health.mode,"READ_ONLY");assert.equal(health.executionReady,false);
  assert.equal(health.capabilities.createTransaction,false);assert.equal(health.capabilities.withdrawals,false);
  const badQuote=await fetch(base+"/convert/quote?fromCurrency=btc&toCurrency=sol&fromAmount=0");
  assert.equal(badQuote.status,400);
  const body=await badQuote.json();
  assert.equal(JSON.stringify(body).includes("CHANGENOW_API_KEY"),false);
  const create=await fetch(base+"/convert/transaction",{method:"POST"});
  assert.equal(create.status,404);
 } finally { await new Promise(r=>server.close(r)); }
});

test("broker gateway exposes lemon readiness without enabling live trading",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await fetch(base+"/broker/health")).json();
  assert.equal(health.primaryBroker,"lemon.markets");
  assert.equal(health.production.liveTrading,false);
  assert.equal(health.production.withdrawals,false);
  assert.equal(health.providers[0].kycRequired,true);
  assert.equal(health.providers[0].executionReady,false);
  assert.equal(health.providers[0].ordersEnabled,false);
  assert.ok(health.providers[0].gates.includes("SCA_REQUIRED"));
 } finally { await new Promise(r=>server.close(r)); }
});
