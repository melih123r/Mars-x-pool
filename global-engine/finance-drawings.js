// MARS-X Finance: deterministic chart drawing geometry, no exchange credentials.
const finite = (n) => typeof n === "number" && Number.isFinite(n);
export function point(time, price) {
  if (!finite(time) || !finite(price) || time <= 0 || price <= 0) throw new RangeError("Invalid chart point");
  return { time, price };
}
export function trendLine(a, b) {
  point(a.time,a.price); point(b.time,b.price);
  if (a.time === b.time) throw new RangeError("Trend line requires distinct timestamps");
  const slope = (b.price - a.price) / (b.time - a.time);
  return { kind:"trend-line", anchors:[a,b], priceAt:(time) => {
    if (!finite(time)) throw new RangeError("Invalid timestamp");
    return a.price + slope * (time - a.time);
  }};
}
export function fibonacciRetracement(a, b) {
  point(a.time,a.price); point(b.time,b.price);
  const ratios = [0,0.236,0.382,0.5,0.618,0.786,1];
  return { kind:"fibonacci-retracement", anchors:[a,b], levels:ratios.map(ratio => ({
    ratio, price:a.price + (b.price-a.price)*ratio
  })) };
}
export function riskReward({entry,stop,target,side="long"}) {
  if (![entry,stop,target].every(x=>finite(x)&&x>0)) throw new RangeError("Invalid price");
  if (!["long","short"].includes(side)) throw new RangeError("Invalid side");
  const risk = side==="long" ? entry-stop : stop-entry;
  const reward = side==="long" ? target-entry : entry-target;
  if (risk<=0 || reward<=0) throw new RangeError("Stop and target must match trade direction");
  return {entry,stop,target,side,risk,reward,ratio:reward/risk};
}
export function priceToY(price,{min,max,height}) {
  if (![price,min,max,height].every(finite)||max<=min||height<=0) throw new RangeError("Invalid viewport");
  return height*(max-price)/(max-min);
}
export function timeToX(time,{start,end,width}) {
  if (![time,start,end,width].every(finite)||end<=start||width<=0) throw new RangeError("Invalid viewport");
  return width*(time-start)/(end-start);
}
