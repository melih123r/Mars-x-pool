import test from "node:test";
import assert from "node:assert/strict";
import { instrument, order, quote } from "../global-engine/core.js";
import { PaperVenue } from "../global-engine/venue.js";
import { MarsXGlobalEngine } from "../global-engine/engine.js";

test("one universal order model supports crypto and equity", () => {
  assert.equal(instrument({symbol:"btc-usdt",assetClass:"crypto",quoteCurrency:"usdt"}).assetClass,"CRYPTO");
  assert.equal(instrument({symbol:"aapl",assetClass:"equity"}).assetClass,"EQUITY");
});

test("router selects lowest effective BUY quote", async () => {
  const o=order({instrument:{symbol:"BTC-USDT",assetClass:"CRYPTO",quoteCurrency:"USDT"},side:"BUY",amount:1000});
  const engine=new MarsXGlobalEngine([
    new PaperVenue("venue-a",["CRYPTO"],async()=>quote({venue:"venue-a",price:100,fee:1})),
    new PaperVenue("venue-b",["CRYPTO"],async()=>quote({venue:"venue-b",price:99,fee:0.5}))
  ]);
  const result=await engine.paperExecute(o);
  assert.equal(result.best.venue,"venue-b");
  assert.equal(result.execution.status,"FILLED");
  assert.equal(result.execution.paper,true);
});

test("same engine routes an equity order without core changes", async () => {
  const o=order({instrument:{symbol:"AAPL",assetClass:"EQUITY"},side:"SELL",amount:10});
  const engine=new MarsXGlobalEngine([
    new PaperVenue("equity-a",["EQUITY"],async()=>quote({venue:"equity-a",price:250,fee:0.1})),
    new PaperVenue("equity-b",["EQUITY"],async()=>quote({venue:"equity-b",price:251,fee:0.2}))
  ]);
  const result=await engine.paperExecute(o);
  assert.equal(result.best.venue,"equity-b");
});
