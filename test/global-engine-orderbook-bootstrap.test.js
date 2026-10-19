import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapBinanceDepth } from "../global-engine/orderbook-binance-bootstrap.js";
test("Binance bootstrap waits for bridge when snapshot has no buffered diff",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})});
 const result=await bootstrapBinanceDepth({fetchImpl});
 assert.equal(result.status,"AWAITING_BRIDGE");
 assert.equal(result.book.ready,false);
});
test("Binance bootstrap replays buffered events and rejects unsupported pairs",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})});
 const result=await bootstrapBinanceDepth({fetchImpl,events:[{U:101,u:101,b:[["100","2"]],a:[]}]});
 assert.equal(result.status,"SYNCHRONIZED");
 assert.equal(result.book.top().bids[0].quantity,2);
 await assert.rejects(()=>bootstrapBinanceDepth({symbol:"UNLISTED",fetchImpl}),/UNSUPPORTED_SYMBOL/);
});

test("Binance bootstrap rejects snapshot-to-stream sequence gaps",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})});
 await assert.rejects(()=>bootstrapBinanceDepth({fetchImpl,events:[{U:103,u:104,E:Date.now(),b:[],a:[]}]}),/SEQUENCE_GAP_RESYNC_REQUIRED/);
});

test("Binance bootstrap accepts overlapping first update and preserves applied event time",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]})});
 const eventTime=1700000000000;
 const result=await bootstrapBinanceDepth({fetchImpl,events:[{U:99,u:101,E:eventTime,b:[["100","2"]],a:[]}]});
 assert.equal(result.status,"SYNCHRONIZED");
 assert.equal(result.lastEventTime,eventTime);
 assert.equal(result.book.top().bids[0].quantity,2);
});
