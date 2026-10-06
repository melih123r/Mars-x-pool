import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class PublicCryptoAdapter extends VenueAdapter {
  constructor({name, urlFor, parse, feeBps=0}) {
    super(name,["CRYPTO"]); this.urlFor=urlFor; this.parse=parse; this.feeBps=feeBps;
  }
  async getQuote(order) {
    const res=await fetch(this.urlFor(order.instrument),{headers:{"accept":"application/json"}});
    if(!res.ok) throw new Error(`${this.name} quote HTTP ${res.status}`);
    const payload=await res.json();
    const px=Number(this.parse(payload,order));
    if(!(px>0)) throw new Error(`${this.name} invalid price`);
    return quote({venue:this.name,price:px,fee:px*this.feeBps/10000,timestamp:new Date().toISOString(),metadata:{source:"public-read-only"}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}

export const coinbaseBtcUsd = () => new PublicCryptoAdapter({
  name:"coinbase-public",
  urlFor:()=> "https://api.exchange.coinbase.com/products/BTC-USD/ticker",
  parse:p=>p.price
});

export const krakenBtcUsd = () => new PublicCryptoAdapter({
  name:"kraken-public",
  urlFor:()=> "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
  parse:p=>Object.values(p.result || {})[0]?.c?.[0]
});
