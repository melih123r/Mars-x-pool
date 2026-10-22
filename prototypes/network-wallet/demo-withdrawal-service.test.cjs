'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDemoWithdrawalService}=require('./demo-withdrawal-service.cjs');
const sol='FqxVPDjwwMyT4y2tRsQia2pXpwCcgGnH3J4HMhqAkwcU';
test('demo request reserves once and never broadcasts',()=>{
 const svc=createDemoWithdrawalService();svc.setDemoBalance('user-1',2000000);
 const destination=svc.registerDestination({userId:'user-1',idempotencyKey:'destination-key-1',network:'SOLANA',address:sol,verificationToken:'demo-token-1'});
 const p={userId:'user-1',idempotencyKey:'key-1',destinationId:destination.id,asset:'USDT',amountMinor:1000000};
 const a=svc.requestWithdrawal(p);const b=svc.requestWithdrawal(p);
 assert.deepEqual(a,b);assert.equal(a.broadcastEnabled,false);assert.equal(a.payoutsEnabled,false);assert.equal(a.transactionId,null);assert.equal(a.isDemo,true);assert.equal(svc.getDemoBalance('user-1'),1000000);
});
test('reject insufficient demo balance',()=>{
 const svc=createDemoWithdrawalService();svc.setDemoBalance('user-2',100);
 const destination=svc.registerDestination({userId:'user-2',idempotencyKey:'destination-key-2',network:'SOLANA',address:sol,verificationToken:'demo-token-2'});
 assert.throws(()=>svc.requestWithdrawal({userId:'user-2',idempotencyKey:'key-2',destinationId:destination.id,amountMinor:101}),/INSUFFICIENT/);
});
test('reject missing authentication context',()=>{
 const svc=createDemoWithdrawalService();
 assert.throws(()=>svc.registerDestination({userId:'',idempotencyKey:'destination-key',network:'SOLANA',address:sol,verificationToken:'demo-token'}),/INVALID_USER_ID/);
});

