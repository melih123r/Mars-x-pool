import test from 'node:test';
import assert from 'node:assert/strict';
import {splitReceipt,recordSettledReceipt} from './settlement.mjs';

test('1000 users: exact 80/20 settlement allocation',()=>{
 const a=Array.from({length:1000},(_,i)=>({userId:'user-'+i,amountMinor:80}));
 const r=splitReceipt(100000,a);
 assert.equal(r.platformMinor,20000);
 assert.equal(r.usersMinor,80000);
 assert.equal(r.allocations.length,1000);
});
test('rejects double user, rounding mismatch, negative and overflow',()=>{
 assert.throws(()=>splitReceipt(100,[{userId:'x',amountMinor:79}]));
 assert.throws(()=>splitReceipt(100,[{userId:'x',amountMinor:40},{userId:'x',amountMinor:40}]));
 assert.throws(()=>splitReceipt(-1,[{userId:'x',amountMinor:0}]));
 assert.throws(()=>splitReceipt(Number.MAX_SAFE_INTEGER,[{userId:'x',amountMinor:Number.MAX_SAFE_INTEGER}]));
});
test('fails closed without configured PostgreSQL',async()=>{
 await assert.rejects(recordSettledReceipt(null,{receiptId:'r'},[]),/database required/);
});
