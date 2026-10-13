import test from "node:test";
import assert from "node:assert/strict";
import {ChangeNowAdapter} from "../global-engine/adapters/changenow.js";

const intent={fromCurrency:"btc",toCurrency:"eth",fromNetwork:"btc",toNetwork:"eth",fromAmount:"0.01",address:"0xD1220A0cf47c7B9Be7A2E6A89F429762e7b9aDb",confirmed:true,durableClaimVerified:true};

test("ChangeNOW transaction creation stays disabled by default",async()=>{
 const adapter=new ChangeNowAdapter({apiKey:"dummy"});
 await assert.rejects(adapter.createTransaction(intent),/disabled/);
});

test("caller-controlled idempotency flag cannot unlock real transactions",async()=>{
 const adapter=new ChangeNowAdapter({apiKey:"dummy",allowTransactions:true});
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error("network must not be called");};
 try {
  await assert.rejects(adapter.createTransaction(intent),e=>e.status===503&&/orchestrator_not_implemented/.test(e.message));
  await assert.rejects(adapter.createTransaction({...intent,durableClaimVerified:false}),/orchestrator_not_implemented/);
  assert.equal(calls,0);
 } finally {globalThis.fetch=original;}
});
