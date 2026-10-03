import test from "node:test";
import assert from "node:assert/strict";
import { createProtectProvider, normalizeMoneyMinor, protectConfig } from "../protect/provider.js";

test("Protect defaults to sandbox and never allows sandbox live mode", () => {
  assert.equal(protectConfig({}).provider, "sandbox");
  assert.throws(() => createProtectProvider({ MARSX_PROTECT_LIVE: "true" }), /protect_sandbox_cannot_be_live/);
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

test("partner provider stays unavailable without issued credentials", async () => {
  const provider = createProtectProvider({ MARSX_PROTECT_PROVIDER: "komodi" });
  await assert.rejects(() => provider.getProducts("FR"), /credentials_or_contract_missing/);
});

test("live partner mode requires signed contract and regulatory approval", () => {
  assert.throws(() => createProtectProvider({
    MARSX_PROTECT_PROVIDER: "komodi",
    MARSX_PROTECT_LIVE: "true",
  }), /partner_contract_and_regulatory_gate/);
});

test("money uses integer minor units", () => {
  assert.equal(normalizeMoneyMinor(499), 499);
  assert.throws(() => normalizeMoneyMinor(4.99), /protect_invalid_money/);
});
