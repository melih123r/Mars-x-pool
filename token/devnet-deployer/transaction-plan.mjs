import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ACCOUNT_SIZE, AuthorityType, MINT_SIZE, TOKEN_2022_PROGRAM_ID,
  createInitializeAccount3Instruction, createInitializeMint2Instruction,
  createMintToCheckedInstruction, createSetAuthorityInstruction,
} from "@solana/spl-token";

export const NETWORK = "devnet";
export const RPC_URL = "https://api.devnet.solana.com";
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const EXPECTED_WALLET = new PublicKey("5eM82VLPwkKWSmBEn9KEfcGhTkCfN97ZUS1Fe8bfpWQW");
export const DECIMALS = 9;
export const GENESIS_SUPPLY = 1_000_000_000n;
export const RAW_GENESIS_SUPPLY = GENESIS_SUPPLY * 10n ** BigInt(DECIMALS);
export const PLAN_SHA256 = "12316d0385b27eba3fa200dd0ad4b305c7b8d71a3dfbb64f2c0e4a1b04632201";
export const ALLOCATIONS = Object.freeze([
  { vault: "pool-user-rewards", amount: 250_000_000n, percent: 25 },
  { vault: "ecosystem-growth", amount: 200_000_000n, percent: 20 },
  { vault: "foundation-treasury", amount: 180_000_000n, percent: 18 },
  { vault: "liquidity-reserve", amount: 150_000_000n, percent: 15 },
  { vault: "founder-initial-unlock", amount: 20_000_000n, percent: 2 },
  { vault: "founder-vesting", amount: 100_000_000n, percent: 10 },
  { vault: "team-future-contributors", amount: 100_000_000n, percent: 10 },
]);

export const rawAmount = allocation => allocation.amount * 10n ** BigInt(DECIMALS);

// Public address labels, never wallet recovery phrases. CreateWithSeed needs
// only the approved owner's wallet signature; no account keypair is generated.
export async function deriveDeploymentAddresses(mintAddress = null) {
  const mintSeed = `marsx-mint-${PLAN_SHA256.slice(0, 20)}`;
  const mint = mintAddress ?? await PublicKey.createWithSeed(EXPECTED_WALLET, mintSeed, TOKEN_2022_PROGRAM_ID);
  const vaults = await Promise.all(ALLOCATIONS.map(async (allocation, index) => {
    const seed = `mx-v${index}-${mint.toBase58().slice(0, 24)}`;
    return { ...allocation, seed,
      address: await PublicKey.createWithSeed(EXPECTED_WALLET, seed, TOKEN_2022_PROGRAM_ID) };
  }));
  return { mint, mintSeed: mintAddress ? null : mintSeed, vaults };
}

export function assertOwner(payer) {
  if (!payer?.equals(EXPECTED_WALLET)) throw new Error("Connect the approved owner wallet before requesting a signature.");
}

export function assertRevocationReady(state) {
  if (!state.mintExists || state.supply !== RAW_GENESIS_SUPPLY ||
      state.decimals !== DECIMALS || state.freezeAuthority !== null ||
      state.permanentDelegate !== false || state.vaults.length !== ALLOCATIONS.length ||
      !state.mintAuthority?.equals(EXPECTED_WALLET)) {
    throw new Error("All seven vaults and exactly 1B MARSX must verify before authority revocation.");
  }
  for (let index = 0; index < ALLOCATIONS.length; index += 1) {
    const vault = state.vaults[index];
    if (!vault.exists || vault.amount !== rawAmount(ALLOCATIONS[index]) ||
        !vault.owner?.equals(EXPECTED_WALLET) || !vault.mint?.equals(state.mint)) {
      throw new Error(`Vault ${ALLOCATIONS[index].vault} is not ready for authority revocation.`);
    }
  }
}

function addCreation(transaction, address, seed, lamports, space) {
  if (!seed) throw new Error("Cannot create a recovered address without its public derivation label.");
  transaction.add(SystemProgram.createAccountWithSeed({ fromPubkey: EXPECTED_WALLET,
    newAccountPubkey: address, basePubkey: EXPECTED_WALLET, seed, lamports, space,
    programId: TOKEN_2022_PROGRAM_ID }));
}

export function transactionBytes(transaction) {
  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
}

export function buildNextTransaction({ state, payer, mintRent, tokenAccountRent, blockhash }) {
  assertOwner(payer);
  if (state.mintExists && state.mintAuthority === null) throw new Error("Mint authority is already revoked; no further mint transaction is allowed.");
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  if (state.supply === RAW_GENESIS_SUPPLY) {
    assertRevocationReady(state);
    transaction.add(createSetAuthorityInstruction(state.mint, payer, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID));
    return { transaction, kind: "revoke", allocations: [], requiredRent: 0 };
  }
  if (state.supply > RAW_GENESIS_SUPPLY || (state.mintExists && !state.mintAuthority?.equals(payer))) throw new Error("Unexpected mint supply or mint authority.");
  let requiredRent = 0;
  if (!state.mintExists) {
    addCreation(transaction, state.mint, state.mintSeed, mintRent, MINT_SIZE);
    transaction.add(createInitializeMint2Instruction(state.mint, DECIMALS, payer, null, TOKEN_2022_PROGRAM_ID));
    requiredRent += mintRent;
  }
  const allocations = [];
  for (let index = 0; index < ALLOCATIONS.length; index += 1) {
    const entry = state.vaults[index];
    const target = rawAmount(ALLOCATIONS[index]);
    if (entry.amount === target) continue;
    if (entry.amount !== 0n) throw new Error(`Unexpected balance for ${entry.vault}.`);
    const instructionCount = transaction.instructions.length;
    if (!entry.exists) {
      addCreation(transaction, entry.address, entry.seed, tokenAccountRent, ACCOUNT_SIZE);
      transaction.add(createInitializeAccount3Instruction(entry.address, state.mint, payer, TOKEN_2022_PROGRAM_ID));
    }
    transaction.add(createMintToCheckedInstruction(state.mint, entry.address, payer, target, DECIMALS, [], TOKEN_2022_PROGRAM_ID));
    let fits = false;
    try { fits = transactionBytes(transaction) <= 1232; } catch { /* packet overflow */ }
    if (!fits) {
      transaction.instructions.splice(instructionCount);
      if (!allocations.length) throw new Error("Transaction exceeds the Solana packet limit.");
      break;
    }
    if (!entry.exists) requiredRent += tokenAccountRent;
    allocations.push(ALLOCATIONS[index]);
  }
  if (!allocations.length) throw new Error("No allocation can be minted safely.");
  return { transaction, kind: "mint", allocations, requiredRent };
}
