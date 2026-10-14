// Fail-closed accounting policy. Display credits are never created from estimates or shares.
export function verifiedVrscSettlement(event) {
  if (!event || event.providerConfirmed !== true) return { verified:false, reason:'provider-unconfirmed' };
  if (typeof event.providerSettlementId !== 'string' || event.providerSettlementId.length < 8)
    return { verified:false, reason:'settlement-id-missing' };
  if (!Number.isFinite(event.settledVrsc) || event.settledVrsc <= 0)
    return { verified:false, reason:'settled-amount-invalid' };
  if (!Number.isFinite(event.confirmedAtMs) || event.confirmedAtMs <= 0)
    return { verified:false, reason:'confirmation-time-invalid' };
  return {
    verified:true,
    providerSettlementId:event.providerSettlementId,
    settledVrsc:event.settledVrsc,
    confirmedAtMs:event.confirmedAtMs
  };
}

// MX Credit is a UI denomination backed 1:1 by verified settled VRSC.
// It is not the MARSX token and must be disclosed as such.
export function mxCreditBalance(settlements) {
  const seen=new Set();
  let vrsc=0;
  for (const event of settlements || []) {
    const s=verifiedVrscSettlement(event);
    if (!s.verified || seen.has(s.providerSettlementId)) continue;
    seen.add(s.providerSettlementId);
    vrsc += s.settledVrsc;
  }
  return { mxCredit:vrsc, backingVrsc:vrsc, verifiedSettlementCount:seen.size };
}

export function displayDisclosure() {
  return 'MX Credit, doğrulanmış VRSC settlement karşılığı uygulama içi gösterimdir; MARSX token değildir.';
}
