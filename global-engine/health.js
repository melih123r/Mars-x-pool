export class VenueHealth {
  constructor(){ this.state=new Map(); }
  success(name,latencyMs=0){ const s=this.state.get(name)||{}; this.state.set(name,{...s,healthy:true,failures:0,lastSuccessAt:new Date().toISOString(),latencyMs}); }
  failure(name,error){ const s=this.state.get(name)||{failures:0}; this.state.set(name,{...s,healthy:false,failures:(s.failures||0)+1,lastError:String(error?.message||error),lastFailureAt:new Date().toISOString()}); }
  get(name){ return this.state.get(name)||{healthy:true,failures:0}; }
  canTry(name,{maxFailures=2,cooldownMs=30000,now=Date.now()}={}){
    const s=this.get(name);
    if((s.failures||0)<maxFailures) return true;
    const failedAt=Date.parse(s.lastFailureAt||"");
    return Number.isFinite(failedAt) && now-failedAt>=cooldownMs;
  }
  snapshot(){ return Object.fromEntries(this.state); }
}
