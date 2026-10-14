// Control-plane state only. This module never downloads, starts or embeds a miner executable.
const ID=/^[A-Za-z0-9_-]{8,64}$/;
export function pairWorker({poolId,workerId,pairingCode,userConfirmed}) {
  if (userConfirmed !== true) return {paired:false,reason:'pairing-confirmation-required'};
  if (!ID.test(poolId||'') || !ID.test(workerId||'')) return {paired:false,reason:'invalid-identity'};
  if (!/^[0-9]{6}$/.test(pairingCode||'')) return {paired:false,reason:'invalid-pairing-code'};
  return {paired:true,poolId,workerId,reason:'paired'};
}

export function workerTransition(state, action, safety) {
  const s=state||{status:'STOPPED',paired:false,consent:false};
  if (action==='REVOKE_CONSENT') return {...s,status:'STOPPED',consent:false,stopReason:'consent-revoked'};
  if (action==='STOP') return {...s,status:'STOPPED',stopReason:'user-stop'};
  if (action==='CONSENT') return {...s,consent:true};
  if (action==='START') {
    if (s.paired!==true) return {...s,status:'STOPPED',stopReason:'worker-not-paired'};
    if (s.consent!==true) return {...s,status:'STOPPED',stopReason:'consent-required'};
    if (!safety || safety.allowed!==true || safety.threads!==1)
      return {...s,status:'STOPPED',stopReason:safety?.reason||'safety-veto'};
    return {...s,status:'RUNNING',threads:1,stopReason:null};
  }
  if (action==='SAFETY_UPDATE' && s.status==='RUNNING' &&
      (!safety || safety.allowed!==true || safety.threads!==1))
    return {...s,status:'STOPPED',threads:0,stopReason:safety?.reason||'safety-veto'};
  return s;
}
