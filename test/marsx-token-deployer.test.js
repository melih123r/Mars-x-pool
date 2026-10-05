import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PublicKey } from "@solana/web3.js";
import {
  ACCOUNT_SIZE, MINT_SIZE, AccountLayout, MintLayout, TOKEN_2022_PROGRAM_ID,
  AuthorityType, decodeMintToCheckedInstruction, decodeSetAuthorityInstruction,
} from "@solana/spl-token";
import {
  ALLOCATIONS, DEVNET_GENESIS_HASH, EXPECTED_WALLET, GENESIS_SUPPLY, RAW_GENESIS_SUPPLY,
  buildNextTransaction, deriveDeploymentAddresses, rawAmount, transactionBytes,
} from "../token/devnet-deployer/transaction-plan.mjs";
import {
  assertDevnet, decodeDeploymentSnapshot, deploymentRecord, discoverDeployment,
  findLegacyGenesis, readHistory,
} from "../token/devnet-deployer/chain-state.mjs";

const BLOCKHASH = PublicKey.default.toBase58();
const manifest = JSON.parse(fs.readFileSync(new URL("../token/marsx-token-manifest.json", import.meta.url), "utf8"));
const addresses = await deriveDeploymentAddresses();
const zero = PublicKey.default;
const info = data => ({ data, executable: false, lamports: 2_039_280, owner: TOKEN_2022_PROGRAM_ID });

function mintInfo(supply, revoked = false, options = {}) {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode({ mintAuthorityOption: revoked ? 0 : 1, mintAuthority: EXPECTED_WALLET,
    supply, decimals: 9, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: zero, ...options }, data);
  return info(data);
}
function vaultInfo(amount, options = {}) {
  const data = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode({ mint: addresses.mint, owner: EXPECTED_WALLET, amount,
    delegateOption: 0, delegate: zero, state: 1, isNativeOption: 0, isNative: 0n,
    delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: zero, ...options }, data);
  return info(data);
}
function snapshot(completed = 0, revoked = false) {
  const supply = ALLOCATIONS.slice(0, completed).reduce((sum, item) => sum + rawAmount(item), 0n);
  return [completed ? mintInfo(supply, revoked) : null,
    ...ALLOCATIONS.map((item, index) => index < completed ? vaultInfo(rawAmount(item)) : null)];
}
const next = state => buildNextTransaction({ state, payer: EXPECTED_WALLET,
  mintRent: 1_461_600, tokenAccountRent: 2_039_280, blockhash: BLOCKHASH });
const stateFor = completed => decodeDeploymentSnapshot(addresses, snapshot(completed), 100);

function genesisRecord({ freezeAuthority = null, failed = false, mintAuthority = EXPECTED_WALLET.toBase58() } = {}) {
  const mint = addresses.mint.toBase58();
  const parsed = (type, data) => ({ programId: TOKEN_2022_PROGRAM_ID, parsed: { type, info: data } });
  return { signature: "1".repeat(88), transaction: { meta: { err: failed ? { custom: 1 } : null },
    transaction: { message: { accountKeys: [{ pubkey: EXPECTED_WALLET, signer: true }], instructions: [
      parsed("initializeMint2", { mint, decimals: 9, mintAuthority, freezeAuthority }),
      ...ALLOCATIONS.slice(0, 3).flatMap((item, index) => [
        parsed("initializeAccount3", { account: addresses.vaults[index].address.toBase58(), mint, owner: EXPECTED_WALLET.toBase58() }),
        parsed("mintToChecked", { mint, account: addresses.vaults[index].address.toBase58(),
          mintAuthority: EXPECTED_WALLET.toBase58(), tokenAmount: { amount: rawAmount(item).toString(), decimals: 9 } }),
      ]),
    ] } } } };
}

test("signer allocations exactly match the PR manifest", () => {
  assert.equal(ALLOCATIONS.reduce((sum, item) => sum + item.amount, 0n), GENESIS_SUPPLY);
  assert.deepEqual(ALLOCATIONS.map(item => ({ vault: item.vault, amount: item.amount.toString(), percent: item.percent })), manifest.allocations);
});

test("public addresses are stable across reloads and all seven vaults are distinct", async () => {
  const again = await deriveDeploymentAddresses();
  assert.equal(again.mint.toBase58(), addresses.mint.toBase58());
  assert.deepEqual(again.vaults.map(item => item.address.toBase58()), addresses.vaults.map(item => item.address.toBase58()));
  assert.equal(new Set(addresses.vaults.map(item => item.address.toBase58())).size, 7);
});

test("every allocation stage fits the packet limit and requires only the owner signature", () => {
  let completed = 0;
  while (completed < ALLOCATIONS.length) {
    const plan = next(stateFor(completed));
    assert.equal(plan.kind, "mint");
    assert.ok(transactionBytes(plan.transaction) <= 1232);
    assert.equal(plan.transaction.compileMessage().header.numRequiredSignatures, 1);
    assert.ok(plan.allocations.length > 0);
    assert.ok(plan.transaction.instructions.filter(item => item.programId.equals(TOKEN_2022_PROGRAM_ID)).every(item => item.data[0] !== 6));
    completed += plan.allocations.length;
  }
});

