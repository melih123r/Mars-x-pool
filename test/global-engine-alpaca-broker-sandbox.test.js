import test from "node:test";
import assert from "node:assert/strict";
import { AlpacaBrokerSandboxAdapter } from "../global-engine/adapters/alpaca-broker-sandbox.js";

test("Alpaca Broker sandbox is fail-closed without credentials", async()=>{
 const a=new AlpacaBrokerSandboxAdapter({clientId:"",clientSecret:""});
 assert.equal(a.configured(),false);
 await assert.rejects(()=>a.getAccount("acct"),/credentials are not configured/);
});

test("Alpaca Broker sandbox order submission is disabled by default", async()=>{
 const a=new AlpacaBrokerSandboxAdapter({clientId:"id",clientSecret:"secret",allowOrders:false});
 await assert.rejects(()=>a.createOrder("acct",{symbol:"AAPL"}),/order submission disabled/);
});

test("generic live execution is always disabled", async()=>{
 const a=new AlpacaBrokerSandboxAdapter({clientId:"id",clientSecret:"secret"});
 await assert.rejects(()=>a.placeOrder(),/generic live execution disabled/);
});
