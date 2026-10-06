export const CREDIT_SOURCES = Object.freeze(new Set(["provider_settlement"]));

export function assertSpendableCredit(entry) {
  if (!entry || !CREDIT_SOURCES.has(entry.source)) throw new Error("unverified mining credit source");
  if (!entry.providerReference || String(entry.providerReference).length < 4) throw new Error("missing provider settlement reference");
  const units = BigInt(entry.amountUnits);
  if (units <= 0n) throw new Error("invalid mining credit");
  return Object.freeze({
    source: entry.source,
    asset: String(entry.asset || "").toUpperCase(),
    workerId: String(entry.workerId || ""),
    amountUnits: units,
    providerReference: String(entry.providerReference),
    settledAt: String(entry.settledAt || new Date().toISOString())
  });
}

export function miningEstimate({ hashrate, unitsPerHash }) {
  const h = Number(hashrate);
  const rate = Number(unitsPerHash);
  if (!Number.isFinite(h) || h < 0 || !Number.isFinite(rate) || rate < 0) throw new Error("invalid estimate inputs");
  return Object.freeze({ estimatedUnitsPerMinute: h * rate * 60, spendable: false, label: "Tahmini" });
}
