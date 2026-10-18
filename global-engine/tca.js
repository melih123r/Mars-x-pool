const n=v=>Number(v);
export function executionTca({side,decisionPrice,arrivalPrice,fillPrice,fee=0,quantity=0,latencyMs=0,venue=""}={}){
  const s=String(side).toUpperCase(), d=n(decisionPrice), a=n(arrivalPrice), f=n(fillPrice), q=n(quantity), cost=n(fee), latency=n(latencyMs);
  if(!["BUY","SELL"].includes(s)||![d,a,f,q,cost,latency].every(Number.isFinite)||d<=0||a<=0||f<=0||q<0||cost<0||latency<0) throw new Error("invalid TCA input");
  const dir=s==="BUY"?1:-1;
  const slippageBps=dir*((f-a)/a)*10000;
  const decisionBps=dir*((f-d)/d)*10000;
  const notional=f*q;
  const feeBps=notional>0?(cost/notional)*10000:0;
  return {venue,side:s,decisionPrice:d,arrivalPrice:a,fillPrice:f,quantity:q,notional,slippageBps,decisionBps,fee:cost,feeBps,latencyMs:latency,totalCostBps:slippageBps+feeBps};
}
export function venueScore(rows=[]){
  const valid=rows.filter(r=>Number.isFinite(r?.totalCostBps)&&Number.isFinite(r?.latencyMs));
  if(!valid.length) return [];
  const groups=Map.groupBy(valid,r=>r.venue||"unknown");
  return [...groups].map(([venue,x])=>({venue,samples:x.length,avgCostBps:x.reduce((s,r)=>s+r.totalCostBps,0)/x.length,avgLatencyMs:x.reduce((s,r)=>s+r.latencyMs,0)/x.length})).sort((a,b)=>a.avgCostBps-b.avgCostBps);
}
