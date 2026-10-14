const SUPPORTED = new Set(["LTC","DOGE"]);

function positiveNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${name}`);
  return n;
}

export function normalizePoolSnapshot(input = {}) {
  const asset = String(input.asset || "").toUpperCase();
  if (!SUPPORTED.has(asset)) throw new Error("unsupported asset");
  const workerId = String(input.workerId || "").trim();
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(workerId)) throw new Error("invalid workerId");
  return Object.freeze({
    provider: String(input.provider || "unknown").slice(0, 40),
    asset,
    workerId,
    hashrate: positiveNumber(input.hashrate, "hashrate"),
    acceptedShares: positiveNumber(input.acceptedShares, "acceptedShares"),
    rejectedShares: positiveNumber(input.rejectedShares, "rejectedShares"),
    grossUnits: BigInt(input.grossUnits ?? 0),
    providerReference: String(input.providerReference || "").slice(0, 160),
    observedAt: String(input.observedAt || new Date().toISOString())
  });
}

export function settleSnapshot(snapshot, { poolFeeBps = 1000 } = {}) {
  if (!Number.isInteger(poolFeeBps) || poolFeeBps < 0 || poolFeeBps > 3000) throw new Error("invalid pool fee");
  if (snapshot.grossUnits < 0n) throw new Error("negative gross units");
  const feeUnits = snapshot.grossUnits * BigInt(poolFeeBps) / 10_000n;
  return Object.freeze({
    ...snapshot,
    poolFeeBps,
    feeUnits,
    netUnits: snapshot.grossUnits - feeUnits
  });
}

export function quoteWithdrawal({ balanceUnits, amountUnits, networkFeeUnits = 0n, withdrawalFeeBps = 200 }) {
  const balance = BigInt(balanceUnits);
  const amount = BigInt(amountUnits);
  const networkFee = BigInt(networkFeeUnits);
  if (amount <= 0n || balance < amount) throw new Error("insufficient balance");
  if (!Number.isInteger(withdrawalFeeBps) || withdrawalFeeBps < 0 || withdrawalFeeBps > 2000) throw new Error("invalid withdrawal fee");
  const serviceFee = amount * BigInt(withdrawalFeeBps) / 10_000n;
  const userReceives = amount - serviceFee - networkFee;
  if (userReceives <= 0n) throw new Error("fees exceed withdrawal");
  return Object.freeze({ amountUnits: amount, serviceFeeUnits: serviceFee, networkFeeUnits: networkFee, userReceivesUnits: userReceives });
}

export function verifyProviderSettlement(local, provider) {
  if (local.asset !== provider.asset || local.workerId !== provider.workerId) return false;
  if (!provider.providerReference) return false;
  return BigInt(local.grossUnits) === BigInt(provider.grossUnits);
}
