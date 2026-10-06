import fs from "node:fs";
import assert from "node:assert/strict";

const manifest = JSON.parse(fs.readFileSync(new URL("./marsx-token-manifest.json", import.meta.url), "utf8"));
const total = manifest.allocations.reduce((sum, a) => sum + BigInt(a.amount), 0n);
const pct = manifest.allocations.reduce((sum, a) => sum + a.percent, 0);

assert.equal(manifest.network, "solana");
assert.equal(manifest.tokenProgram, "Token-2022");
assert.equal(manifest.decimals, 9);
assert.equal(total, BigInt(manifest.maxGenesisSupply));
assert.equal(pct, 100);
assert.equal(manifest.allocations.length, 7);
assert.equal(manifest.authorities.permanentDelegate, false);
assert.equal(manifest.authorities.postGenesisMinting, false);
assert.equal(manifest.authorities.userBalanceForcedBurn, false);
assert.equal(manifest.mainnetEnabled, false);
assert.equal(manifest.publicSaleEnabled, false);
assert.equal(manifest.brokerageEnabled, false);
assert.ok(BigInt(manifest.minimumProtocolBurnFloor) <= total);

console.log("MARSX manifest OK");
console.log({ supply: total.toString(), allocations: manifest.allocations.length, decimals: manifest.decimals });
