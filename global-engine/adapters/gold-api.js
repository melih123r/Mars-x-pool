import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

const SYMBOLS=new Map([["XAU-USD","XAU"],["XAG-USD","XAG"],["XPT-USD","XPT"],["XPD-USD","XPD"],["HG-USD","HG"]]);
export class GoldApiAdapter extends VenueAdapter {
  constructor({baseUrl="https://api.gold-api.com"}={}) { super("gold-api-public",["COMMODITY"]); this.baseUrl=baseUrl; }
  supports(instrument){ return super.supports(instrument) && SYMBOLS.has(String(instrument.symbol).toUpperCase()); }
  async getQuote(order){
    const symbol=String(order.instrument.symbol).toUpperCase(), asset=SYMBOLS.get(symbol);
    if(!asset) throw new Error("gold-api-public unsupported instrument");
    const res=await fetch(`${this.baseUrl}/price/${asset}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
    if(!res.ok) throw new Error(`gold-api quote HTTP ${res.status}`);
    const p=await res.json(), px=Number(p.price);
    if(!(px>0)) throw new Error("gold-api invalid price");
    return quote({venue:this.name,price:px,fee:0,timestamp:p.updatedAt||p.updated_at||new Date().toISOString(),metadata:{asset,source:"gold-api-public",reference:true,indicative:true,executable:false}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}
