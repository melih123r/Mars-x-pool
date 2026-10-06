import test from "node:test";
import assert from "node:assert/strict";
import { order, quote } from "../global-engine/core.js";
import { PublicCryptoAdapter } from "../global-engine/adapters/public-crypto.js";
import { filterFreshQuotes } from "../global-engine/quality.js";

test("public crypto adapter normalizes a read-only response", async()=>{
  const old=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({price:"123.45"})});
  try {
    const a=new PublicCryptoAdapter({name:"demo",urlFor:()=>"https://example.invalid",parse:p=>p.price});
    const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO"},side:"BUY",amount:1});
    const q=await a.getQuote(o);
    assert.equal(q.price,123.45);
    await assert.rejects(()=>a.placeOrder(o),/disabled/);
  } finally { global.fetch=old; }
});

test("stale quotes are rejected before routing",()=>{
  const now=Date.now();
  const fresh=quote({venue:"fresh",price:100,timestamp:new Date(now-1000).toISOString()});
  const stale=quote({venue:"stale",price:1,timestamp:new Date(now-60000).toISOString()});
  assert.deepEqual(filterFreshQuotes([fresh,stale],{maxAgeMs:5000,now}).map(q=>q.venue),["fresh"]);
});
