import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class PublicCryptoAdapter extends VenueAdapter {
  constructor({name,urlFor,parse,feeBps=0}) {
    super(name,["CRYPTO"]); this.urlFor=urlFor; this.parse=parse; this.feeBps=feeBps;
  }
  async getQuote(order) {
    const res=await fetch(this.urlFor(order.instrument),{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});
    if(!res.ok) throw new Error(`${this.name} quote HTTP ${res.status}`);
    const payload=await res.json();
    const book=this.parse(payload,order) || {};
    const bid=Number(book.bid), ask=Number(book.ask);
    const px=order.side==="BUY" ? ask : bid;
    if(!(bid>0) || !(ask>=bid) || !(px>0)) throw new Error(`${this.name} invalid bid/ask`);
    const notional=Number(order.amount);
    const fee=notional*this.feeBps/10000;
    return quote({venue:this.name,price:px,fee,timestamp:book.timestamp||new Date().toISOString(),metadata:{bid,ask,feeBps:this.feeBps,source:"public-read-only",executable:false}});
  }
  async placeOrder(){ throw new Error("live execution disabled"); }
}

export const coinbaseBtcUsd=()=>new PublicCryptoAdapter({
  name:"coinbase-public",
  urlFor:()=>"https://api.exchange.coinbase.com/products/BTC-USD/ticker",
  parse:p=>({bid:p.bid,ask:p.ask})
});

export const krakenBtcUsd=()=>new PublicCryptoAdapter({
  name:"kraken-public",
  urlFor:()=>"https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
  parse:p=>{ const x=Object.values(p.result||{})[0]||{}; return {bid:x.b?.[0],ask:x.a?.[0]}; }
});
