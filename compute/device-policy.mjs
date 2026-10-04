export const DEFAULT_DEVICE_POLICY = Object.freeze({
  minBatteryPercent: 40,
  maxBatteryTempC: 42,
  requireCharging: true,
  requireUnmeteredNetwork: true,
  maxCpuPercent: 35,
  foregroundOnly: true
});

export function evaluateDevicePolicy(state, policy = DEFAULT_DEVICE_POLICY) {
  if (!state?.explicitConsent) return { allowed:false, reason:"consent_required" };
  if (policy.foregroundOnly && !state.foreground) return { allowed:false, reason:"foreground_required" };
  if (policy.requireCharging && !state.charging) return { allowed:false, reason:"charging_required" };
  if (Number(state.batteryPercent) < policy.minBatteryPercent) return { allowed:false, reason:"battery_low" };
  if (Number(state.batteryTempC) >= policy.maxBatteryTempC) return { allowed:false, reason:"thermal_limit" };
  if (policy.requireUnmeteredNetwork && !state.unmeteredNetwork) return { allowed:false, reason:"unmetered_network_required" };
  return { allowed:true, reason:"ok", maxCpuPercent:policy.maxCpuPercent };
}

export function assertComputeReceipt(receipt) {
  if (!receipt || receipt.source !== "provider_verified_compute") throw new Error("unverified compute receipt");
  if (!receipt.jobId || !receipt.workerId || !receipt.providerReference) throw new Error("incomplete compute receipt");
  if (Number(receipt.acceptedUnits) <= 0) throw new Error("no accepted compute units");
  return Object.freeze({...receipt, spendable:false});
}
