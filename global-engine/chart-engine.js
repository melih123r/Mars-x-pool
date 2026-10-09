const TIMEFRAMES=Object.freeze({"1m":60_000,"5m":300_000,"15m":900_000,"30m":1_800_000,"1h":3_600_000,"4h":14_400_000,"1d":86_400_000,"1w":604_800_000,"1M":2_592_000_000});
const finite=(v)=>Number.isFinite(Number(v));
const n=(v,name)=>{const x=Number(v);if(!Number.isFinite(x))throw new Error(`${name} must be finite`);return x;};
export function normalizeCandle(c){
  if(!c||typeof c!=="object")throw new Error("candle required");
  const x={time:n(c.time,"time"),open:n(c.open,"open"),high:n(c.high,"high"),low:n(c.low,"low"),close:n(c.close,"close"),volume:n(c.volume??0,"volume")};
  if(x.time<=0||x.open<=0||x.high<=0||x.low<=0||x.close<=0||x.volume<0)throw new Error("invalid candle values");
  if(x.high<Math.max(x.open,x.close,x.low)||x.low>Math.min(x.open,x.close,x.high))throw new Error("invalid OHLC range");
  return x;
}
export function normalizeSeries(rows=[]){
  const out=rows.map(normalizeCandle).sort((a,b)=>a.time-b.time);
  for(let i=1;i<out.length;i++)if(out[i].time===out[i-1].time)throw new Error("duplicate candle timestamp");
  return out;
}
export function resampleCandles(rows,timeframe){
  const ms=TIMEFRAMES[timeframe];if(!ms)throw new Error("unsupported timeframe");
  const buckets=new Map();
  for(const c of normalizeSeries(rows)){const t=Math.floor(c.time/ms)*ms;const b=buckets.get(t);
    if(!b)buckets.set(t,{time:t,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume});
    else{b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);b.close=c.close;b.volume+=c.volume;}
  }return [...buckets.values()];
}
const values=(rows,key="close")=>normalizeSeries(rows).map(x=>x[key]);
export function sma(rows,period=20){if(!Number.isInteger(period)||period<1)throw new Error("invalid period");const a=values(rows);return a.map((_,i)=>i+1<period?null:a.slice(i-period+1,i+1).reduce((s,v)=>s+v,0)/period);}
export function ema(rows,period=20){if(!Number.isInteger(period)||period<1)throw new Error("invalid period");const a=values(rows),k=2/(period+1);let e=null;return a.map((v,i)=>{if(i+1<period)return null;if(e===null)e=a.slice(0,period).reduce((s,x)=>s+x,0)/period;else e=v*k+e*(1-k);return e;});}
export function rsi(rows,period=14){const a=values(rows),out=Array(a.length).fill(null);if(a.length<=period)return out;let g=0,l=0;for(let i=1;i<=period;i++){const d=a[i]-a[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);}g/=period;l/=period;out[period]=l===0?100:100-100/(1+g/l);for(let i=period+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*(period-1)+Math.max(d,0))/period;l=(l*(period-1)+Math.max(-d,0))/period;out[i]=l===0?100:100-100/(1+g/l);}return out;}
export function bollinger(rows,period=20,mult=2){const a=values(rows),mid=sma(rows,period);return a.map((_,i)=>{if(mid[i]===null)return null;const w=a.slice(i-period+1,i+1),variance=w.reduce((s,v)=>s+(v-mid[i])**2,0)/period,sd=Math.sqrt(variance);return{middle:mid[i],upper:mid[i]+mult*sd,lower:mid[i]-mult*sd};});}
export function macd(rows,fast=12,slow=26,signal=9){if(fast>=slow)throw new Error("fast must be below slow");const f=ema(rows,fast),s=ema(rows,slow),line=f.map((v,i)=>v===null||s[i]===null?null:v-s[i]);let e=null,k=2/(signal+1),seen=[];const sig=line.map(v=>{if(v===null)return null;seen.push(v);if(seen.length<signal)return null;if(e===null)e=seen.slice(-signal).reduce((a,b)=>a+b,0)/signal;else e=v*k+e*(1-k);return e;});return line.map((v,i)=>({macd:v,signal:sig[i],histogram:v===null||sig[i]===null?null:v-sig[i]}));}
export function chartQuality(rows,{now=Date.now(),maxStaleMs=120_000}={}){const a=normalizeSeries(rows);if(!a.length)return{ok:false,reason:"NO_DATA",count:0};const age=Math.max(0,now-a.at(-1).time);return{ok:age<=maxStaleMs,reason:age<=maxStaleMs?"OK":"STALE",count:a.length,lastTimestamp:a.at(-1).time,ageMs:age};}
export function chartSnapshot(rows,{timeframe="1m"}={}){const candles=resampleCandles(rows,timeframe);return{timeframe,candles,indicators:{sma20:sma(candles,20),ema20:ema(candles,20),rsi14:rsi(candles,14),macd:macd(candles),bollinger20:bollinger(candles,20)}};}
export {TIMEFRAMES};
