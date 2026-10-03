import test from "node:test";
import assert from "node:assert/strict";
import { createProtectProvider, normalizeMoneyMinor, protectConfig } from "../protect/provider.js";

test("Protect defaults to sandbox and blocks live mode", async () => {
  assert.equal(protectConfig({}).provider, "sandbox");
  assert.throws(() => createProtectProvider({ MARSX_PROTECT_LIVE: "true" }), /protect_live_blocked/);
});

test("sandbox quote cannot become a policy without explicit consent", async () => {
  const provider = createProtectProvider({});
  const [product] = await provider.getProducts("FR");
  const quote = await provider.createQuote(product.id, { country: "FR" });
  assert.equal(quote.sandbox, true);
  await assert.rejects(() => provider.acceptQuote(quote.id, { accepted: false }), /protect_consent_required/);
  const policy = await provider.acceptQuote(quote.id, { accepted: true });
  assert.equal(policy.status, "sandbox_active");
  assert.match(policy.insurer, /NO COVERAGE/);
});

test("money uses integer minor units", () => {
  assert.equal(normalizeMoneyMinor(499), 499);
  assert.throws(() => normalizeMoneyMinor(4.99), /protect_invalid_money/);
});
