import { createHash } from "node:crypto";
import { COMMISSION_POLICY, quotePoolCommission, quoteWithdrawalCommission } from "./commission-policy.mjs";

const digest = value => createHash("sha256").update(value).digest("hex");
function reference(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9:_-]{3,160}$/.test(value)) throw new Error("invalid_reference");
  return value;
}

// One Redis hash and one script: immutable event + unique transfer claim are atomic.
// Values remain decimal strings; no Lua float arithmetic touches financial units.
export const APPEND_COMMISSION_LUA = `
local existing = redis.call('HGET', KEYS[1], ARGV[1])
local claimed = redis.call('HGET', KEYS[1], ARGV[2])
local source = redis.call('HGET', KEYS[1], ARGV[4])
if existing then
  if existing ~= ARGV[3] then return 'conflict' end
  if claimed ~= ARGV[1] then return 'conflict' end
  if source ~= ARGV[1] then return 'conflict' end
  return 'existing'
end
if claimed then return 'receipt_reused' end
if source then return 'source_reused' end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3], ARGV[2], ARGV[1], ARGV[4], ARGV[1])
return 'created'
`;

export class RedisCommissionJournal {
  constructor(client, key = "marsx:commissions:v1") { this.client = client; this.key = key; }
  async append(event) {
    if (!["collected", "refunded"].includes(event.type)) throw new Error("invalid_commission_event");
    reference(event.chargeId); reference(event.transferReference); reference(event.sourceReference); reference(event.userId);
    const eventKey = `${event.type}:${digest(event.chargeId)}`;
    const receiptKey = `receipt:${digest(`${event.asset}:${event.transferReference}`)}`;
    const sourceKey = `source:${event.type}:${digest(`${event.asset}:${event.kind}:${event.userId}:${event.sourceReference}`)}`;
    const result = await this.client.eval(APPEND_COMMISSION_LUA, {
      keys: [this.key], arguments: [eventKey, receiptKey, JSON.stringify(event), sourceKey],
    });
    if (result !== "created" && result !== "existing") throw new Error(`commission_${result}`);
    return result;
  }
  async collected(chargeId) {
    const value = await this.client.hGet(this.key, `collected:${digest(reference(chargeId))}`);
    return value ? JSON.parse(value) : null;
  }
  async snapshot() {
    // Administrative snapshot; HGETALL returns one consistent Redis view.
    if (await this.client.hLen(this.key) > 30_000) throw new Error("commission_export_required");
    const entries = await this.client.hGetAll(this.key);
    return Object.entries(entries).filter(([key]) => key.startsWith("collected:") || key.startsWith("refunded:")).map(([, value]) => JSON.parse(value));
  }
}

/**
 * This recorder has no network write/signing capability and no public ingestion route.
 * Production bootstrap must inject a durable charge lookup, independently verified
 * source settlement/payout lookup and a chain/provider transfer verifier. A browser
 * body claiming "verified" is never an input to these methods.
 */
