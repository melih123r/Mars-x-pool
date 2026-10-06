export function median(values){
  const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length) return NaN;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}

export function filterOutliers(quotes,{maxDeviationBps=150}={}){
  const m=median((quotes||[]).map(q=>Number(q.price)));
  if(!Number.isFinite(m)) return [];
  return quotes.filter(q=>Math.abs((Number(q.price)-m)/m)*10000<=maxDeviationBps);
}
