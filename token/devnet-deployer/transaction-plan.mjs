import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  AuthorityType,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeAccount3Instruction,
  createInitializeMint2Instruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
} from "@solana/spl-token";

export const NETWORK = "devnet";
export const RPC_URL = "https://api.devnet.solana.com";
export const EXPECTED_WALLET = new PublicKey(
  "5eM82VLPwkKWSmBEn9KEfcGhTkCfN97ZUS1Fe8bfpWQW",
);
export const DECIMALS = 9;
export const GENESIS_SUPPLY = 1_000_000_000n;
export const RAW_GENESIS_SUPPLY = GENESIS_SUPPLY * 10n ** BigInt(DECIMALS);
export const PLAN_SHA256 =
  "12316d0385b27eba3fa200dd0ad4b305c7b8d71a3dfbb64f2c0e4a1b04632201";

export const ALLOCATIONS = Object.freeze([
  { vault: "pool-user-rewards", amount: 250_000_000n, percent: 25 },
  { vault: "ecosystem-growth", amount: 200_000_000n, percent: 20 },
  { vault: "foundation-treasury", amount: 180_000_000n, percent: 18 },
  { vault: "liquidity-reserve", amount: 150_000_000n, percent: 15 },
  { vault: "founder-initial-unlock", amount: 20_000_000n, percent: 2 },
  { vault: "founder-vesting", amount: 100_000_000n, percent: 10 },
  { vault: "team-future-contributors", amount: 100_000_000n, percent: 10 },
]);

export function createEphemeralDeploymentKeys() {
  return {
    mint: Keypair.generate(),
    vaults: ALLOCATIONS.map(({ vault }) => ({ vault, keypair: Keypair.generate() })),
  };
}

function addVaultInstructions({
  transaction,
  payer,
  mint,
  vaultEntry,
  allocation,
  tokenAccountRent,
}) {
  const vault = vaultEntry.keypair.publicKey;
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: vault,
      lamports: tokenAccountRent,
      space: ACCOUNT_SIZE,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeAccount3Instruction(
      vault,
      mint,
      payer,
      TOKEN_2022_PROGRAM_ID,
    ),
    createMintToCheckedInstruction(
      mint,
      vault,
      payer,
      allocation.amount * 10n ** BigInt(DECIMALS),
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );
}

export function buildGenesisTransactions({
  payer,
  mintKeypair,
  vaultEntries,
  mintRent,
  tokenAccountRent,
  firstBlockhash,
  secondBlockhash,
}) {
  if (!payer.equals(EXPECTED_WALLET)) {
    throw new Error("Safety stop: connected wallet is not the approved owner wallet.");
  }
  if (vaultEntries.length !== ALLOCATIONS.length) {
    throw new Error("Safety stop: exactly seven vault accounts are required.");
  }

  const mint = mintKeypair.publicKey;
  const first = new Transaction({
    feePayer: payer,
    recentBlockhash: firstBlockhash,
  });
  first.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      lamports: mintRent,
      space: MINT_SIZE,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mint,
      DECIMALS,
      payer,
      null,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  for (let index = 0; index < 3; index += 1) {
    addVaultInstructions({
      transaction: first,
      payer,
      mint,
      vaultEntry: vaultEntries[index],
      allocation: ALLOCATIONS[index],
      tokenAccountRent,
    });
  }

  const second = new Transaction({
    feePayer: payer,
    recentBlockhash: secondBlockhash,
  });
  for (let index = 3; index < ALLOCATIONS.length; index += 1) {
    addVaultInstructions({
      transaction: second,
      payer,
      mint,
      vaultEntry: vaultEntries[index],
      allocation: ALLOCATIONS[index],
      tokenAccountRent,
    });
  }
  second.add(
    createSetAuthorityInstruction(
      mint,
      payer,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  return {
    mint,
    first: {
      transaction: first,
      partialSigners: [mintKeypair, ...vaultEntries.slice(0, 3).map(({ keypair }) => keypair)],
    },
    second: {
      transaction: second,
      partialSigners: vaultEntries.slice(3).map(({ keypair }) => keypair),
    },
  };
}

export function requiredLamports({ mintRent, tokenAccountRent }) {
  return mintRent + tokenAccountRent * ALLOCATIONS.length + 50_000;
}

