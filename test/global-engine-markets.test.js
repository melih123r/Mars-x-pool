import test from "node:test";
import assert from "node:assert/strict";
import { marketCapabilities } from "../global-engine/api.js";
import { MetalsDevGoldAdapter } from "../global-engine/adapters/metals-dev.js";

test("six-market capability list fails closed without credentials",()=>{
 const m=marketCapabilities({});
 assert.equal(m.length,6);
 assert.equal(m.find(x=>x.symbol==="BTC-USD").status,"AVAILABLE");
 assert.equal(m.find(x=>x.symbol==="ETH-USD").status,"AVAILABLE");
 assert.equal(m.find(x=>x.symbol==="EUR-USD").status,"AVAILABLE_REFERENCE");
 assert.equal(m.find(x=>x.symbol==="XAU-USD").status,"CREDENTIAL_REQUIRED");
 assert.equal(m.find(x=>x.symbol==="AAPL").status,"CREDENTIAL_REQUIRED");
 assert.equal(m.find(x=>x.symbol==="SPY").status,"CREDENTIAL_REQUIRED");
});

test("capability list activates credential-gated feeds without enabling execution",()=>{
 const m=marketCapabilities({ALPACA_API_KEY:"x",ALPACA_API_SECRET:"y",METALS_DEV_API_KEY:"z"});
 assert.equal(m.find(x=>x.symbol==="XAU-USD").status,"AVAILABLE_REFERENCE");
 assert.equal(m.find(x=>x.symbol==="AAPL").status,"AVAILABLE");
 assert.equal(m.find(x=>x.symbol==="SPY").status,"AVAILABLE");
 assert.equal(m.every(x=>x.executionReady!==true),true);
});

test("gold adapter only supports XAU-USD and requires a key",async()=>{
 const a=new MetalsDevGoldAdapter({apiKey:""});
 assert.equal(a.supports({symbol:"XAU-USD",assetClass:"COMMODITY"}),true);
 assert.equal(a.supports({symbol:"XAG-USD",assetClass:"COMMODITY"}),false);
 await assert.rejects(()=>a.getQuote({instrument:{symbol:"XAU-USD",assetClass:"COMMODITY"},side:"BUY",amount:100}),/API key/);
});
