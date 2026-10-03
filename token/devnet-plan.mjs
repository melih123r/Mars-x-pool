import fs from "node:fs";
import crypto from "node:crypto";

const manifest = JSON.parse(fs.readFileSync(new URL("./marsx-token-manifest.json", import.meta.url), "utf8"));
const cluster = process.env.SOLANA_CLUSTER ?? "devnet";

if (cluster !== "devnet") {
  throw new Error("Safety stop: MARSX preparation is devnet-only.");
}

const plan = {
  schema: "marsx-devnet-genesis-plan/v1",
  cluster,
  tokenProgram: manifest.tokenProgram,
  name: manifest.name,
  symbol: manifest.symbol,
  decimals: manifest.decimals,
  supply: manifest.maxGenesisSupply,
  permanentDelegate: false,
  freezeAuthority: null,
  mintAuthorityAfterGenesis: null,
  allocations: manifest.allocations.map(({vault, amount, percent}) => ({vault, amount, percent})),
  burnFloor: manifest.minimumProtocolBurnFloor,
  mainnetEnabled: false
};

const canonical = JSON.stringify(plan);
console.log(JSON.stringify({...plan, planSha256: crypto.createHash("sha256").update(canonical).digest("hex")}, null, 2));
