// Binance spot diff-depth synchronization. No trading credentials or execution.
export class BinanceDepthBook {
  constructor(){this.reset();}
  reset(){this.ready=false;this.lastUpdateId=null;this.bids=new Map();this.asks=new Map();}
  static levels(rows){const out=new Map();for(const [p,q] of rows){const price=Number(p),qty=Number(q);if(!Number.isFinite(price)||price<=0||!Number.isFinite(qty)||qty<0)throw Error("INVALID_LEVEL");out.set(String(p),String(q));}return out;}
  snapshot({lastUpdateId,bids,asks}){if(!Number.isSafeInteger(lastUpdateId)||lastUpdateId<0)throw Error("INVALID_SNAPSHOT_ID");this.bids=new Map([...BinanceDepthBook.levels(bids)].filter(([,q])=>Number(q)>0));this.asks=new Map([...BinanceDepthBook.levels(asks)].filter(([,q])=>Number(q)>0));this.lastUpdateId=lastUpdateId;this.ready=false;}
  delta({U,u,b,a}){if(this.lastUpdateId===null)throw Error("SNAPSHOT_REQUIRED");if(!Number.isSafeInteger(U)||!Number.isSafeInteger(u)||U>u)throw Error("INVALID_SEQUENCE");if(u<=this.lastUpdateId)return "STALE";if(U>this.lastUpdateId+1){this.reset();throw Error("SEQUENCE_GAP_RESYNC_REQUIRED");}const bids=BinanceDepthBook.levels(b),asks=BinanceDepthBook.levels(a);for(const [p,q] of bids){if(Number(q)===0)this.bids.delete(p);else this.bids.set(p,q);}for(const [p,q] of asks){if(Number(q)===0)this.asks.delete(p);else this.asks.set(p,q);}this.lastUpdateId=u;this.ready=true;return "APPLIED";}
  top(depth=10){if(!this.ready)throw Error("BOOK_NOT_SYNCHRONIZED");const order=(map,desc)=>[...map].map(([price,quantity])=>({price:Number(price),quantity:Number(quantity)})).sort((a,b)=>desc?b.price-a.price:a.price-b.price).slice(0,depth);return {bids:order(this.bids,true),asks:order(this.asks,false),lastUpdateId:this.lastUpdateId};}
}
