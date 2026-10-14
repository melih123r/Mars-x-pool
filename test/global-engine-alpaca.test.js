import test from "node:test";
import assert from "node:assert/strict";
import { order } from "../global-engine/core.js";
import { AlpacaMarketDataAdapter } from "../global-engine/adapters/alpaca.js";

test("alpaca adapter uses ask for BUY and remains read-only",async()=>{
  const old=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({quote:{bp:249.9,ap:250.1,t:new Date().toISOString()}})});
  try {
    const a=new AlpacaMarketDataAdapter({key:"test",secret:"test"});
    const o=order({instrument:{symbol:"AAPL",assetClass:"EQUITY"},side:"BUY",amount:10});
    const q=await a.getQuote(o);
    assert.equal(q.price,250.1);
    assert.equal(q.metadata.bid,249.9);
    await assert.rejects(()=>a.placeOrder(o,q),/disabled/);
  } finally { global.fetch=old; }
});

test("alpaca adapter refuses missing credentials",async()=>{
  const a=new AlpacaMarketDataAdapter({key:"",secret:""});
  const o=order({instrument:{symbol:"AAPL",assetClass:"EQUITY"},side:"BUY",amount:10});
  await assert.rejects(()=>a.getQuote(o),/credentials/);
});
