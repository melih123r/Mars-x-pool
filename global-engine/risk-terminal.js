const finite=n=>Number.isFinite(Number(n));
export function portfolioSnapshot({positions=[],equity=0}={}){
  const rows=positions.filter(p=>finite(p.marketValue)).map(p=>({...p,marketValue:Number(p.marketValue)}));
  const gross=rows.reduce((s,p)=>s+Math.abs(p.marketValue),0);
  const net=rows.reduce((s,p)=>s+p.marketValue,0);
  const eq=Number(equity)||0;
  const concentration=gross?Math.max(...rows.map(p=>Math.abs(p.marketValue)))/gross:0;
  return {equity:eq,grossExposure:gross,netExposure:net,leverage:eq>0?gross/eq:null,concentration,positions:rows.length,mode:"PAPER_SIMULATION"};
}
export function scenarioShock(snapshot,{percent=0}={}){
  const shock=Number(percent);
  if(!finite(shock)) throw new Error("invalid scenario shock");
  return {...snapshot,shockPercent:shock,estimatedPnl:snapshot.netExposure*(shock/100),mode:"PAPER_SIMULATION"};
}
