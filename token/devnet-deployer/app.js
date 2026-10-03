import Solflare from "@solflare-wallet/sdk";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { ACCOUNT_SIZE, MINT_SIZE } from "@solana/spl-token";
import {
  DECIMALS, EXPECTED_WALLET, NETWORK, RPC_URL, buildNextTransaction, transactionBytes,
} from "./transaction-plan.mjs";
import {
  assertDevnet, deploymentRecord, discoverDeployment, explorerTransaction,
  publicTransactionRecords, readDeploymentState,
} from "./chain-state.mjs";

const wallet = new Solflare({ network: NETWORK });
const connection = new Connection(RPC_URL, { commitment: "finalized", disableRetryOnRateLimit: true });
const $ = id => document.getElementById(id);
const elements = Object.fromEntries([
  "wallet", "balance", "mint", "supply", "authority", "status", "connect", "fund",
  "prepare", "sign-next", "record", "transactions", "review", "download",
].map(id => [id, $(id)]));
let addresses = null;
let state = null;
let prepared = null;
let finalRecord = null;
let busy = false;

function status(message, kind = "info") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function updateControls() {
  const connected = wallet.publicKey?.equals(EXPECTED_WALLET);
  elements.connect.disabled = busy || connected;
  elements.prepare.disabled = busy;
  elements.fund.disabled = busy;
  elements["sign-next"].disabled = busy || !connected || !prepared || Boolean(state?.complete);
  elements.download.disabled = !finalRecord;
}

function showTransactions(records) {
  elements.transactions.replaceChildren();
  for (const record of records) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = record.explorerUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = record.signature;
    item.append(link);
    if (record.confirmationStatus) item.append(` — ${record.confirmationStatus}`);
    elements.transactions.append(item);
  }
}

// Only public chain identifiers are saved. No wallet keys or SDK state is read.
function rememberPublicSignature(signature) {
  const key = "marsx-devnet-public-transactions-v2";
  try {
    const previous = JSON.parse(localStorage.getItem(key) || "[]");
    const record = { network: NETWORK, owner: EXPECTED_WALLET.toBase58(),
      mintAddress: state.mint.toBase58(), signature, explorerUrl: explorerTransaction(signature) };
    localStorage.setItem(key, JSON.stringify([...previous.filter(item => item.signature !== signature), record]));
  } catch { /* chain discovery still works when localStorage is unavailable */ }
}

async function refresh({ rediscover = false } = {}) {
  prepared = null;
  finalRecord = null;
  await assertDevnet(connection);
  if (!addresses || rediscover) addresses = await discoverDeployment(connection);
  state = await readDeploymentState(connection, addresses);
  const [balance, records] = await Promise.all([
    connection.getBalance(EXPECTED_WALLET, "finalized"), publicTransactionRecords(connection, state),
  ]);
  elements.wallet.textContent = EXPECTED_WALLET.toBase58() + (wallet.publicKey ? " — connected" : " — connection required for signing");
  elements.balance.textContent = `${(balance / 1_000_000_000).toFixed(6)} Devnet SOL`;
  elements.mint.textContent = state.mint.toBase58() + (state.mintExists ? " — found on Devnet" : " — unsigned address; not yet created");
  elements.supply.textContent = `${(state.supply / 10n ** BigInt(DECIMALS)).toLocaleString("en-US")} / 1,000,000,000 MARSX`;
  elements.authority.textContent = state.complete ? "Mint: null · Freeze: null · Permanent Delegate: absent" : "Mint: approved owner · Freeze: null · Permanent Delegate: absent";
  showTransactions(records);
  if (state.complete) {
    finalRecord = deploymentRecord(state, records);
    elements.record.textContent = JSON.stringify(finalRecord, null, 2);
    elements.review.textContent = "All seven vaults and the fixed supply verified. Mint authority is permanently null.";
    status("Devnet deployment is complete and verified. The public JSON record is ready.", "ok");
    return;
  }
  elements.record.textContent = "A final deployment record becomes available only after confirmed on-chain completion.";
  const [mintRent, tokenAccountRent, blockhash] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(MINT_SIZE),
    connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE),
    connection.getLatestBlockhash("confirmed"),
  ]);
  const plan = buildNextTransaction({ state, payer: EXPECTED_WALLET, mintRent,
    tokenAccountRent, blockhash: blockhash.blockhash });
  const fee = await connection.getFeeForMessage(plan.transaction.compileMessage(), "confirmed");
  if (fee.value === null) throw new Error("Unable to estimate the Devnet transaction fee. Refresh the plan.");
  const needed = plan.requiredRent + fee.value;
  const description = plan.kind === "revoke"
    ? "Final signature: permanently set mint authority to null. Exactly 1B MARSX and all seven vault balances have already verified on chain."
    : `Next signature: ${state.mintExists ? "continue the existing mint" : "create the mint"} and allocate ${plan.allocations.map(item => `${item.amount.toLocaleString("en-US")} MARSX → ${item.vault}`).join("; ")}. Mint authority stays with the owner until the separate final approval.`;
  elements.review.textContent = `${description} Estimated cost: ${(needed / 1_000_000_000).toFixed(9)} Devnet SOL.`;
  elements["sign-next"].textContent = plan.kind === "revoke" ? "Approve final mint authority revocation in Solflare" : "Review and approve the next Devnet allocation in Solflare";
  if (balance < needed) {
    status(`Waiting for test-only funding. Need ${(needed / 1_000_000_000).toFixed(9)} Devnet SOL for the next step; current balance ${(balance / 1_000_000_000).toFixed(9)}.`, "info");
    return;
  }
  const simulation = await connection.simulateTransaction(new VersionedTransaction(plan.transaction.compileMessage()), {
    sigVerify: false, commitment: "confirmed",
  });
  if (simulation.value.err) throw new Error(`Unsigned simulation failed: ${JSON.stringify(simulation.value.err)}`);
  prepared = { ...plan, blockhash };
  status("Existing chain state verified and the next unsigned transaction simulated. Connect the owner wallet and approve only this step.", "ok");
}

