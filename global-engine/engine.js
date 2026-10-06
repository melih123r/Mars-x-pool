import { selectBest } from "./router.js";
import { filterFreshQuotes, normalizeQuotes } from "./quality.js";
import { filterOutliers, consensusState } from "./consensus.js";
import { VenueHealth } from "./health.js";
import { DEFAULT_RISK_POLICY, validateQuoteRisk } from "./risk.js";

export class MarsXGlobalEngine {
  constructor(adapters=[], options={}) {
    this.adapters=adapters;
    this.policy={...DEFAULT_RISK_POLICY,...options};
    this.maxQuoteAgeMs=this.policy.maxStaleMs;
    this.health=new VenueHealth();
  }
  register(adapter){ this.adapters.push(adapter); return this; }

  async quotes(order){
    const eligible=this.adapters.filter(v=>v.supports(order.instrument) && this.health.canTry(v.name,{maxFailures:this.policy.maxVenueFailures,cooldownMs:this.policy.venueFailureCooldownMs}));
    if(!eligible.length) throw new Error("no healthy eligible venues");
    const settled=await Promise.allSettled(eligible.map(async v=>{
      const start=Date.now();
      try { const q=await v.getQuote(order); this.health.success(v.name,Date.now()-start); return q; }
      catch(e){ this.health.failure(v.name,e); throw e; }
    }));
    const raw=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);
    const fresh=filterFreshQuotes(normalizeQuotes(raw),{maxAgeMs:this.maxQuoteAgeMs});
    const sane=filterOutliers(fresh);
    const riskOk=sane.filter(q=>validateQuoteRisk(q,this.policy).ok);
    const consensus=consensusState(riskOk);
    if(!consensus.ok) throw new Error(consensus.reason);
    return riskOk;
  }

  async route(order){
    const quotes=await this.quotes(order);
    if(quotes.length<this.policy.minConsensus) throw new Error("insufficient quote consensus");
    return {best:selectBest(order,quotes),quotes,health:this.health.snapshot()};
  }

  async paperExecute(order){
    const {best,quotes,health}=await this.route(order);
    const venue=this.adapters.find(v=>v.name.toLowerCase()===best.venue);
    if(!venue) throw new Error("winning venue unavailable");
    if(venue.mode!=="paper") throw new Error("paper execution requires a paper-mode venue; live execution is disabled");
    const execution=await venue.placeOrder(order,best);
    return {order,best,quotes,health,execution};
  }
}
