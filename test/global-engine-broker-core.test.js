import test from "node:test";
import assert from "node:assert/strict";
import { BrokerLedger,BrokerOrderStore,BrokerReconciler,brokerProviderScorecard,brokerSafetyStatus } from "../global-engine/broker-core.js";

test("orders are idempotent and enforce lifecycle",()=>{
 const s=new BrokerOrderStore();
 const a=s.create({accountId:"a",idempotencyKey:"k1",symbol:"AAPL",side:"BUY",quantity:1});
 const b=s.create({accountId:"a",idempotencyKey:"k1",symbol:"AAPL",side:"BUY",quantity:1});
 assert.equal(a.id,b.id);
 s.transition(a.id,"PENDING_SUBMIT"); s.transition(a.id,"SUBMITTED");
 s.transition(a.id,"PARTIALLY_FILLED",{filledQuantity:.5});
 s.transition(a.id,"FILLED",{filledQuantity:1});
 assert.throws(()=>s.transition(a.id,"CANCELLED"),/invalid order transition/);
});

test("ledger is immutable-ish and idempotent",()=>{
 const l=new BrokerLedger();
 const e=l.post({idempotencyKey:"e1",accountId:"a",debit:"CASH",credit:"SETTLEMENT",amount:10,type:"TRADE"});
 assert.equal(e.amount,10);
 assert.deepEqual(l.post({idempotencyKey:"e1",accountId:"a",debit:"CASH",credit:"SETTLEMENT",amount:10,type:"TRADE"}),{duplicate:true});
 assert.throws(()=>l.post({idempotencyKey:"e2",accountId:"a",debit:"CASH",credit:"CASH",amount:10,type:"BAD"}),/invalid ledger entry/);
});

test("reconciliation detects mismatch and never auto-corrects",()=>{
 const r=new BrokerReconciler().compare({internalCash:100,providerCash:99,internalPositions:{AAPL:1},providerPositions:{AAPL:.5}});
 assert.equal(r.ok,false); assert.equal(r.autoCorrected,false); assert.equal(r.mismatches.length,2);
});

test("production money movement remains locked",()=>{
 const s=brokerSafetyStatus();
 assert.equal(s.liveExecution,false); assert.equal(s.withdrawals,false); assert.equal(s.custody,false);
});

test("broker scorecard ranks providers without enabling execution",()=>{
 const providers=brokerProviderScorecard({lemonConfigured:true,alpacaConfigured:true});
 assert.equal(providers[0].id,"lemon-markets");
 assert.ok(providers.some(p=>p.id==="alpaca-broker"&&p.configured));
 assert.ok(providers.some(p=>p.id==="upvest"&&p.recommended));
 assert.ok(providers.every(p=>p.executionReady===false));
 assert.ok(providers.every(p=>p.liveTrading===false&&p.withdrawals===false&&p.custody===false));
 assert.ok(providers.find(p=>p.id==="ibkr").blockers.includes("gateway/session operations"));
});
