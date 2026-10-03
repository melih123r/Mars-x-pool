import Solflare from "@solflare-wallet/sdk";
import { Connection } from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getMint,
} from "@solana/spl-token";
import {
  ALLOCATIONS,
  DECIMALS,
  EXPECTED_WALLET,
  GENESIS_SUPPLY,
  NETWORK,
  PLAN_SHA256,
  RAW_GENESIS_SUPPLY,
  RPC_URL,
  buildGenesisTransactions,
  createEphemeralDeploymentKeys,
  requiredLamports,
} from "./transaction-plan.mjs";

const wallet = new Solflare({ network: NETWORK });
const connection = new Connection(RPC_URL, "confirmed");

const elements = {
  wallet: document.querySelector("#wallet"),
  balance: document.querySelector("#balance"),
  mint: document.querySelector("#mint"),
  status: document.querySelector("#status"),
  connect: document.querySelector("#connect"),
  prepare: document.querySelector("#prepare"),
  signFirst: document.querySelector("#sign-first"),
  signSecond: document.querySelector("#sign-second"),
  record: document.querySelector("#record"),
};

let deployment = null;
let firstSignature = null;
let secondSignature = null;

async function rebuildPlanWithFreshBlockhashes() {
  const [firstBlockhash, secondBlockhash] = await Promise.all([
    connection.getLatestBlockhash("confirmed"),
    connection.getLatestBlockhash("confirmed"),
  ]);
  deployment.plan = buildGenesisTransactions({
    payer: wallet.publicKey,
    mintKeypair: deployment.keys.mint,
    vaultEntries: deployment.keys.vaults,
    mintRent: deployment.mintRent,
    tokenAccountRent: deployment.tokenAccountRent,
    firstBlockhash: firstBlockhash.blockhash,
    secondBlockhash: secondBlockhash.blockhash,
  });
}

function setStatus(message, kind = "info") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function assertConnectedOwner() {
  if (!wallet.publicKey || !wallet.publicKey.equals(EXPECTED_WALLET)) {
    throw new Error(`Connect the approved Solflare wallet: ${EXPECTED_WALLET.toBase58()}`);
  }
}

async function refreshBalance() {
  const balance = await connection.getBalance(EXPECTED_WALLET, "confirmed");
  elements.balance.textContent = `${(balance / 1_000_000_000).toFixed(6)} Devnet SOL`;
  return balance;
}

wallet.on("connect", async () => {
  try {
    assertConnectedOwner();
    elements.wallet.textContent = wallet.publicKey.toBase58();
    elements.prepare.disabled = false;
    await refreshBalance();
    setStatus("Approved owner wallet connected on Devnet.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
    await wallet.disconnect();
  }
});

wallet.on("disconnect", () => {
  elements.wallet.textContent = "Not connected";
  elements.prepare.disabled = true;
  elements.signFirst.disabled = true;
  elements.signSecond.disabled = true;
});

elements.connect.addEventListener("click", async () => {
  try {
    setStatus("Opening Solflare Devnet connection…");
    await wallet.connect();
  } catch (error) {
    setStatus(`Connection stopped: ${error.message}`, "error");
  }
});

elements.prepare.addEventListener("click", async () => {
  try {
    assertConnectedOwner();
    setStatus("Preparing the fixed Devnet-only transaction plan…");
    const [mintRent, tokenAccountRent, balance] =
      await Promise.all([
        connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE),
        refreshBalance(),
      ]);
    const needed = requiredLamports({ mintRent, tokenAccountRent });
    if (balance < needed) {
      throw new Error(
        `Insufficient Devnet SOL. Need at least ${(needed / 1_000_000_000).toFixed(6)} Devnet SOL.`,
      );
    }

    const keys = createEphemeralDeploymentKeys();
    deployment = {
      keys,
      mintRent,
      tokenAccountRent,
      plan: null,
    };

    await rebuildPlanWithFreshBlockhashes();

    deployment.plan.first.transaction.partialSign(...deployment.plan.first.partialSigners);
    deployment.plan.second.transaction.partialSign(...deployment.plan.second.partialSigners);
    const firstBytes = deployment.plan.first.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).length;
    const secondBytes = deployment.plan.second.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).length;
    if (firstBytes > 1232 || secondBytes > 1232) {
      throw new Error(`Safety stop: transaction packet too large (${firstBytes}/${secondBytes}).`);
    }

    elements.mint.textContent = deployment.plan.mint.toBase58();
    elements.signFirst.disabled = false;
    elements.signSecond.disabled = true;
    setStatus(
      `Ready. Packet sizes ${firstBytes} and ${secondBytes} bytes. No signature has been requested yet.`,
      "ok",
    );
  } catch (error) {
    deployment = null;
    elements.signFirst.disabled = true;
    elements.signSecond.disabled = true;
    setStatus(error.message, "error");
  }
});

