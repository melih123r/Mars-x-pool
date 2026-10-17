import test from "node:test";
import assert from "node:assert/strict";
import { LemonBrokerAdapter } from "../global-engine/adapters/lemon-markets.js";

test("Lemon sandbox API rejects alternate TCP ports", () => {
  for (const port of [":444", ":8443", ":8080"]) {
    assert.throws(() => new LemonBrokerAdapter({apiKey:"fixture-only",baseUrl:`https://sandbox.api.lemon.markets${port}/v1`}), /invalid lemon.markets base URL/);
  }
  assert.doesNotThrow(() => new LemonBrokerAdapter({apiKey:"fixture-only",baseUrl:"https://sandbox.api.lemon.markets/v1"}));
});
