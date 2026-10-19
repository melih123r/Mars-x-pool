// Supervise a read-only market-data feed with bounded exponential backoff.
// No trading endpoints, keys, or user orders.
import { BinanceDepthFeed } from "./orderbook-binance-feed.js";
export class ResilientBinanceDepthFeed {
 constructor({FeedImpl=BinanceDepthFeed,setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout,baseDelayMs=1000,maxDelayMs=30000,...feedOptions}={}){
  this.FeedImpl=FeedImpl;this.setTimeoutImpl=setTimeoutImpl;this.clearTimeoutImpl=clearTimeoutImpl;
  this.baseDelayMs=baseDelayMs;this.maxDelayMs=maxDelayMs;this.feedOptions=feedOptions;
  this.active=false;this.feed=null;this.timer=null;this.attempt=0;this.generation=0;
 }
 start(){if(this.active)return;this.active=true;this.generation++;this.connect();}
 connect(){
  if(!this.active)return;
  const generation=this.generation;
  this.feed=new this.FeedImpl({...this.feedOptions,
   onUpdate:data=>{if(this.active&&generation===this.generation)this.feedOptions.onUpdate?.(data);},
   onStatus:status=>{
    if(!this.active||generation!==this.generation)return;
    this.feedOptions.onStatus?.(status);
    if(status.state==="SYNCHRONIZED"){this.attempt=0;return;}
    if(["DISCONNECTED","WEBSOCKET_ERROR","RESYNC_REQUIRED"].includes(status.state))this.scheduleReconnect();
   }
  });
  try{this.feed.start();}catch(error){this.feedOptions.onStatus?.({state:"CONNECT_ERROR",reason:error.message});this.scheduleReconnect();}
 }
 scheduleReconnect(){
  if(!this.active||this.timer!==null)return;
  const oldFeed=this.feed;this.feed=null;oldFeed?.stop();
  const delay=Math.min(this.maxDelayMs,this.baseDelayMs*2**Math.min(this.attempt++,16));
  this.feedOptions.onStatus?.({state:"RECONNECT_WAIT",delayMs:delay});
  this.timer=this.setTimeoutImpl(()=>{this.timer=null;if(this.active)this.connect();},delay);
 }
 stop(){this.active=false;this.generation++;if(this.timer!==null){this.clearTimeoutImpl(this.timer);this.timer=null;}this.feed?.stop();this.feed=null;this.attempt=0;}
}
