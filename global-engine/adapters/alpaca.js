import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class AlpacaMarketDataAdapter extends VenueAdapter {
  constructor({key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET,baseUrl="https://data.alpaca.markets"}={}) {
    super("alpaca-market-data",["EQUITY","ETF"]);
    this.key=key; this.secret=secret; this.baseUrl=baseUrl;
  }
  async getQuote(order) {
    if(!this.key || !this.secret) throw new Error("Alpaca market-data credentials are not configured");
    const symbol=encodeURIComponent(order.instrument.symbol);
    const res=await fetch(`${this.baseUrl}/v2/stocks/${symbol}/quotes/latest`,{headers:{"APCA-API-KEY-ID":this.key,"APCA-API-SECRET-KEY":this.secret,"accept":"application/json"}});
    if(!res.ok) throw new Error(`alpaca quote HTTP ${res.status}`);
    const p=await res.json(), q=p.quote || {};
    const px=order.side==="BUY" ? Number(q.ap) : Number(q.bp);
    return quote({venue:this.name,price:px,fee:0,timestamp:q.t || new Date().toISOString(),metadata:{bid:Number(q.bp),ask:Number(q.ap),source:"alpaca-read-only"}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}
