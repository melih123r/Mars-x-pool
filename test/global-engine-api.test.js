import test from "node:test";
import assert from "node:assert/strict";
import { createApi, demoChartRows } from "../global-engine/api.js";
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
  assert.ok(health.candidates.some(p=>p.id==="upvest"));
  assert.ok(health.candidates.every(p=>p.executionReady===false));
  assert.ok(health.selectionPolicy.blocked.includes("KYC bypass"));
  assert.equal(health.providers[0].kycRequired,true);
  assert.equal(health.providers[0].executionReady,false);
  assert.equal(health.providers[0].ordersEnabled,false);
  assert.ok(health.providers[0].gates.includes("PROVIDER_CREDENTIAL"));
  const readiness=await (await fetch(base+"/broker/readiness")).json();
  assert.equal(readiness.mode,"BROKER_PRODUCTION_READINESS");
  assert.equal(readiness.provider.readiness.liveTradingReady,false);
 } finally { await new Promise(r=>server.close(r)); }
});

test("broker production readiness requires every explicit gate",async()=>{
 const previous={
  LEMON_MARKETS_API_KEY:process.env.LEMON_MARKETS_API_KEY,
  LEMON_MARKETS_BASE_URL:process.env.LEMON_MARKETS_BASE_URL,
  MARSX_LEMON_ALLOW_ORDERS:process.env.MARSX_LEMON_ALLOW_ORDERS,
  MARSX_LEMON_ALLOW_WITHDRAWALS:process.env.MARSX_LEMON_ALLOW_WITHDRAWALS,
  MARSX_BROKER_PRODUCTION_APPROVED:process.env.MARSX_BROKER_PRODUCTION_APPROVED,
  MARSX_KYC_PROVIDER_VERIFIED:process.env.MARSX_KYC_PROVIDER_VERIFIED,
  MARSX_SCA_PROVIDER_ENABLED:process.env.MARSX_SCA_PROVIDER_ENABLED
 };
 Object.assign(process.env,{
  LEMON_MARKETS_API_KEY:"test-only",
  LEMON_MARKETS_BASE_URL:"https://api.lemon.markets/v1",
  MARSX_LEMON_ALLOW_ORDERS:"true",
  MARSX_LEMON_ALLOW_WITHDRAWALS:"true",
  MARSX_BROKER_PRODUCTION_APPROVED:"true",
  MARSX_KYC_PROVIDER_VERIFIED:"true",
  MARSX_SCA_PROVIDER_ENABLED:"true"
 });
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await fetch(base+"/broker/health")).json();
  assert.equal(health.mode,"PRODUCTION_REVIEW_READY");
  assert.equal(health.production.liveTrading,false);
  assert.equal(health.production.withdrawals,false);
  assert.equal(health.production.custody,false);
  assert.equal(health.providers[0].executionReady,true);
  assert.deepEqual(health.providers[0].readiness.missing,[]);
  const order=await fetch(base+"/broker/order",{method:"POST"});
  assert.equal(order.status,404);
 } finally {
  await new Promise(r=>server.close(r));
  for(const [key,value] of Object.entries(previous)) value===undefined?delete process.env[key]:process.env[key]=value;
 }
});

test("chart snapshot exposes candles and indicators without enabling execution",async()=>{
 const engine=new MarsXGlobalEngine([new PaperVenue("paper",["CRYPTO"],async()=>quote({venue:"paper",price:100,fee:0}))]);
 const server=createApi(engine); await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const chart=await (await fetch(base+"/chart/snapshot?symbol=BTC-USD&timeframe=1m")).json();
  assert.equal(chart.mode,"READ_ONLY");
  assert.equal(chart.executionReady,false);
  assert.equal(chart.symbol,"BTC-USD");
  assert.ok(chart.series.candles.length>=90);
  assert.equal(chart.series.indicators.sma20.length,chart.series.candles.length);
  assert.equal(chart.interaction.timeframeSelector,true);
 } finally { await new Promise(r=>server.close(r)); }
});

test("demo chart rows are deterministic and valid OHLC",()=>{
 const rows=demoChartRows({now:1_800_000_000_000,limit:8,base:100});
 assert.equal(rows.length,8);
 assert.deepEqual(rows,demoChartRows({now:1_800_000_000_000,limit:8,base:100}));
 for(const row of rows){
  assert.ok(row.high>=Math.max(row.open,row.close));
  assert.ok(row.low<=Math.min(row.open,row.close));
 }
});
