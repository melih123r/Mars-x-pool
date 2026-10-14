import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class MetalsDevGoldAdapter extends VenueAdapter {
  constructor({apiKey=process.env.METALS_DEV_API_KEY,baseUrl="https://api.metals.dev/v1"}={}) {
    super("metals-dev-gold",["COMMODITY"]); this.apiKey=apiKey; this.baseUrl=baseUrl;
  }
  supports(instrument){ return super.supports(instrument) && String(instrument.symbol).toUpperCase()==="XAU-USD"; }
  async getQuote(order){
    if(!this.apiKey) throw new Error("Metals.Dev API key is not configured");
    if(!this.supports(order.instrument)) throw new Error("metals-dev-gold unsupported instrument");
    const u=new URL(`${this.baseUrl}/metal/spot`);
    u.searchParams.set("api_key",this.apiKey); u.searchParams.set("metal","gold"); u.searchParams.set("currency","USD");
    const res=await fetch(u,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
    if(!res.ok) throw new Error(`metals-dev quote HTTP ${res.status}`);
    const p=await res.json(), bid=Number(p?.rate?.bid), ask=Number(p?.rate?.ask);
    const px=order.side==="BUY"?ask:bid;
    if(!(bid>0)||!(ask>=bid)||!(px>0)) throw new Error("metals-dev invalid bid/ask");
    return quote({venue:this.name,price:px,fee:0,timestamp:p.timestamp||new Date().toISOString(),metadata:{bid,ask,source:"metals-dev-read-only",indicative:true,executable:false}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}
