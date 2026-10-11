// Read-only Binance spot orderbook feed. Node 22+ native WebSocket.
import { bootstrapBinanceDepth } from "./orderbook-binance-bootstrap.js";
const PAIRS=new Set(["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT"]);
export class BinanceDepthFeed {
 constructor({symbol="BTCUSDT",fetchImpl=fetch,WebSocketImpl=globalThis.WebSocket,maxBuffered=3000,onUpdate=()=>{},onStatus=()=>{}}={}){
  if(!PAIRS.has(symbol))throw Error("UNSUPPORTED_SYMBOL");
  if(typeof WebSocketImpl!=="function")throw Error("WEBSOCKET_UNAVAILABLE");
  this.symbol=symbol;this.fetchImpl=fetchImpl;this.WebSocketImpl=WebSocketImpl;this.maxBuffered=maxBuffered;this.onUpdate=onUpdate;this.onStatus=onStatus;
  this.socket=null;this.book=null;this.buffer=[];this.active=false;this.generation=0;
 }
 start(){
  if(this.active)return;this.active=true;const generation=++this.generation;
  const socket=new this.WebSocketImpl("wss://stream.binance.com:9443/ws/"+this.symbol.toLowerCase()+"@depth@100ms");this.socket=socket;
  socket.addEventListener("message",event=>{if(!this.active||generation!==this.generation)return;try{
   const payload=JSON.parse(event.data);if(payload.e!=="depthUpdate"||payload.s!==this.symbol||!Number.isSafeInteger(payload.E))throw Error("INVALID_DEPTH_EVENT");if(!Number.isSafeInteger(payload.U)||!Number.isSafeInteger(payload.u))throw Error("INVALID_SEQUENCE");
   if(!this.book){this.buffer.push(payload);if(this.buffer.length>this.maxBuffered)throw Error("DEPTH_BUFFER_OVERFLOW");return;}
   if(!this.book.ready){const result=this.book.delta(payload);if(result==="APPLIED"){this.onStatus({state:"SYNCHRONIZED"});this.onUpdate({symbol:this.symbol,exchangeEventTime:Number.isSafeInteger(payload.E)?payload.E:null,...this.book.top()});}return;}
   const result=this.book.delta(payload);if(result==="APPLIED")this.onUpdate({symbol:this.symbol,exchangeEventTime:Number.isSafeInteger(payload.E)?payload.E:null,...this.book.top()});
  }catch(e){this.onStatus({state:"RESYNC_REQUIRED",reason:e.message});this.stop();}});
  socket.addEventListener("open",async()=>{if(!this.active||generation!==this.generation)return;this.onStatus({state:"BOOTSTRAPPING"});try{
   const result=await bootstrapBinanceDepth({symbol:this.symbol,events:this.buffer,fetchImpl:this.fetchImpl});
   if(!this.active||generation!==this.generation)return;
   this.book=result.book;
   const pending=this.buffer.splice(0);
   let latestEventTime=null;
   for(const event of pending){if(event.u>this.book.lastUpdateId){this.book.delta(event);latestEventTime=event.E;}}
   this.onStatus({state:this.book.ready?"SYNCHRONIZED":"AWAITING_BRIDGE"});if(this.book.ready&&Number.isSafeInteger(latestEventTime))this.onUpdate({symbol:this.symbol,exchangeEventTime:latestEventTime,...this.book.top()});
  }catch(e){if(this.active&&generation===this.generation){this.onStatus({state:"RESYNC_REQUIRED",reason:e.message});this.stop();}}});
  socket.addEventListener("close",()=>{if(this.active&&generation===this.generation){this.onStatus({state:"DISCONNECTED"});this.stop();}});
  socket.addEventListener("error",()=>{if(this.active&&generation===this.generation){this.onStatus({state:"WEBSOCKET_ERROR"});this.stop();}});
 }
 stop(){this.active=false;this.generation++;this.buffer=[];this.book=null;const socket=this.socket;this.socket=null;if(socket&&typeof socket.close==="function")socket.close();}
}
