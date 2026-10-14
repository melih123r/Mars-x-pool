import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class PublicFxAdapter extends VenueAdapter {
  constructor({name="frankfurter-fx",baseUrl="https://api.frankfurter.app"}={}) {
    super(name,["FX"]); this.baseUrl=baseUrl;
  }
  async getQuote(order){
    const [base,counter]=String(order.instrument.symbol).replace("/","-").split("-");
    if(!base||!counter) throw new Error("FX symbol must be BASE-QUOTE");
    const res=await fetch(`${this.baseUrl}/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(counter)}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
    if(!res.ok) throw new Error(`${this.name} quote HTTP ${res.status}`);
    const p=await res.json(),px=Number(p?.rates?.[counter]);
    if(!(px>0)) throw new Error(`${this.name} invalid FX rate`);
    // Reference-rate dates are daily, so mark them with retrieval time and preserve source date.
    // They are never executable and must not be used as broker-quality bid/ask.
    return quote({venue:this.name,price:px,fee:0,timestamp:new Date().toISOString(),metadata:{base,counter,referenceDate:p.date||null,source:"public-reference-fx",indicative:true,executable:false}});
  }
  async placeOrder(){throw new Error("live execution disabled");}
}
