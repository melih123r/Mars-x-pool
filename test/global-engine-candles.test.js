import test from "node:test";
import assert from "node:assert/strict";
import {fetchBinanceCandles} from "../global-engine/candles-binance.js";
const valid=[1700000000000,"100","110","90","105","12",1700000059999];
test("public candles parse valid OHLCV without credentials",async()=>{
 const data=await fetchBinanceCandles({limit:1,fetchImpl:async()=>({ok:true,json:async()=>[valid]})});
 assert.equal(data.candles.length,1);assert.equal(data.candles[0].close,105);assert.equal(data.executionReady,false);
});
test("public candles reject invalid parameters before fetch",async()=>{
 await assert.rejects(fetchBinanceCandles({symbol:"INVALID",fetchImpl:()=>{throw Error("FETCH_CALLED");}}),/UNSUPPORTED_SYMBOL/);
 await assert.rejects(fetchBinanceCandles({interval:"2m"}),/UNSUPPORTED_INTERVAL/);
 await assert.rejects(fetchBinanceCandles({limit:9999}),/INVALID_LIMIT/);
});
test("public candles reject impossible OHLC and unordered times",async()=>{
 await assert.rejects(fetchBinanceCandles({limit:1,fetchImpl:async()=>({ok:true,json:async()=>[[...valid.slice(0,2),"95",...valid.slice(3)]]})}),/INVALID_CANDLE/);
 await assert.rejects(fetchBinanceCandles({limit:2,fetchImpl:async()=>({ok:true,json:async()=>[valid,valid]})}),/UNSORTED_CANDLES/);
});