export function createCommissionRecorder({ journal, lookupCharge, verifySource, verifyTransfer, treasury, minimumConfirmations, now = Date.now }) {
  if (!journal || ![lookupCharge, verifySource, verifyTransfer].every(x => typeof x === "function"))
    throw new Error("commission_verifiers_required");
  if (!treasury || !minimumConfirmations) throw new Error("commission_treasury_required");
  const wallets = Object.freeze({ ...treasury });
  const confirmations = Object.freeze({ ...minimumConfirmations });

  async function chargeAndQuote(chargeId) {
    const charge = structuredClone(await lookupCharge(reference(chargeId)));
    if (!charge || charge.id !== chargeId || charge.policyId !== COMMISSION_POLICY.policyId ||
        charge.consent?.policyId !== charge.policyId || !Number.isFinite(Date.parse(charge.consent?.acceptedAt)))
      throw new Error("commission_consent_required");
    if (!Number.isFinite(Date.parse(charge.createdAt)) || Date.parse(charge.consent.acceptedAt) > Date.parse(charge.createdAt))
      throw new Error("commission_consent_after_charge");
    if (Date.parse(charge.createdAt) > now()) throw new Error("commission_future_charge");
    reference(charge.userId); reference(charge.sourceReference);
    if (!wallets[charge.asset] || !Number.isSafeInteger(confirmations[charge.asset]) || confirmations[charge.asset] < 1)
      throw new Error("commission_route_unconfigured");
    if (charge.collectionRoute !== "verified_provider_split") throw new Error("commission_route_not_collectible");
    if (charge.referrerUserId === charge.userId) throw new Error("commission_self_referral");
    if (charge.referrerUserId) reference(charge.referrerUserId);
    const quote = charge.kind === "pool" ? quotePoolCommission(charge) :
      charge.kind === "withdrawal" ? quoteWithdrawalCommission({ ...charge, hasReferrer: Boolean(charge.referrerUserId) }) : null;
    if (!quote || quote.commissionUnits === "0") throw new Error("commission_not_due");
    return { charge, quote };
  }
  async function verifiedTransfer(referenceId, charge, amount, recipient) {
    const proof = await verifyTransfer(charge.asset, reference(referenceId));
    if (!proof || proof.reference !== referenceId || proof.asset !== charge.asset || proof.recipient !== recipient ||
        proof.amountUnits !== amount || proof.chargeId !== charge.id || proof.status !== "confirmed" || !Number.isSafeInteger(proof.confirmations) ||
        proof.confirmations < confirmations[charge.asset]) throw new Error("commission_transfer_not_confirmed");
    // transferReference must identify a unique chain output/transfer, not only a
    // batched transaction ID, and must be independent of the charge/user identity.
    reference(proof.transferReference);
    if (!Number.isFinite(Date.parse(proof.confirmedAt)) || Date.parse(proof.confirmedAt) < Date.parse(charge.createdAt))
      throw new Error("commission_transfer_before_charge");
    if (Date.parse(proof.confirmedAt) > now() + 60_000) throw new Error("commission_future_transfer");
    return proof;
  }
  return Object.freeze({
    async record(chargeId, receiptReference) {
      const { charge, quote } = await chargeAndQuote(chargeId);
      const source = await verifySource(charge.sourceReference);
      const basis = quote.kind === "pool" ? quote.providerNetRewardUnits : quote.requestedDebitUnits;
      if (!source || source.reference !== charge.sourceReference || source.userId !== charge.userId ||
          source.asset !== charge.asset || source.kind !== charge.kind || source.amountUnits !== basis ||
          source.status !== "confirmed" || source.policyId !== charge.policyId)
        throw new Error("commission_source_not_confirmed");
      const proof = await verifiedTransfer(receiptReference, charge, quote.commissionUnits, wallets[charge.asset]);
      const event = Object.freeze({ type: "collected", chargeId: charge.id, policyId: charge.policyId,
        asset: charge.asset, kind: charge.kind, userId: charge.userId, sourceReference: charge.sourceReference,
        transferReference: proof.transferReference, recipient: proof.recipient, confirmedAt: proof.confirmedAt,
        grossCommissionUnits: quote.commissionUnits, referralLiabilityUnits: quote.referralUnits,
        ownerNetUnits: quote.ownerNetUnits, referrerUserId: quote.referralUnits === "0" ? null : charge.referrerUserId });
      return { result: await journal.append(event), event };
    },
    async recordFullRefund(chargeId, refundReference) {
      const { charge } = await chargeAndQuote(chargeId);
      const prior = await journal.collected(chargeId);
      if (!prior || !charge.refundAddress) throw new Error("commission_refund_not_bound");
      const proof = await verifiedTransfer(refundReference, charge, prior.grossCommissionUnits, charge.refundAddress);
      if (proof.sender !== wallets[charge.asset]) throw new Error("commission_refund_sender_mismatch");
      if (Date.parse(proof.confirmedAt) < Date.parse(prior.confirmedAt)) throw new Error("commission_refund_before_collection");
      const event = Object.freeze({ ...prior, type: "refunded", transferReference: proof.transferReference,
        recipient: proof.recipient, confirmedAt: proof.confirmedAt });
      return { result: await journal.append(event), event };
    },
  });
}

export function summarizeCommissions(events) {
  const result = {};
  const seen = new Set();
  const collections = new Map(events.filter(x => x.type === "collected").map(x => [x.chargeId, x]));
  for (const event of events) {
    if (!Object.hasOwn(COMMISSION_POLICY.assetDecimals, event.asset) || !["collected", "refunded"].includes(event.type))
      throw new Error("invalid_commission_event");
    const key = `${event.type}:${event.chargeId}`;
    if (seen.has(key)) throw new Error("duplicate_commission_event");
    seen.add(key);
    if (event.type === "refunded") {
      const prior = collections.get(event.chargeId);
      if (!prior || ["asset", "grossCommissionUnits", "referralLiabilityUnits", "ownerNetUnits"].some(k => prior[k] !== event[k]))
        throw new Error("unmatched_commission_refund");
    }
    const row = result[event.asset] ||= { grossCollectedUnits: 0n, refundedUnits: 0n, referralLiabilityUnits: 0n, ownerNetUnits: 0n };
    for (const field of ["grossCommissionUnits", "referralLiabilityUnits", "ownerNetUnits"])
      if (typeof event[field] !== "string" || !/^(0|[1-9][0-9]{0,29})$/.test(event[field])) throw new Error("invalid_commission_units");
    const gross = BigInt(event.grossCommissionUnits), referral = BigInt(event.referralLiabilityUnits), net = BigInt(event.ownerNetUnits);
    if (gross < 0n || referral < 0n || net < 0n || gross !== referral + net) throw new Error("unbalanced_commission_event");
    const sign = event.type === "collected" ? 1n : -1n;
    if (sign > 0n) row.grossCollectedUnits += gross; else row.refundedUnits += gross;
    row.referralLiabilityUnits += sign * referral; row.ownerNetUnits += sign * net;
  }
  return Object.fromEntries(Object.entries(result).map(([asset, row]) => [asset,
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value.toString()]))]));
}
