import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync(new URL("./commission-policy.json", import.meta.url), "utf8"));
export const COMMISSION_POLICY = Object.freeze({ ...raw, assetDecimals: Object.freeze(raw.assetDecimals) });

function units(value, name, positive = false) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,29})$/.test(value)) throw new Error(`invalid_${name}`);
  const n = BigInt(value);
  if (positive && n === 0n) throw new Error(`invalid_${name}`);
  return n;
}
function assetInfo(asset) {
  if (!Object.hasOwn(COMMISSION_POLICY.assetDecimals, asset)) throw new Error("unsupported_asset");
  return { asset, decimals: COMMISSION_POLICY.assetDecimals[asset], policyId: COMMISSION_POLICY.policyId };
}
const fee = (amount, bps) => amount * BigInt(bps) / 10_000n;

export function quotePoolCommission({ asset, providerNetRewardUnits }) {
  const info = assetInfo(asset);
  const gross = units(providerNetRewardUnits, "provider_net_reward", true);
  const commission = fee(gross, COMMISSION_POLICY.poolFeeBps);
  return Object.freeze({ ...info, kind: "pool", providerNetRewardUnits: gross.toString(),
    commissionUnits: commission.toString(), referralUnits: "0", ownerNetUnits: commission.toString(),
    userNetUnits: (gross - commission).toString(), executable: false });
}

export function quoteWithdrawalCommission({ asset, requestedDebitUnits, networkFeeUnits, providerFeeUnits, hasReferrer = false }) {
  const info = assetInfo(asset);
  if (typeof hasReferrer !== "boolean") throw new Error("invalid_referrer");
  const amount = units(requestedDebitUnits, "requested_debit", true);
  // No implicit zero cost: a verified route must supply both fees explicitly.
  const network = units(networkFeeUnits, "network_fee");
  const provider = units(providerFeeUnits, "provider_fee");
  const commission = fee(amount, COMMISSION_POLICY.withdrawalFeeBps);
  const referral = hasReferrer ? fee(commission, COMMISSION_POLICY.referralShareOfWithdrawalFeeBps) : 0n;
  const received = amount - commission - network - provider;
  if (received <= 0n) throw new Error("fees_exceed_amount");
  return Object.freeze({ ...info, kind: "withdrawal", requestedDebitUnits: amount.toString(),
    networkFeeUnits: network.toString(), providerFeeUnits: provider.toString(),
    commissionUnits: commission.toString(), referralUnits: referral.toString(),
    ownerNetUnits: (commission - referral).toString(), userReceivesUnits: received.toString(), executable: false });
}

export function commissionDisclosure() {
  return { ...COMMISSION_POLICY, collectionStatus: "not_configured", operatorPayoutEnabled: false,
    collectedUnits: null, message: "Policy and calculations only; the public LuckPool monitor does not collect fees." };
}
