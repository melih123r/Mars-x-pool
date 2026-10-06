const key=(symbol,timeframe)=>String(symbol).toUpperCase()+":"+String(timeframe);
export class HistoricalStore {
  constructor({maxBars=10000}={}){this.maxBars=maxBars;this.series=new Map();}
  append({symbol,timeframe,bar}){
    const t=Number(new Date(bar?.time)); const o=Number(bar?.open),h=Number(bar?.high),l=Number(bar?.low),c=Number(bar?.close),v=Number(bar?.volume||0);
    if(!Number.isFinite(t)||![o,h,l,c,v].every(Number.isFinite)||Math.min(o,h,l,c)<=0||v<0||h<Math.max(o,c,l)||l>Math.min(o,c,h)) throw new Error("invalid OHLCV bar");
    const k=key(symbol,timeframe), a=this.series.get(k)||[]; a.push(Object.freeze({time:new Date(t).toISOString(),open:o,high:h,low:l,close:c,volume:v}));
    if(a.length>this.maxBars)a.splice(0,a.length-this.maxBars); this.series.set(k,a); return a.length;
  }
  get(symbol,timeframe,{limit=500}={}){const a=this.series.get(key(symbol,timeframe))||[];return a.slice(-Math.max(1,Math.min(Number(limit)||500,this.maxBars)));}
}
export function replayBars(bars=[],{from=0,to=bars.length}={}){return bars.slice(Math.max(0,from),Math.max(0,to));}
