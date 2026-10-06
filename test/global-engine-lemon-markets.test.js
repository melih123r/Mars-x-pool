import test from "node:test";
import assert from "node:assert/strict";
import { LemonBrokerAdapter } from "../global-engine/adapters/lemon-markets.js";

test("lemon adapter is fail-closed without credentials", async () => {
  const a=new LemonBrokerAdapter({apiKey:"",baseUrl:"https://example.invalid"});
  assert.equal(a.configured(),false);
  await assert.rejects(()=>a.getAccount("acct-1"),/credential is not configured/);
});

test("lemon order submission is disabled by default", async () => {
  const a=new LemonBrokerAdapter({apiKey:"test-only",baseUrl:"https://example.invalid"});
  await assert.rejects(()=>a.createOrder("acct-1",{side:"buy"}),/order submission disabled/);
});

test("generic live execution remains disabled", async () => {
  const a=new LemonBrokerAdapter({apiKey:"test-only"});
  await assert.rejects(()=>a.placeOrder(),/generic live execution disabled/);
});
