import test from "node:test";
import assert from "node:assert/strict";
import {ChangeNowAdapter} from "../global-engine/adapters/changenow.js";
const intent={fromCurrency:"btc",toCurrency:"eth",fromNetwork:"btc",toNetwork:"eth",fromAmount:"0.01",address:"0xD1220A0cf47c7B9Be7A2E6A89F429762e7b9aDb",confirmed:true};
test("live creation is disabled by default and never calls network",async()=>{
 const adapter=new ChangeNowAdapter({apiKey:"dummy"});
 await assert.rejects(adapter.createTransaction(intent),/disabled/);
});
test("explicit confirmation and validated inputs required even when locally enabled",async()=>{
 const adapter=new ChangeNowAdapter({apiKey:"dummy",allowTransactions:true});
 await assert.rejects(adapter.createTransaction({...intent,confirmed:false}),/confirmation/);
 await assert.rejects(adapter.createTransaction({...intent,fromAmount:"0.01e9"}),/amount/);
 await assert.rejects(adapter.createTransaction({...intent,address:"bad"}),/destination/);
 await assert.rejects(adapter.createTransaction({...intent,flow:"fixed-rate"}),/flow/);
});
test("production request is not sent unless separately enabled; payload is server-only",async()=>{
 const adapter=new ChangeNowAdapter({apiKey:"dummy",allowTransactions:true});
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,"https://api.changenow.io/v2/exchange");
  assert.equal(options.method,"POST");
  assert.equal(options.headers["x-changenow-api-key"],"dummy");
  const body=JSON.parse(options.body);
  assert.equal(body.fromAmount,"0.01");
  assert.equal(body.address,intent.address);
  assert.equal(body.flow,"standard");
  assert.equal(body.confirmed,undefined);
  return {ok:true,headers:{get:()=>null},body:null,text:async()=>JSON.stringify({id:"mock-transaction",payinAddress:"mock-address"})};
 };
 try {assert.equal((await adapter.createTransaction(intent)).id,"mock-transaction");assert.equal(calls,1);}
 finally {globalThis.fetch=original;}
});
