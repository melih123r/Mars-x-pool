export function estimatedUnits(order,q){
  // v0.1 amount is quote-currency notional. Convert notional to estimated base units.
  return Number(order.amount)/Number(q.price);
}

export function effectiveCost(order,q){
  const notional=Number(order.amount);
  const fee=Number(q.fee||0);
  return order.side==="BUY" ? notional+fee : notional-fee;
}

export function effectivePrice(order,q){
  const units=estimatedUnits(order,q);
  if(!(units>0)) return order.side==="BUY" ? Infinity : -Infinity;
  return effectiveCost(order,q)/units;
}

export function selectBest(order,quotes){
  const valid=(quotes||[]).filter(q=>q&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(q.fee)&&q.fee>=0);
  if(!valid.length) throw new Error("no valid quotes");
  return valid.reduce((best,q)=>{
    const a=effectivePrice(order,q),b=effectivePrice(order,best);
    return order.side==="BUY"?(a<b?q:best):(a>b?q:best);
  });
}