test("resuming a 630M first transaction mints only the four missing allocations", () => {
  const state = stateFor(3);
  assert.equal(state.supply, 630_000_000n * 10n ** 9n);
  const plan = next(state);
  const mints = plan.transaction.instructions.filter(item => item.programId.equals(TOKEN_2022_PROGRAM_ID) && item.data[0] === 14)
    .map(item => decodeMintToCheckedInstruction(item, TOKEN_2022_PROGRAM_ID));
  assert.ok(mints.length > 0);
  assert.ok(mints.every(item => !addresses.vaults.slice(0, 3).some(vault => vault.address.equals(item.keys.destination.pubkey))));
  assert.equal(mints.reduce((sum, item) => sum + item.data.amount, 0n), plan.allocations.reduce((sum, item) => sum + rawAmount(item), 0n));
});

test("mint authority revocation is a separate transaction after seven exact balances verify", () => {
  const plan = next(stateFor(7));
  assert.equal(plan.kind, "revoke");
  assert.equal(plan.transaction.instructions.length, 1);
  const decoded = decodeSetAuthorityInstruction(plan.transaction.instructions[0], TOKEN_2022_PROGRAM_ID);
  assert.equal(decoded.data.authorityType, AuthorityType.MintTokens);
  assert.equal(decoded.data.newAuthority, null);
});

test("missing vault balances cannot pass the final revocation gate", () => {
  const state = stateFor(7);
  state.vaults[6].amount = 0n;
  assert.throws(() => next(state), /not ready/);
});

test("wrong owner is refused before transaction construction", () => {
  assert.throws(() => buildNextTransaction({ state: stateFor(0), payer: zero,
    mintRent: 1, tokenAccountRent: 1, blockhash: BLOCKHASH }), /approved owner/);
});

test("non-Devnet genesis hashes stop discovery without any other RPC calls", async () => {
  let historyCalls = 0;
  await assert.rejects(discoverDeployment({ getGenesisHash: async () => "wrong-network",
    getSignaturesForAddress: async () => { historyCalls += 1; return []; } }), /Only Solana Devnet/);
  assert.equal(historyCalls, 0);
  await assertDevnet({ getGenesisHash: async () => DEVNET_GENESIS_HASH });
});

test("freeze authority, mint extensions, and altered vault balances stop the flow", () => {
  const frozen = snapshot(3);
  frozen[0] = mintInfo(630_000_000n * 10n ** 9n, false, { freezeAuthorityOption: 1, freezeAuthority: EXPECTED_WALLET });
  assert.throws(() => decodeDeploymentSnapshot(addresses, frozen, 1), /freeze authority/);
  const extension = snapshot(3);
  extension[0].data = Buffer.concat([extension[0].data, Buffer.alloc(100)]);
  assert.throws(() => decodeDeploymentSnapshot(addresses, extension, 1), /no extensions/);
  const altered = snapshot(3);
  altered[1] = vaultInfo(1n);
  assert.throws(() => decodeDeploymentSnapshot(addresses, altered, 1), /Unexpected vault state/);
});

test("mismatched supply and allocations cannot mint or revoke", () => {
  const values = snapshot(3);
  values[0] = mintInfo(RAW_GENESIS_SUPPLY);
  assert.throws(() => decodeDeploymentSnapshot(addresses, values, 1), /Supply does not equal/);
});

test("unknown transaction history never counts as a successful first transaction", async () => {
  await assert.rejects(readHistory({ getSignaturesForAddress: async () => [{ signature: "1".repeat(88), err: null }],
    getParsedTransactions: async () => [null] }, EXPECTED_WALLET), /RPC omitted/);
  assert.equal(findLegacyGenesis([genesisRecord()]).length, 1);
  assert.equal(findLegacyGenesis([genesisRecord({ failed: true })]).length, 0);
  assert.equal(findLegacyGenesis([genesisRecord({ freezeAuthority: EXPECTED_WALLET.toBase58() })]).length, 0);
});

test("an empty confirmed history and empty token list produce an unsigned candidate, never a deployment record", async () => {
  const recovered = await discoverDeployment({ getGenesisHash: async () => DEVNET_GENESIS_HASH,
    getSignaturesForAddress: async () => [], getTokenAccountsByOwner: async () => ({ value: [] }) });
  assert.equal(recovered.mint.toBase58(), addresses.mint.toBase58());
  assert.equal(recovered.legacy, false);
  assert.throws(() => deploymentRecord(stateFor(0), []), /verified completion/);
});

test("final record requires actual signatures and revoked authority, and preserves all seven addresses", () => {
  assert.throws(() => deploymentRecord(stateFor(7), [{ signature: "1".repeat(88) }]), /verified completion/);
  const complete = decodeDeploymentSnapshot(addresses, snapshot(7, true), 123);
  assert.throws(() => deploymentRecord(complete, []), /actual chain signatures/);
  const result = deploymentRecord(complete, [{ signature: "1".repeat(88), blockTime: 1_800_000_000 }]);
  assert.equal(result.mintAuthority, null);
  assert.equal(result.freezeAuthority, null);
  assert.equal(result.permanentDelegate, false);
  assert.equal(result.totalSupply, "1000000000");
  assert.equal(result.vaults.length, 7);
  assert.equal(result.verifiedAtSlot, 123);
  assert.throws(() => next(complete), /already revoked/);
});
