import test from "node:test";
import assert from "node:assert/strict";
import { order, quote } from "../global-engine/core.js";
import { PublicCryptoAdapter, bybitCryptoUsd, coinbaseCryptoUsd, krakenCryptoUsd } from "../global-engine/adapters/public-crypto.js";
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

test("Coinbase, Kraken and Bybit public adapters support ETH-USD",()=>{
 const eth={symbol:"ETH-USD",assetClass:"CRYPTO"};
 assert.equal(coinbaseCryptoUsd().supports(eth),true);
 assert.equal(krakenCryptoUsd().supports(eth),true);
 assert.equal(bybitCryptoUsd().supports(eth),true);
});

test("unsupported crypto symbols fail closed",()=>{
 const sol={symbol:"ADA-USD",assetClass:"CRYPTO"};
 assert.equal(coinbaseCryptoUsd().supports(sol),false);
 assert.equal(krakenCryptoUsd().supports(sol),false);
 assert.equal(bybitCryptoUsd().supports(sol),false);
});

test("Bybit adapter parses V5 ticker bid and ask without enabling execution",async()=>{
 const oldFetch=global.fetch;
 global.fetch=async url=>{
  assert.equal(String(url),"https://api.bybit.com/v5/market/tickers?category=spot&symbol=SOLUSDT");
  return {ok:true,json:async()=>({retCode:0,result:{list:[{bid1Price:"100.10",ask1Price:"100.20",ts:"1700000000000"}]}})};
 };
 try{
  const a=bybitCryptoUsd();
  const o=order({instrument:{symbol:"SOL-USD",assetClass:"CRYPTO"},side:"BUY",amount:1000});
  const q=await a.getQuote(o);
  assert.equal(q.venue,"bybit-public");
  assert.equal(q.price,100.2);
  assert.equal(q.metadata.executable,false);
  await assert.rejects(()=>a.placeOrder(o),/disabled/);
 }finally{global.fetch=oldFetch;}
});

test("stale quotes are rejected before routing",()=>{
 const now=Date.now();
 const fresh=quote({venue:"fresh",price:100,timestamp:new Date(now-1000).toISOString()});
 const stale=quote({venue:"stale",price:1,timestamp:new Date(now-60000).toISOString()});
 assert.deepEqual(filterFreshQuotes([fresh,stale],{maxAgeMs:5000,now}).map(q=>q.venue),["fresh"]);
});
