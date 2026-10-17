export class HistoricalCollector {
  constructor({repository,fetchBars}){if(!repository||typeof fetchBars!=="function")throw new Error("repository and fetchBars required");this.repository=repository;this.fetchBars=fetchBars;}
  async collect({symbol,timeframe,limit=500,source="unknown"}){
    const bars=await this.fetchBars({symbol,timeframe,limit}); if(!Array.isArray(bars))throw new Error("collector expected bars");
    let written=0; for(const b of bars){await this.repository.append({symbol:String(symbol).toUpperCase(),timeframe,time:b.time,open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume||0),source});written++;}
    return {symbol:String(symbol).toUpperCase(),timeframe,source,written};
  }
}
