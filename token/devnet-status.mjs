import fs from "node:fs";
import { Connection } from "@solana/web3.js";
import { EXPECTED_WALLET, RPC_URL } from "./devnet-deployer/transaction-plan.mjs";
import {
  deploymentRecord, discoverDeployment, publicTransactionRecords, readDeploymentState,
} from "./devnet-deployer/chain-state.mjs";

if (process.env.SOLANA_CLUSTER && process.env.SOLANA_CLUSTER !== "devnet") {
  throw new Error("Only Solana Devnet is permitted.");
}
const connection = new Connection(RPC_URL, { commitment: "finalized", disableRetryOnRateLimit: true });
const addresses = await discoverDeployment(connection);
const state = await readDeploymentState(connection, addresses);
const transactions = await publicTransactionRecords(connection, state);
const balance = await connection.getBalance(EXPECTED_WALLET, "finalized");
const record = state.complete ? deploymentRecord(state, transactions) : null;
console.log(JSON.stringify(record ?? {
  network: "devnet", verifiedComplete: false, mintExists: state.mintExists,
  candidateMintAddress: state.mint.toBase58(), ownerPublicWallet: EXPECTED_WALLET.toBase58(),
  devnetLamports: balance, rawSupply: state.supply.toString(), verifiedAtSlot: state.verifiedAtSlot,
  transactions, vaults: state.vaults.map(item => ({ name: item.vault,
    candidateAddress: item.address.toBase58(), exists: item.exists, rawBalance: item.amount.toString() })),
}, null, 2));
if (process.argv.includes("--write")) {
  if (!record) throw new Error("No final deployment file was written: on-chain deployment is incomplete.");
  fs.writeFileSync(new URL("./devnet-deployment.json", import.meta.url), JSON.stringify(record, null, 2) + "\n");
}
