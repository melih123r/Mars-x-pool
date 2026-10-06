import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class PublicFxAdapter extends VenueAdapter {
  constructor({name="frankfurter-fx",baseUrl="https://api.frankfurter.app"}={}) {
    super(name,["FX"]); this.baseUrl=baseUrl;
  }
  async getQuote(order){
    const [base,counter]=String(order.instrument.symbol).replace("/","-").split("-");
    if(!base||!counter) throw new Error("FX symbol must be BASE-QUOTE");
    const res=await fetch(`${this.baseUrl}/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(counter)}`,{headers:{accept:"application/json"}});
    if(!res.ok) throw new Error(`${this.name} quote HTTP ${res.status}`);
    const p=await res.json(), px=Number(p?.rates?.[counter]);
    if(!(px>0)) throw new Error(`${this.name} invalid FX rate`);
    const ts=p.date ? new Date(`${p.date}T16:00:00Z`).toISOString() : new Date().toISOString();
    return quote({venue:this.name,price:px,fee:0,timestamp:ts,metadata:{base,counter,source:"public-reference-fx",indicative:true}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}
