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