async function run(action) {
  if (busy) return;
  busy = true;
  prepared = null;
  updateControls();
  try { await action(); } catch (error) { status(error.message, "error"); }
  finally { busy = false; updateControls(); }
}

wallet.on("connect", () => run(async () => {
  if (!wallet.publicKey?.equals(EXPECTED_WALLET)) {
    await wallet.disconnect();
    throw new Error(`Only the approved owner wallet may connect: ${EXPECTED_WALLET.toBase58()}`);
  }
  await refresh({ rediscover: true });
}));
wallet.on("disconnect", () => { prepared = null; updateControls(); });

elements.connect.addEventListener("click", async () => {
  try { await assertDevnet(connection); await wallet.connect(); }
  catch (error) { status(error.message, "error"); }
});
elements.prepare.addEventListener("click", () => run(() => refresh({ rediscover: true })));
elements.fund.addEventListener("click", () => run(async () => {
  await assertDevnet(connection);
  status("Requesting 0.1 test-only Devnet SOL. No wallet signature is requested.");
  const signature = await connection.requestAirdrop(EXPECTED_WALLET, 100_000_000);
  const result = await connection.confirmTransaction(signature, "finalized");
  if (result.value.err) throw new Error("Test-only funding transaction failed.");
  await refresh({ rediscover: true });
}));

elements["sign-next"].addEventListener("click", () => run(async () => {
  if (!wallet.publicKey?.equals(EXPECTED_WALLET)) throw new Error("Connect the approved owner wallet.");
  // Always re-read finalized balances before each wallet prompt. Retry after an
  // ambiguous send discovers the actual chain result rather than minting twice.
  await refresh({ rediscover: true });
  if (state.complete) return;
  if (!prepared) throw new Error("The next step is not ready. Check Devnet funding and unsigned simulation.");
  const plan = prepared;
  prepared = null;
  updateControls();
  status(`Waiting for your Solflare approval: ${plan.kind === "revoke" ? "permanent mint authority revocation" : "next Devnet allocation"}.`);
  const signature = await wallet.signAndSendTransaction(plan.transaction, {
    skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5,
  });
  rememberPublicSignature(signature);
  showTransactions([{ signature, explorerUrl: explorerTransaction(signature), confirmationStatus: "submitted; checking finalization" }]);
  status(`Submitted: ${signature}. Waiting for finalized chain confirmation.`);
  const result = await connection.confirmTransaction({ signature, ...plan.blockhash }, "finalized");
  if (result.value.err) throw new Error(`The submitted transaction failed: ${JSON.stringify(result.value.err)}`);
  await refresh({ rediscover: true });
  // The next wallet prompt is never automatic; each step requires another click.
}));

elements.download.addEventListener("click", () => {
  if (!finalRecord) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(finalRecord, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "devnet-deployment.json";
  link.click();
  URL.revokeObjectURL(url);
});

status("Searching the approved wallet's Devnet history. No signature is requested.");
run(() => refresh({ rediscover: true }));
