'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDemoWithdrawalService}=require('./demo-withdrawal-service.cjs');

const sol='FqxVPDjwwMyT4y2tRsQia2pXpwCcgGnH3J4HMhqAkwcU';
const tron='TT3RpGfvUScgAG3GYULcimxFXEUnPPNfGZ';

function register(svc,userId='user-1',network='SOLANA',address=sol) {
  return svc.registerDestination({
    userId,
    idempotencyKey:'destination-key-'+userId,
    network,
    address,
    verificationToken:'demo-token-'+userId
  });
}

test('demo request reserves once and never broadcasts',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('user-1',2000000);
  const destination=register(svc);
  const input={
    userId:'user-1',
    idempotencyKey:'withdrawal-key-1',
    destinationId:destination.id,
    asset:'USDT',
    amountMinor:1000000
  };
  const first=svc.requestWithdrawal(input);
  const retry=svc.requestWithdrawal(input);
  assert.deepEqual(retry,first);
  assert.equal(first.broadcast,false);
  assert.equal(first.broadcastEnabled,false);
  assert.equal(first.payoutsEnabled,false);
  assert.equal(first.transactionId,null);
  assert.equal(first.isDemo,true);
  assert.equal(svc.getDemoBalance('user-1'),1000000);
});

test('destination registration validates chain and rejects idempotency conflicts',()=>{
  const svc=createDemoWithdrawalService();
  const first=register(svc,'chain-user','TRON',tron);
  const retry=register(svc,'chain-user','TRON',tron);
  assert.deepEqual(retry,first);
  assert.equal(first.ownershipVerified,false);
  assert.throws(
    ()=>svc.registerDestination({
      userId:'chain-user',
      idempotencyKey:'destination-key-chain-user',
      network:'SOLANA',
      address:sol,
      verificationToken:'demo-token-chain-user'
    }),
    /IDEMPOTENCY_CONFLICT/
  );
  assert.throws(
    ()=>svc.registerDestination({
      userId:'chain-user',
      idempotencyKey:'invalid-chain-key',
      network:'TRON',
      address:sol,
      verificationToken:'demo-token-chain-user'
    }),
    /INVALID_DESTINATION/
  );
});

test('withdrawal consumes settled availability, not pending balance',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('pending-user',{pendingMinor:900000,settledMinor:100000});
  const destination=register(svc,'pending-user');
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'pending-user',
      idempotencyKey:'pending-withdrawal-key',
      destinationId:destination.id,
      amountMinor:100001
    }),
    /INSUFFICIENT_SETTLED_DEMO_BALANCE/
  );
  assert.deepEqual(
    svc.getWalletState('pending-user'),
    {
      pendingMinor:900000,
      settledMinor:100000,
      reservedMinor:0,
      availableMinor:100000,
      asset:'USDT',
      isDemo:true,
      payoutsEnabled:false,
      trafficEnabled:false,
      signingEnabled:false,
      broadcastEnabled:false
    }
  );
});

test('withdrawal idempotency rejects a changed payload without double reservation',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('conflict-user',1000000);
  const destination=register(svc,'conflict-user');
  const base={
    userId:'conflict-user',
    idempotencyKey:'same-withdrawal-key',
    destinationId:destination.id,
    amountMinor:400000
  };
  svc.requestWithdrawal(base);
  assert.throws(
    ()=>svc.requestWithdrawal({...base,amountMinor:500000}),
    /IDEMPOTENCY_CONFLICT/
  );
  assert.equal(svc.getWalletState('conflict-user').reservedMinor,400000);
});

test('cancellation releases a reservation exactly once',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('cancel-user',1000000);
  const destination=register(svc,'cancel-user');
  const withdrawal=svc.requestWithdrawal({
    userId:'cancel-user',
    idempotencyKey:'cancel-withdrawal-key',
    destinationId:destination.id,
    amountMinor:600000
  });
  const input={
    userId:'cancel-user',
    withdrawalId:withdrawal.id,
    idempotencyKey:'cancel-key'
  };
  const first=svc.cancelWithdrawal(input);
  const retry=svc.cancelWithdrawal(input);
  assert.deepEqual(retry,first);
  assert.equal(first.status,'DEMO_CANCELLED');
  assert.equal(svc.getWalletState('cancel-user').reservedMinor,0);
  assert.equal(svc.getWalletState('cancel-user').availableMinor,1000000);
});

test('revoked destination blocks new withdrawal requests',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('revoke-user',1000000);
  const destination=register(svc,'revoke-user');
  svc.revokeDestination({
    userId:'revoke-user',
    destinationId:destination.id,
    idempotencyKey:'revoke-key'
  });
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'revoke-user',
      idempotencyKey:'after-revoke-key',
      destinationId:destination.id,
      amountMinor:1
    }),
    /DESTINATION_REVOKED/
  );
});

test('audit events are immutable and never contain the full public address',()=>{
  const svc=createDemoWithdrawalService({now:()=> '2026-10-23T00:00:00.000Z'});
  svc.setDemoBalance('audit-user',1000000);
  const destination=register(svc,'audit-user');
  svc.requestWithdrawal({
    userId:'audit-user',
    idempotencyKey:'audit-withdrawal-key',
    destinationId:destination.id,
    amountMinor:250000
  });
  const events=svc.getAuditEvents('audit-user');
  assert.equal(events.length,3);
  assert.equal(JSON.stringify(events).includes(sol),false);
  assert.ok(events.some(event=>event.metadata.maskedAddress==='FqxVPD…qAkwcU'));
  assert.throws(()=>{events[0].action='tampered';},TypeError);
  assert.throws(()=>{events[1].metadata.maskedAddress='tampered';},TypeError);
});

test('reject insufficient demo balance and missing authentication context',()=>{
  const svc=createDemoWithdrawalService();
  svc.setDemoBalance('user-2',100);
  const destination=register(svc,'user-2');
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'user-2',
      idempotencyKey:'key-2',
      destinationId:destination.id,
      amountMinor:101
    }),
    /INSUFFICIENT/
  );
  assert.throws(
    ()=>svc.registerDestination({
      userId:'',
      idempotencyKey:'destination-key',
      network:'SOLANA',
      address:sol,
      verificationToken:'demo-token'
    }),
    /INVALID_USER_ID/
  );
});
