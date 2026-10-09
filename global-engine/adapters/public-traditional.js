import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

// Generic read-only adapter for public/demo traditional-market feeds.
// A concrete provider is configured later; no credentials are embedded in source.
export class PublicTraditionalAdapter extends VenueAdapter {
  constructor({name,assetClasses=["EQUITY","FX","ETF","COMMODITY"],fetchQuote}) {
    super(name,assetClasses); this.fetchQuote=fetchQuote;
  }
  async getQuote(order) {
    const raw=await this.fetchQuote(order.instrument);
    return quote({venue:this.name,price:Number(raw.price),fee:Number(raw.fee||0),timestamp:raw.timestamp||new Date().toISOString(),metadata:{...(raw.metadata||{}),source:"read-only"}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}
