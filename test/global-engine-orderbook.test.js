import test from "node:test";
import assert from "node:assert/strict";
import { BinanceDepthBook } from "../global-engine/orderbook-binance.js";
test("Binance depth: snapshot bridge, update, delete and stale event",()=>{
 const book=new BinanceDepthBook();
 assert.throws(()=>book.top(),/BOOK_NOT_SYNCHRONIZED/);
 book.snapshot({lastUpdateId:100,bids:[["100","2"]],asks:[["101","3"]]});
 assert.equal(book.delta({U:100,u:102,b:[["100","0"],["99","4"]],a:[["101","2"]]}),"APPLIED");
 assert.deepEqual(book.top().bids,[{price:99,quantity:4}]);
 assert.deepEqual(book.top().asks,[{price:101,quantity:2}]);
 assert.equal(book.delta({U:100,u:101,b:[],a:[]}),"STALE");
});
test("Binance depth: missing event resets and requires fresh snapshot",()=>{
 const book=new BinanceDepthBook();
 book.snapshot({lastUpdateId:10,bids:[],asks:[]});
 assert.throws(()=>book.delta({U:12,u:13,b:[],a:[]}),/SEQUENCE_GAP_RESYNC_REQUIRED/);
 assert.equal(book.ready,false);
 assert.throws(()=>book.delta({U:14,u:15,b:[],a:[]}),/SNAPSHOT_REQUIRED/);
});
test("Binance depth: malformed levels rejected",()=>{
 const book=new BinanceDepthBook();
 assert.throws(()=>book.snapshot({lastUpdateId:1,bids:[["-1","2"]],asks:[]}),/INVALID_LEVEL/);
});
