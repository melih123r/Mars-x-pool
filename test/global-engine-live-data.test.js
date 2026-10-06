import test from "node:test";
import assert from "node:assert/strict";
import { order, quote } from "../global-engine/core.js";
import { PublicCryptoAdapter } from "../global-engine/adapters/public-crypto.js";
import { filterFreshQuotes } from "../global-engine/quality.js";

test("public crypto adapter uses ask for BUY and scales fee by notional",async()=>{
 const oldFetch=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({bid:"123.40",ask:"123.50"})});
 try{
  const a=new PublicCryptoAdapter({name:"demo",urlFor:()=>"https://example.invalid",parse:p=>p,feeBps:10});
  const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO"},side:"BUY",amount:1000});
  const q=await a.getQuote(o);
  assert.equal(q.price,123.5); assert.equal(q.fee,1); assert.equal(q.metadata.bid,123.4); assert.equal(q.metadata.ask,123.5);
  await assert.rejects(()=>a.placeOrder(o),/disabled/);
 }finally{global.fetch=oldFetch;}
});

test("public crypto adapter uses bid for SELL",async()=>{
 const oldFetch=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({bid:"123.40",ask:"123.50"})});
 try{
  const a=new PublicCryptoAdapter({name:"demo",urlFor:()=>"https://example.invalid",parse:p=>p});
  const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO"},side:"SELL",amount:1000});
  assert.equal((await a.getQuote(o)).price,123.4);
 }finally{global.fetch=oldFetch;}
});

test("stale quotes are rejected before routing",()=>{
 const now=Date.now();
 const fresh=quote({venue:"fresh",price:100,timestamp:new Date(now-1000).toISOString()});
 const stale=quote({venue:"stale",price:1,timestamp:new Date(now-60000).toISOString()});
 assert.deepEqual(filterFreshQuotes([fresh,stale],{maxAgeMs:5000,now}).map(q=>q.venue),["fresh"]);
});
