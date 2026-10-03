import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import {
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  decodeSetAuthorityInstruction,
} from "@solana/spl-token";
import {
  ALLOCATIONS,
  EXPECTED_WALLET,
  GENESIS_SUPPLY,
  buildGenesisTransactions,
  createEphemeralDeploymentKeys,
} from "../token/devnet-deployer/transaction-plan.mjs";

const DUMMY_BLOCKHASH = Keypair.generate().publicKey.toBase58();

function preparedPlan() {
  const keys = createEphemeralDeploymentKeys();
  const plan = buildGenesisTransactions({
    payer: EXPECTED_WALLET,
    mintKeypair: keys.mint,
    vaultEntries: keys.vaults,
    mintRent: 1_461_600,
    tokenAccountRent: 2_039_280,
    firstBlockhash: DUMMY_BLOCKHASH,
    secondBlockhash: DUMMY_BLOCKHASH,
  });
  plan.first.transaction.partialSign(...plan.first.partialSigners);
  plan.second.transaction.partialSign(...plan.second.partialSigners);
  return plan;
}

test("Devnet signer plan keeps seven allocations and exactly 1B MARSX", () => {
  assert.equal(ALLOCATIONS.length, 7);
  assert.equal(ALLOCATIONS.reduce((sum, item) => sum + item.amount, 0n), GENESIS_SUPPLY);
  assert.equal(ALLOCATIONS.reduce((sum, item) => sum + item.percent, 0), 100);
});

test("both owner-signable genesis transactions fit the Solana packet limit", () => {
  const plan = preparedPlan();
  const firstBytes = plan.first.transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  const secondBytes = plan.second.transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  assert.ok(firstBytes <= 1232, `transaction 1 is ${firstBytes} bytes`);
  assert.ok(secondBytes <= 1232, `transaction 2 is ${secondBytes} bytes`);
});

test("the final instruction permanently revokes Token-2022 mint authority", () => {
  const plan = preparedPlan();
  const instruction = plan.second.transaction.instructions.at(-1);
  assert.ok(instruction.programId.equals(TOKEN_2022_PROGRAM_ID));
  const decoded = decodeSetAuthorityInstruction(instruction, TOKEN_2022_PROGRAM_ID);
  assert.equal(decoded.data.authorityType, AuthorityType.MintTokens);
  assert.equal(decoded.data.newAuthority, null);
});
