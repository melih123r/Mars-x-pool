import { TOKEN_2022_PROGRAM_ID, ACCOUNT_SIZE, MINT_SIZE, unpackAccount, unpackMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import {
  ALLOCATIONS, DECIMALS, DEVNET_GENESIS_HASH, EXPECTED_WALLET,
  GENESIS_SUPPLY, NETWORK, PLAN_SHA256, RAW_GENESIS_SUPPLY,
  deriveDeploymentAddresses, rawAmount,
} from "./transaction-plan.mjs";

const OWNER = EXPECTED_WALLET.toBase58();
const PROGRAM = TOKEN_2022_PROGRAM_ID.toBase58();

export async function assertDevnet(connection) {
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
    throw new Error("Network verification failed. Only Solana Devnet is permitted.");
  }
}

export function explorerTransaction(signature) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error("Invalid public transaction signature.");
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export async function readHistory(connection, address) {
  const signatures = [];
  let before;
  for (let page = 0; page < 5; page += 1) {
    const entries = await connection.getSignaturesForAddress(address, { limit: 100, before }, "finalized");
    signatures.push(...entries);
    if (entries.length < 100) break;
    before = entries.at(-1).signature;
    if (page === 4) throw new Error("History is too long to prove a new mint is safe. Supply the previous public mint address.");
  }
  const successful = signatures.filter(item => item.err === null).reverse();
  const records = [];
  for (let index = 0; index < successful.length; index += 10) {
    const batch = successful.slice(index, index + 10);
    const transactions = await connection.getParsedTransactions(
      batch.map(item => item.signature), { commitment: "finalized", maxSupportedTransactionVersion: 0 },
    );
    for (let offset = 0; offset < batch.length; offset += 1) {
      const transaction = transactions[offset];
      if (!transaction) throw new Error("RPC omitted an existing transaction. Retry discovery before minting.");
      if (transaction.meta?.err !== null) throw new Error("Transaction status changed during discovery.");
      records.push({ ...batch[offset], transaction });
    }
  }
  return records;
}

function tokenInstructions(record) {
  return record.transaction.transaction.message.instructions.filter(
    item => item.programId.toBase58() === PROGRAM && item.parsed,
  );
}

function checkedMints(record, mint) {
  return tokenInstructions(record).filter(item => item.parsed.type === "mintToChecked" &&
    item.parsed.info.mint === mint && item.parsed.info.mintAuthority === OWNER);
}

function matchesAllocations(instructions, allocations) {
  return instructions.length === allocations.length && instructions.every((item, index) =>
    item.parsed.info.tokenAmount.decimals === DECIMALS &&
    item.parsed.info.tokenAmount.amount === rawAmount(allocations[index]).toString());
}

export function findLegacyGenesis(records) {
  const candidates = [];
  for (const record of records) {
    if (record.transaction.meta?.err !== null) continue;
    const message = record.transaction.transaction.message;
    if (message.accountKeys[0]?.pubkey.toBase58() !== OWNER || !message.accountKeys[0]?.signer) continue;
    for (const item of tokenInstructions(record)) {
      const { type, info } = item.parsed;
      if (type !== "initializeMint2" || info.decimals !== DECIMALS ||
          info.mintAuthority !== OWNER || info.freezeAuthority != null) continue;
      const mints = checkedMints(record, info.mint);
      if (!matchesAllocations(mints, ALLOCATIONS.slice(0, 3))) continue;
      const addresses = mints.map(instruction => instruction.parsed.info.account);
      if (new Set(addresses).size !== 3) throw new Error("Genesis used duplicate vault addresses.");
      const initializations = tokenInstructions(record).filter(instruction =>
        instruction.parsed.type === "initializeAccount3" &&
        instruction.parsed.info.owner === OWNER && instruction.parsed.info.mint === info.mint);
      if (addresses.some(address => !initializations.some(instruction => instruction.parsed.info.account === address))) continue;
      candidates.push({ mint: new PublicKey(info.mint), vaults: addresses.map(address => new PublicKey(address)), record });
    }
  }
  return candidates;
}

export async function discoverDeployment(connection) {
  await assertDevnet(connection);
  const records = await readHistory(connection, EXPECTED_WALLET);
  const deterministic = await deriveDeploymentAddresses();
  const candidates = findLegacyGenesis(records).filter(item => !item.mint.equals(deterministic.mint));
  if (candidates.length > 1) throw new Error("Multiple previous MARSX mints found. Select the public mint before continuing.");
  let addresses = deterministic;
  if (candidates.length === 1) {
    const candidate = candidates[0];
    if (await connection.getAccountInfo(deterministic.mint, "finalized")) {
      throw new Error("Both a legacy and a resumable mint exist. No automatic new mint is permitted.");
    }
    addresses = await deriveDeploymentAddresses(candidate.mint);
    candidate.vaults.forEach((address, index) => { addresses.vaults[index] = { ...addresses.vaults[index], address, seed: null }; });
    for (const record of records) {
      const mints = checkedMints(record, candidate.mint.toBase58());
      if (matchesAllocations(mints, ALLOCATIONS.slice(3))) {
        mints.forEach((item, index) => {
          addresses.vaults[index + 3] = { ...addresses.vaults[index + 3], address: new PublicKey(item.parsed.info.account), seed: null };
        });
      }
    }
  }
  // A current owner token account without corresponding retrievable history is
  // a reason to stop, never proof that a new mint can safely be created.
  const owned = await connection.getTokenAccountsByOwner(EXPECTED_WALLET, { programId: TOKEN_2022_PROGRAM_ID }, "finalized");
  const relevantMints = new Set([addresses.mint.toBase58()]);
  for (const entry of owned.value) {
    const account = unpackAccount(entry.pubkey, entry.account, TOKEN_2022_PROGRAM_ID);
    if (!relevantMints.has(account.mint.toBase58()) && ALLOCATIONS.some(item => account.amount === rawAmount(item))) {
      throw new Error("Another possible MARSX allocation exists. Resolve its public mint before creating anything.");
    }
  }
  return { ...addresses, legacy: candidates.length === 1 };
}

