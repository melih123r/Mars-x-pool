import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

export class PublicCryptoAdapter extends VenueAdapter {
  constructor({name,urlFor,parse,symbols=["BTC-USD"],feeBps=0}) {
    super(name,["CRYPTO"]); this.urlFor=urlFor; this.parse=parse; this.symbols=new Set(symbols.map(x=>String(x).toUpperCase())); this.feeBps=feeBps;
  }
  supports(instrument) { return super.supports(instrument) && this.symbols.has(String(instrument.symbol).toUpperCase()); }
  async getQuote(order) {
    if(!this.supports(order.instrument)) throw new Error(`${this.name} unsupported instrument`);
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

const krakenPair=i=>({"BTC-USD":"XBTUSD","ETH-USD":"ETHUSD"}[String(i.symbol).toUpperCase()]);
const bybitPair=i=>({
  "BTC-USD":"BTCUSDT",
  "ETH-USD":"ETHUSDT",
  "SOL-USD":"SOLUSDT",
  "BNB-USD":"BNBUSDT",
  "DOGE-USD":"DOGEUSDT"
}[String(i.symbol).toUpperCase()]);

export const coinbaseCryptoUsd=()=>new PublicCryptoAdapter({
  name:"coinbase-public", symbols:["BTC-USD","ETH-USD"],
  urlFor:i=>`https://api.exchange.coinbase.com/products/${encodeURIComponent(String(i.symbol).toUpperCase())}/ticker`,
  parse:p=>({bid:p.bid,ask:p.ask})
});

export const krakenCryptoUsd=()=>new PublicCryptoAdapter({
  name:"kraken-public", symbols:["BTC-USD","ETH-USD"],
  urlFor:i=>`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(krakenPair(i))}`,
  parse:p=>{ const x=Object.values(p.result||{})[0]||{}; return {bid:x.b?.[0],ask:x.a?.[0]}; }
});

export const bybitCryptoUsd=()=>new PublicCryptoAdapter({
  name:"bybit-public", symbols:["BTC-USD","ETH-USD","SOL-USD","BNB-USD","DOGE-USD"],
  urlFor:i=>`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${encodeURIComponent(bybitPair(i))}`,
  parse:p=>{
    if(p.retCode!==0) throw new Error("Bybit ticker rejected");
    const x=p.result?.list?.[0]||{};
    return {bid:x.bid1Price,ask:x.ask1Price,timestamp:x.ts?new Date(Number(x.ts)).toISOString():undefined};
  }
});

export const coinbaseBtcUsd=coinbaseCryptoUsd;
export const krakenBtcUsd=krakenCryptoUsd;
