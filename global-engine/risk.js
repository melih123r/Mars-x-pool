export const DEFAULT_RISK_POLICY=Object.freeze({
  maxStaleMs:15000,
  maxSpreadBps:50,
  minConsensus:1,
  maxVenueFailures:2,
  venueFailureCooldownMs:30000,
  liveExecutionEnabled:false
});

export function spreadBps(q){
  const bid=Number(q?.metadata?.bid), ask=Number(q?.metadata?.ask);
  if(!(bid>0) || !(ask>=bid)) return 0;
  const mid=(bid+ask)/2;
  return ((ask-bid)/mid)*10000;
}

export function validateQuoteRisk(q,policy=DEFAULT_RISK_POLICY){
  if(spreadBps(q)>policy.maxSpreadBps) return {ok:false,reason:"SPREAD_TOO_WIDE"};
  return {ok:true};
}

export function executionGate(policy=DEFAULT_RISK_POLICY){
  if(!policy.liveExecutionEnabled) return {ok:false,reason:"LIVE_EXECUTION_DISABLED"};
  return {ok:true};
}