export function decodeDeploymentSnapshot(addresses, infos, slot) {
  if (infos.length !== 8 || addresses.vaults.length !== 7) throw new Error("Incomplete deployment snapshot.");
  if (new Set(addresses.vaults.map(item => item.address.toBase58())).size !== 7) throw new Error("Vault addresses must be distinct.");
  const mintAccount = infos[0];
  if (!mintAccount && infos.slice(1).some(Boolean)) throw new Error("Vault accounts exist without the expected mint.");
  let mint = null;
  if (mintAccount) {
    if (!mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID) || mintAccount.data.length !== MINT_SIZE) {
      throw new Error("Mint must be plain Token-2022 with no extensions or Permanent Delegate.");
    }
    mint = unpackMint(addresses.mint, mintAccount, TOKEN_2022_PROGRAM_ID);
    if (!mint.isInitialized || mint.decimals !== DECIMALS || mint.freezeAuthority !== null ||
        (mint.mintAuthority !== null && !mint.mintAuthority.equals(EXPECTED_WALLET))) {
      throw new Error("Unexpected decimals, mint authority, or freeze authority.");
    }
    if (mint.supply > RAW_GENESIS_SUPPLY) throw new Error("Mint already exceeds the fixed 1B supply.");
  }
  let total = 0n;
  const vaults = addresses.vaults.map((entry, index) => {
    const info = infos[index + 1];
    if (!info) return { ...entry, exists: false, amount: 0n, owner: null, mint: null };
    if (info.data.length !== ACCOUNT_SIZE) throw new Error(`Unexpected vault extensions: ${entry.vault}.`);
    const account = unpackAccount(entry.address, info, TOKEN_2022_PROGRAM_ID);
    if (!account.isInitialized || account.isFrozen || !account.owner.equals(EXPECTED_WALLET) ||
        !account.mint.equals(addresses.mint) || account.delegate !== null ||
        (account.amount !== 0n && account.amount !== rawAmount(ALLOCATIONS[index]))) {
      throw new Error(`Unexpected vault state: ${entry.vault}.`);
    }
    total += account.amount;
    return { ...entry, exists: true, amount: account.amount, owner: account.owner, mint: account.mint };
  });
  if ((!mint && total !== 0n) || (mint && total !== mint.supply)) {
    throw new Error("Supply does not equal the verified vault balances. No mint or revocation is allowed.");
  }
  if (mint?.mintAuthority === null && (total !== RAW_GENESIS_SUPPLY || vaults.some(item => !item.exists))) {
    throw new Error("Authority was revoked before all seven allocations completed.");
  }
  return { ...addresses, vaults, mintExists: Boolean(mint), decimals: mint?.decimals ?? DECIMALS,
    supply: mint?.supply ?? 0n, mintAuthority: mint ? mint.mintAuthority : EXPECTED_WALLET,
    freezeAuthority: null, permanentDelegate: false, verifiedAtSlot: slot,
    complete: Boolean(mint && mint.mintAuthority === null && total === RAW_GENESIS_SUPPLY) };
}

export async function readDeploymentState(connection, addresses) {
  await assertDevnet(connection);
  const snapshot = await connection.getMultipleAccountsInfoAndContext(
    [addresses.mint, ...addresses.vaults.map(item => item.address)], { commitment: "finalized" },
  );
  return decodeDeploymentSnapshot(addresses, snapshot.value, snapshot.context.slot);
}

export async function publicTransactionRecords(connection, state) {
  if (!state.mintExists) return [];
  const records = await readHistory(connection, state.mint);
  return records.filter(record => tokenInstructions(record).some(item =>
    ["initializeMint2", "mintToChecked", "setAuthority"].includes(item.parsed.type) &&
    (item.parsed.info.mint === state.mint.toBase58() || item.parsed.info.account === state.mint.toBase58())))
    .map(record => ({ signature: record.signature, explorerUrl: explorerTransaction(record.signature),
      slot: record.slot, blockTime: record.blockTime, confirmationStatus: record.confirmationStatus }));
}

export function deploymentRecord(state, transactions) {
  if (!state.complete || !transactions.length) throw new Error("A final deployment record requires verified completion and actual chain signatures.");
  const deploymentTimes = transactions.map(item => item.blockTime).filter(value => value != null);
  return { network: NETWORK, genesisHash: DEVNET_GENESIS_HASH, mintAddress: state.mint.toBase58(),
    ownerPublicWallet: OWNER, tokenProgram: "Token-2022", tokenProgramAddress: PROGRAM,
    decimals: DECIMALS, totalSupply: GENESIS_SUPPLY.toString(), rawTotalSupply: RAW_GENESIS_SUPPLY.toString(),
    mintAuthority: null, freezeAuthority: null, permanentDelegate: false,
    vaults: state.vaults.map((entry, index) => ({ name: entry.vault, address: entry.address.toBase58(),
      owner: OWNER, amount: ALLOCATIONS[index].amount.toString(), percent: entry.percent })),
    transactionSignatures: transactions.map(item => item.signature), transactions,
    deployedAt: deploymentTimes.length ? new Date(Math.max(...deploymentTimes) * 1000).toISOString() : null,
    verifiedAt: new Date().toISOString(), verifiedAtSlot: state.verifiedAtSlot,
    planSha256: PLAN_SHA256, verified: true };
}
