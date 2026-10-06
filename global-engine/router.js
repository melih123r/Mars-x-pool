export function effectivePrice(order, q) {
  return order.side === "BUY" ? q.price + q.fee : q.price - q.fee;
}

export function selectBest(order, quotes) {
  const valid=(quotes || []).filter(q => q && Number.isFinite(q.price) && q.price>0 && Number.isFinite(q.fee) && q.fee>=0);
  if (!valid.length) throw new Error("no valid quotes");
  return valid.reduce((best,q) => {
    const a=effectivePrice(order,q), b=effectivePrice(order,best);
    return order.side === "BUY" ? (a<b?q:best) : (a>b?q:best);
  });
}
