import test from "node:test";
import assert from "node:assert/strict";
import { order } from "../global-engine/core.js";
import { AlpacaMarketDataAdapter } from "../global-engine/adapters/alpaca.js";

const sampleOrder=()=>order({instrument:{symbol:"AAPL",assetClass:"EQUITY"},side:"BUY",amount:10});
const quoteBody=()=>({quote:{bp:249.9,ap:250.1,t:new Date().toISOString()}});

test("alpaca adapter uses ask for BUY and remains read-only",async()=>{
  const old=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>quoteBody()});
  try {
    const a=new AlpacaMarketDataAdapter({key:"test",secret:"test"});
    const o=sampleOrder();
    const q=await a.getQuote(o);
    assert.equal(q.price,250.1);
    assert.equal(q.metadata.bid,249.9);
    await assert.rejects(()=>a.placeOrder(o,q),/disabled/);
  } finally { global.fetch=old; }
});

test("alpaca adapter refuses missing credentials",async()=>{
  const a=new AlpacaMarketDataAdapter({key:"",secret:""});
  await assert.rejects(()=>a.getQuote(sampleOrder()),/credentials/);
});

test("alpaca read-only quote rejects redirects and carries a timeout signal",async()=>{
  const old=global.fetch;
  let options;
  global.fetch=async(_url,input)=>{
    options=input;
    return new Response(JSON.stringify(quoteBody()),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    await new AlpacaMarketDataAdapter({key:"test",secret:"test",timeoutMs:50}).getQuote(sampleOrder());
    assert.equal(options.redirect,"error");
    assert.ok(options.signal instanceof AbortSignal);
  } finally { global.fetch=old; }
});

test("alpaca retries one rate-limited read then succeeds",async()=>{
  const old=global.fetch;
  let calls=0;
  global.fetch=async()=>{
    calls++;
    if(calls===1)return new Response(JSON.stringify({message:"rate limited"}),{status:429,headers:{"retry-after":"0"}});
    return new Response(JSON.stringify(quoteBody()),{status:200});
  };
  try {
    const q=await new AlpacaMarketDataAdapter({key:"test",secret:"test",maxAttempts:2,retryBaseMs:1}).getQuote(sampleOrder());
    assert.equal(q.price,250.1);
    assert.equal(calls,2);
  } finally { global.fetch=old; }
});

test("alpaca does not retry non-retryable 4xx and returns a sanitized class",async()=>{
  const old=global.fetch;
  let calls=0;
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({secret:"DO_NOT_LEAK"}),{status:400});};
  try {
    await assert.rejects(
      ()=>new AlpacaMarketDataAdapter({key:"test",secret:"test",maxAttempts:3}).getQuote(sampleOrder()),
      error=>error.status===400&&error.code==="ALPACA_INVALID_REQUEST"&&error.retryable===false&&!String(error.message).includes("DO_NOT_LEAK")
    );
    assert.equal(calls,1);
  } finally { global.fetch=old; }
});

test("alpaca rejects oversized declared quote responses before parsing",async()=>{
  const old=global.fetch;
  let read=false;
  global.fetch=async()=>({
    ok:true,
    status:200,
    headers:{get:name=>name.toLowerCase()==="content-length"?"65":null},
    text:async()=>{read=true;return JSON.stringify(quoteBody());}
  });
  try {
    await assert.rejects(
      ()=>new AlpacaMarketDataAdapter({key:"test",secret:"test",maxResponseBytes:64}).getQuote(sampleOrder()),
      error=>error.code==="ALPACA_RESPONSE_TOO_LARGE"&&error.retryable===false
    );
    assert.equal(read,false);
  } finally { global.fetch=old; }
});
