// Provider adapter boundary. No credentials, orders, payouts or mining executable are handled here.
export function normalizeShare(raw) {
  if (!raw || raw.providerVerified !== true) return {accepted:false,reason:'provider-unverified'};
  if (typeof raw.workerId!=='string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.workerId))
    return {accepted:false,reason:'worker-invalid'};
  if (typeof raw.shareId!=='string' || raw.shareId.length<8)
    return {accepted:false,reason:'share-id-invalid'};
  if (!Number.isFinite(raw.acceptedAtMs) || raw.acceptedAtMs<=0)
    return {accepted:false,reason:'share-time-invalid'};
  return {accepted:true,providerVerified:true,workerId:raw.workerId,shareId:raw.shareId,acceptedAtMs:raw.acceptedAtMs};
}

export function normalizeSettlement(raw) {
  if (!raw || raw.providerConfirmed!==true) return {confirmed:false,reason:'provider-unconfirmed'};
  const settlementId=raw.settlementId ?? raw.providerSettlementId;
  const amountVrsc=raw.amountVrsc ?? raw.settledVrsc;
  if (raw.settlementId!==undefined && raw.providerSettlementId!==undefined && raw.settlementId!==raw.providerSettlementId)
    return {confirmed:false,reason:'settlement-id-conflict'};
  if (raw.amountVrsc!==undefined && raw.settledVrsc!==undefined && raw.amountVrsc!==raw.settledVrsc)
    return {confirmed:false,reason:'settlement-amount-conflict'};
  if (typeof settlementId!=='string' || settlementId.length<8)
    return {confirmed:false,reason:'settlement-id-invalid'};
  if (!Number.isFinite(amountVrsc) || amountVrsc<=0)
    return {confirmed:false,reason:'amount-invalid'};
  if (!Number.isFinite(raw.confirmedAtMs) || raw.confirmedAtMs<=0)
    return {confirmed:false,reason:'confirmation-time-invalid'};
  return {confirmed:true,providerSettlementId:settlementId,settledVrsc:amountVrsc,
    confirmedAtMs:raw.confirmedAtMs,providerConfirmed:true};
}

export function providerHealth(snapshot, nowMs) {
  if (!snapshot || !Number.isFinite(nowMs)) return {healthy:false,reason:'invalid-state'};
  if (snapshot.readOnly!==true) return {healthy:false,reason:'read-only-required'};
  if (!Number.isFinite(snapshot.checkedAtMs) || nowMs<snapshot.checkedAtMs || nowMs-snapshot.checkedAtMs>60000)
    return {healthy:false,reason:'provider-status-stale'};
  return {healthy:true,reason:'read-only-provider-ready'};
}