elements.signFirst.addEventListener("click", async () => {
  try {
    assertConnectedOwner();
    if (!deployment) throw new Error("Prepare the transaction plan first.");
    elements.signFirst.disabled = true;
    await rebuildPlanWithFreshBlockhashes();
    deployment.plan.first.transaction.partialSign(...deployment.plan.first.partialSigners);
    setStatus("Waiting for Solflare approval for transaction 1 of 2…");
    firstSignature = await wallet.signAndSendTransaction(deployment.plan.first.transaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    });
    await connection.confirmTransaction(firstSignature, "confirmed");
    elements.signSecond.disabled = false;
    setStatus(
      `Transaction 1 confirmed: ${firstSignature}. Transaction 2 will mint the remaining allocations and permanently revoke mint authority.`,
      "ok",
    );
  } catch (error) {
    elements.signFirst.disabled = false;
    setStatus(`Transaction 1 stopped: ${error.message}`, "error");
  }
});

elements.signSecond.addEventListener("click", async () => {
  try {
    assertConnectedOwner();
    if (!deployment || !firstSignature) {
      throw new Error("Transaction 1 must confirm before transaction 2.");
    }
    elements.signSecond.disabled = true;
    await rebuildPlanWithFreshBlockhashes();
    deployment.plan.second.transaction.partialSign(...deployment.plan.second.partialSigners);
    setStatus("Waiting for Solflare approval for transaction 2 of 2…");
    secondSignature = await wallet.signAndSendTransaction(deployment.plan.second.transaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    });
    await connection.confirmTransaction(secondSignature, "confirmed");

    const mintAddress = deployment.plan.mint;
    const mintAccount = await connection.getAccountInfo(mintAddress, "confirmed");
    if (!mintAccount || !mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      throw new Error("Verification failed: mint is not owned by Token-2022.");
    }
    if (mintAccount.data.length !== MINT_SIZE) {
      throw new Error("Verification failed: unexpected mint extension data.");
    }
    const mintInfo = await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    if (mintInfo.decimals !== DECIMALS || mintInfo.supply !== RAW_GENESIS_SUPPLY) {
      throw new Error("Verification failed: decimals or total supply mismatch.");
    }
    if (mintInfo.mintAuthority !== null || mintInfo.freezeAuthority !== null) {
      throw new Error("Verification failed: an authority remains enabled.");
    }

    const vaults = [];
    let verifiedRawSupply = 0n;
    for (let index = 0; index < ALLOCATIONS.length; index += 1) {
      const allocation = ALLOCATIONS[index];
      const address = deployment.keys.vaults[index].keypair.publicKey;
      const account = await getAccount(
        connection,
        address,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
      );
      const expectedRawAmount = allocation.amount * 10n ** BigInt(DECIMALS);
      if (
        !account.owner.equals(EXPECTED_WALLET) ||
        !account.mint.equals(mintAddress) ||
        account.amount !== expectedRawAmount
      ) {
        throw new Error(`Verification failed for vault ${allocation.vault}.`);
      }
      verifiedRawSupply += account.amount;
      vaults.push({
        name: allocation.vault,
        address: address.toBase58(),
        owner: EXPECTED_WALLET.toBase58(),
        amount: allocation.amount.toString(),
        percent: allocation.percent,
      });
    }
    if (verifiedRawSupply !== RAW_GENESIS_SUPPLY) {
      throw new Error("Verification failed: vault balances do not sum to genesis supply.");
    }

    const record = {
      network: NETWORK,
      mintAddress: mintAddress.toBase58(),
      ownerPublicWallet: EXPECTED_WALLET.toBase58(),
      tokenProgram: "Token-2022",
      tokenProgramAddress: TOKEN_2022_PROGRAM_ID.toBase58(),
      decimals: DECIMALS,
      totalSupply: GENESIS_SUPPLY.toString(),
      mintAuthority: null,
      freezeAuthority: null,
      permanentDelegate: false,
      vaults,
      transactionSignatures: [firstSignature, secondSignature],
      deployedAt: new Date().toISOString(),
      planSha256: PLAN_SHA256,
      verified: true,
    };
    elements.record.textContent = JSON.stringify(record, null, 2);
    setStatus("MARSX Devnet genesis verified. Mint authority is permanently revoked.", "ok");
    await refreshBalance();
  } catch (error) {
    setStatus(`Final verification stopped: ${error.message}`, "error");
  }
});

elements.wallet.textContent = "Not connected";
elements.mint.textContent = "Not generated";
