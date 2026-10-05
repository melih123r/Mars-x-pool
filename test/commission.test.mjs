import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { quotePoolCommission, quoteWithdrawalCommission, commissionDisclosure } from "../pool/commission-policy.mjs";
import { createCommissionRecorder, RedisCommissionJournal, summarizeCommissions } from "../pool/commission-journal.mjs";
import { createServer } from "../server.js";

const policyId = "marsx-commission-v1";
const clock = Date.parse("2026-10-05T00:00:00Z");
const consent = { policyId, acceptedAt: "2026-10-04T20:00:00Z" };
const baseCharge = { id: "charge-001", kind: "withdrawal", asset: "VRSC", userId: "user-001", referrerUserId: "user-002",
  sourceReference: "provider:withdrawal:001", policyId, consent, createdAt: "2026-10-04T21:00:00Z",
  requestedDebitUnits: "9000000000", networkFeeUnits: "1000000", providerFeeUnits: "0",
  collectionRoute: "verified_provider_split", refundAddress: "test-user-address" };
const baseProof = { reference: "provider:transfer:001", transferReference: "tx-fixture:output-1", asset: "VRSC",
  chargeId: "charge-001", recipient: "test-owner-address", amountUnits: "180000000", status: "confirmed",
  confirmations: 6, confirmedAt: "2026-10-04T22:00:00Z" };
const baseSource = { reference: baseCharge.sourceReference, asset: "VRSC", userId: "user-001", kind: "withdrawal",
  amountUnits: baseCharge.requestedDebitUnits, policyId, status: "confirmed" };

function setup({ charge = baseCharge, proof = baseProof, source = baseSource, journal } = {}) {
  const events = [];
  journal ||= { append: async event => { events.push(event); return "created"; },
    collected: async id => events.find(x => x.chargeId === id && x.type === "collected") || null };
  return { events, recorder: createCommissionRecorder({ journal, lookupCharge: async () => charge,
    verifySource: async () => source, verifyTransfer: async () => proof, treasury: { VRSC: "test-owner-address" },
    minimumConfirmations: { VRSC: 6 }, now: () => clock }) };
}

