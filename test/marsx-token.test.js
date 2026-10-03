import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync(new URL("../token/marsx-token-manifest.json", import.meta.url), "utf8"));

test("MARSX genesis is exactly 1B across seven vaults", () => {
  assert.equal(manifest.allocations.length, 7);
  assert.equal(manifest.allocations.reduce((s,a)=>s+BigInt(a.amount),0n), 1_000_000_000n);
  assert.equal(manifest.allocations.reduce((s,a)=>s+a.percent,0), 100);
});

test("MARSX has no permanent delegate or forced user burn", () => {
  assert.equal(manifest.authorities.permanentDelegate, false);
  assert.equal(manifest.authorities.userBalanceForcedBurn, false);
});

test("MARSX mainnet and real-value features remain disabled", () => {
  assert.equal(manifest.mainnetEnabled, false);
  assert.equal(manifest.publicSaleEnabled, false);
  assert.equal(manifest.brokerageEnabled, false);
});

test("protocol burn floor is 500M", () => {
  assert.equal(BigInt(manifest.minimumProtocolBurnFloor), 500_000_000n);
});
