export function median(values){
  const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length)return NaN;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}

export function filterOutliers(quotes,{maxDeviationBps=150}={}){
  const qs=quotes||[];
  if(qs.length<3) return qs;
  const m=median(qs.map(q=>Number(q.price)));
  if(!Number.isFinite(m))return [];
  return qs.filter(q=>Math.abs((Number(q.price)-m)/m)*10000<=maxDeviationBps);
}

export function consensusState(quotes,{maxPairDeviationBps=150}={}){
  const qs=quotes||[];
  if(qs.length<2)return {ok:true,reason:"SINGLE_SOURCE"};
  if(qs.length===2){
    const [a,b]=qs.map(q=>Number(q.price));
    const mid=(a+b)/2,dev=Math.abs(a-b)/mid*10000;
    return dev<=maxPairDeviationBps?{ok:true,deviationBps:dev}:{ok:false,reason:"VENUE_DISAGREEMENT",deviationBps:dev};
  }
  return {ok:true};
}