test("10% reward fee then 2% withdrawal fee, referral from fee not reward", () => {
  const reward = quotePoolCommission({ asset: "VRSC", providerNetRewardUnits: "10000000000" });
  assert.equal(reward.commissionUnits, "1000000000");
  assert.equal(reward.userNetUnits, "9000000000");
  const payout = quoteWithdrawalCommission({ ...baseCharge, hasReferrer: true });
  assert.equal(payout.commissionUnits, "180000000");
  assert.equal(payout.referralUnits, "5400000");
  assert.equal(payout.ownerNetUnits, "174600000");
  assert.equal(payout.userReceivesUnits, "8819000000");
  assert.equal(payout.executable, false);
});
test("integer math conserves funds beyond floating point safe range", () => {
  for (const asset of ["VRSC", "LTC", "DOGE"]) {
    const amount = "9007199254740993123456789";
    const q = quotePoolCommission({ asset, providerNetRewardUnits: amount });
    assert.equal(BigInt(q.userNetUnits) + BigInt(q.commissionUnits), BigInt(amount));
    assert.equal(q.referralUnits, "0");
  }
});
test("rejects floats, negative fees, missing fee quotes and unsupported assets", () => {
  for (const bad of [100, 1.1, "1e6", "-1", "01", "0", null, "1.0"]) {
    assert.throws(() => quotePoolCommission({ asset: "VRSC", providerNetRewardUnits: bad }));
  }
  assert.throws(() => quotePoolCommission({ asset: "USDT_TEST", providerNetRewardUnits: "100" }));
  assert.throws(() => quoteWithdrawalCommission({ asset: "VRSC", requestedDebitUnits: "10000" }));
  assert.throws(() => quoteWithdrawalCommission({ ...baseCharge, networkFeeUnits: "-1" }));
  assert.throws(() => quoteWithdrawalCommission({ ...baseCharge, providerFeeUnits: baseCharge.requestedDebitUnits }));
});
test("rounds each commission down to smallest unit; no referral without binding", () => {
  assert.equal(quotePoolCommission({ asset: "VRSC", providerNetRewardUnits: "9" }).commissionUnits, "0");
  const q = quoteWithdrawalCommission({ ...baseCharge, hasReferrer: false });
  assert.equal(q.ownerNetUnits, q.commissionUnits); assert.equal(q.referralUnits, "0");
  assert.equal(commissionDisclosure().collectionEnabled, false);
  assert.equal(commissionDisclosure().collectedUnits, null);
});
test("records only verified source plus confirmed funds received by operator", async () => {
  const { recorder, events } = setup();
  await recorder.record(baseCharge.id, baseProof.reference);
  assert.equal(events.length, 1);
  assert.deepEqual(summarizeCommissions(events), { VRSC: { grossCollectedUnits: "180000000", refundedUnits: "0",
    referralLiabilityUnits: "5400000", ownerNetUnits: "174600000" } });
});
test("rejects direct-to-user monitoring, absent consent and self referral", async () => {
  for (const patch of [{ collectionRoute: "direct_user" }, { consent: null }, { referrerUserId: "user-001" },
    { consent: { policyId, acceptedAt: "2026-10-04T23:00:00Z" } }, { createdAt: "2027-01-01T00:00:00Z" }]) {
    const { recorder, events } = setup({ charge: { ...baseCharge, ...patch } });
    await assert.rejects(recorder.record(baseCharge.id, baseProof.reference)); assert.equal(events.length, 0);
  }
});
test("rejects pending payouts and mismatched source attribution", async () => {
  for (const patch of [{ status: "pending" }, { userId: "other-user" }, { amountUnits: "1" }, { kind: "pool" }]) {
    const { recorder, events } = setup({ source: { ...baseSource, ...patch } });
    await assert.rejects(recorder.record(baseCharge.id, baseProof.reference), /source_not_confirmed/);
    assert.equal(events.length, 0);
  }
});
test("wrong wallet, amount, chain, confirmation, charge or old transfer cannot accrue income", async () => {
  for (const patch of [{ recipient: "attacker" }, { amountUnits: "1" }, { asset: "DOGE" }, { confirmations: 0 },
    { chargeId: "other-charge" }, { confirmedAt: "2026-01-01T00:00:00Z" }, { confirmedAt: "2027-01-01T00:00:00Z" }]) {
    const { recorder, events } = setup({ proof: { ...baseProof, ...patch } });
    await assert.rejects(recorder.record(baseCharge.id, baseProof.reference)); assert.equal(events.length, 0);
  }
});
test("full confirmed commission refund reverses operator and referral amounts", async () => {
  const events = [];
  let proof = baseProof;
  const recorder = createCommissionRecorder({
    journal: { append: async e => { events.push(e); return "created"; }, collected: async () => events[0] },
    lookupCharge: async () => baseCharge, verifySource: async () => baseSource, verifyTransfer: async () => proof,
    treasury: { VRSC: "test-owner-address" }, minimumConfirmations: { VRSC: 6 }, now: () => clock,
  });
  await recorder.record(baseCharge.id, baseProof.reference);
  proof = { ...baseProof, reference: "provider:refund:001", transferReference: "refund-fixture:output-0",
    recipient: baseCharge.refundAddress, sender: "test-owner-address", confirmedAt: "2026-10-04T23:00:00Z" };
  await recorder.recordFullRefund(baseCharge.id, proof.reference);
  assert.deepEqual(summarizeCommissions(events), { VRSC: { grossCollectedUnits: "180000000", refundedUnits: "180000000",
    referralLiabilityUnits: "0", ownerNetUnits: "0" } });
  assert.throws(() => summarizeCommissions([events[1]]), /unmatched/);
  assert.throws(() => summarizeCommissions([events[0], events[0]]), /duplicate/);
});
test("quotes do not enable financial execution; owner report requires authentication", async t => {
  const server = createServer({ adminToken: "test-admin", commissionJournal: { snapshot: async () => [] } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const policy = await (await fetch(base + "/fees")).json();
  assert.equal(policy.poolFeeBps, 1000); assert.equal(policy.collectionEnabled, false);
  const quote = await (await fetch(base + "/fees/quote", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "pool", asset: "VRSC", providerNetRewardUnits: "1000" }) })).json();
  assert.equal(quote.commissionUnits, "100"); assert.equal(quote.executable, false);
  assert.equal((await fetch(base + "/admin/commissions")).status, 401);
  const report = await (await fetch(base + "/admin/commissions", { headers: { Authorization: "Bearer test-admin" } })).json();
  assert.equal(report.hasVerifiedCollections, false); assert.deepEqual(report.byAsset, {});
  assert.equal(report.operatorPayoutEnabled, false);
  assert.equal((await fetch(base + "/admin/commissions", { method: "POST", headers: { Authorization: "Bearer test-admin" } })).status, 404);
});

test("Redis atomically deduplicates concurrent receipts and source events", { skip: !process.env.COMMISSION_TEST_REDIS_URL }, async t => {
  const { createClient } = await import("redis");
  const client = createClient({ url: process.env.COMMISSION_TEST_REDIS_URL });
  await client.connect();
  const key = `marsx:commission-test:${randomUUID()}`;
  t.after(async () => { await client.del(key); await client.quit(); });
  const journal = new RedisCommissionJournal(client, key);
  const { recorder } = setup({ journal });
  const results = await Promise.all(Array.from({ length: 50 }, () => recorder.record(baseCharge.id, baseProof.reference)));
  assert.equal(results.filter(x => x.result === "created").length, 1);
  assert.equal(results.filter(x => x.result === "existing").length, 49);
  const stored = await journal.collected(baseCharge.id);
  await assert.rejects(journal.append({ ...stored, ownerNetUnits: "1" }), /conflict/);
  await assert.rejects(journal.append({ ...stored, chargeId: "charge-other", sourceReference: "source-other" }), /receipt_reused/);
  await assert.rejects(journal.append({ ...stored, chargeId: "charge-other", transferReference: "transfer-other" }), /source_reused/);
  assert.equal((await journal.snapshot()).length, 1);
  const otherClient = createClient({ url: process.env.COMMISSION_TEST_REDIS_URL }); await otherClient.connect();
  try { assert.deepEqual(await new RedisCommissionJournal(otherClient, key).collected(baseCharge.id), stored); }
  finally { await otherClient.quit(); }
});
