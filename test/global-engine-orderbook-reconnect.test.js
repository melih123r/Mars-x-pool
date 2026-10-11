import test from "node:test";
import assert from "node:assert/strict";
import { ResilientBinanceDepthFeed } from "../global-engine/orderbook-binance-reconnect.js";
test("reconnect supervisor retries, resets backoff on synchronization and stops cleanly",()=>{
 const timers=[];const statuses=[];const instances=[];
 class FakeFeed{constructor(opts){this.opts=opts;instances.push(this);}start(){this.started=true;}stop(){this.stopped=true;}}
 const supervisor=new ResilientBinanceDepthFeed({FeedImpl:FakeFeed,baseDelayMs:100,maxDelayMs:400,setTimeoutImpl:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeoutImpl:t=>{t.cancelled=true;},onStatus:s=>statuses.push(s)});
 supervisor.start();assert.equal(instances.length,1);
 instances[0].opts.onStatus({state:"DISCONNECTED"});
 assert.equal(timers[0].ms,100);
 instances[0].opts.onStatus({state:"WEBSOCKET_ERROR"});
 assert.equal(timers.length,1);
 timers[0].fn();assert.equal(instances.length,2);
 instances[1].opts.onStatus({state:"SYNCHRONIZED"});
 instances[1].opts.onStatus({state:"RESYNC_REQUIRED"});
 assert.equal(timers[1].ms,100);
 supervisor.stop();assert.equal(timers[1].cancelled,true);
 assert.equal(instances[1].stopped,true);
 assert.equal(supervisor.active,false);
});
test("reconnect supervisor uses bounded exponential backoff",()=>{
 const timers=[];const instances=[];
 class FakeFeed{constructor(opts){this.opts=opts;instances.push(this);}start(){}stop(){}}
 const supervisor=new ResilientBinanceDepthFeed({FeedImpl:FakeFeed,baseDelayMs:100,maxDelayMs:250,setTimeoutImpl:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;}});
 supervisor.start();
 for(let i=0;i<4;i++){instances.at(-1).opts.onStatus({state:"DISCONNECTED"});timers.at(-1).fn();}
 assert.deepEqual(timers.map(t=>t.ms),[100,200,250,250]);
 supervisor.stop();
});
