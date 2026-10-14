import test from "node:test";
import assert from "node:assert/strict";
import { BinanceDepthFeed } from "../global-engine/orderbook-binance-feed.js";
class FakeSocket {
 constructor(url){this.url=url;this.handlers=new Map();FakeSocket.instance=this;}
 addEventListener(type,handler){this.handlers.set(type,handler);}
 emit(type,data){this.handlers.get(type)?.(data===undefined?{}:{data:JSON.stringify(data)});}
 close(){this.closed=true;}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test("feed bridges events received while REST snapshot is pending",async()=>{
 let resolveSnapshot;const updates=[],statuses=[];
 const fetchImpl=()=>new Promise(resolve=>{resolveSnapshot=()=>resolve({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})});});
 const feed=new BinanceDepthFeed({fetchImpl,WebSocketImpl:FakeSocket,onUpdate:x=>updates.push(x),onStatus:x=>statuses.push(x.state)});
 feed.start();FakeSocket.instance.emit("open");
 FakeSocket.instance.emit("message",{e:"depthUpdate",s:"BTCUSDT",E:Date.now(),U:101,u:101,b:[["100","2"]],a:[]});
 resolveSnapshot();await flush();await flush();
 assert.equal(updates.at(-1).bids[0].quantity,2);
 FakeSocket.instance.emit("message",{e:"depthUpdate",s:"BTCUSDT",E:Date.now(),U:102,u:102,b:[["100","3"]],a:[]});
 assert.equal(updates.at(-1).bids[0].quantity,3);
 feed.stop();
});
test("feed synchronizes on first event after empty snapshot buffer",async()=>{
 const updates=[];
 const feed=new BinanceDepthFeed({fetchImpl:async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})}),WebSocketImpl:FakeSocket,onUpdate:x=>updates.push(x)});
 feed.start();FakeSocket.instance.emit("open");await flush();await flush();
 assert.equal(feed.book.ready,false);
 FakeSocket.instance.emit("message",{e:"depthUpdate",s:"BTCUSDT",E:Date.now(),U:101,u:101,b:[["100","2"]],a:[]});
 assert.equal(updates.at(-1).bids[0].quantity,2);
 feed.stop();
});
