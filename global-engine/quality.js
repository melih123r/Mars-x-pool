export function quoteAgeMs(q, now=Date.now()) {
  const ts=Date.parse(q.timestamp);
  return Number.isFinite(ts) ? Math.max(0,now-ts) : Infinity;
}

export function filterFreshQuotes(quotes,{maxAgeMs=15000,now=Date.now()}={}) {
  return (quotes||[]).filter(q=>quoteAgeMs(q,now)<=maxAgeMs);
}

export function normalizeQuotes(quotes) {
  return (quotes||[]).map(q=>({...q,venue:String(q.venue).toLowerCase(),price:Number(q.price),fee:Number(q.fee||0)}));
}
