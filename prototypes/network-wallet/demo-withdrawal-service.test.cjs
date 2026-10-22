'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDemoWithdrawalService}=require('./demo-withdrawal-service.cjs');

const tron='TT3RpGfvUScgAG3GYULcimxFXEUnPPNfGZ';
const sol='FqxVPDjwwMyT4y2tRsQia2pXpwCcgGnH3J4HMhqAkwcU';

function registerSolana(svc,userId='user-1',key='destination-key') {
  return svc.registerDestination({
    userId,
    idempotencyKey:key,
    network:'SOLANA',
    address:sol,
    verificationToken:'demo-verification-token'
  });
}

test('destination registration is chain-valid, idempotent and receive-only',()=>{
  const svc=createDemoWithdrawalService();
  const input={
    userId:'user-1',
    idempotencyKey:'destination-key',
    network:'SOLANA',
    address:sol,
    verificationToken:'demo-verification-token'
  };
  const first=svc.registerDestination(input);
  const retry=svc.registerDestination(input);
  assert.equal(retry,first);
  assert.equal(first.publicAddress,sol);
  assert.equal(first.ownershipVerified,false);
  assert.equal(first.payoutsEnabled,false);
  assert.equal(first.signingEnabled,false);
  assert.equal(first.broadcastEnabled,false);
  assert.throws(
    ()=>svc.registerDestination({...input,address:tron}),
    /INVALID_DESTINATION/
  );
});

test('destination idempotency key rejects a changed payload',()=>{
  const svc=createDemoWithdrawalService();
  registerSolana(svc);
  assert.throws(
    ()=>svc.registerDestination({
      userId:'user-1',
      idempotencyKey:'destination-key',
      network:'TRON',
      address:tron,
      verificationToken:'demo-verification-token'
    }),
    /IDEMPOTENCY_CONFLICT/
  );
});

test('withdrawal reserves settled balance once and never consumes pending balance',()=>{
  const svc=createDemoWithdrawalService();
  const destination=registerSolana(svc);
  svc.setDemoBalance('user-1',{pendingMinor:9000000,settledMinor:2000000});
  const input={
    userId:'user-1',
    idempotencyKey:'withdrawal-key',
    destinationId:destination.id,
    asset:'USDT',
    amountMinor:1000000
  };
  const first=svc.requestWithdrawal(input);
  const retry=svc.requestWithdrawal(input);
  assert.equal(retry,first);
  assert.equal(first.status,'DEMO_RESERVED');
  assert.equal(first.transactionId,null);
  assert.equal(first.broadcast,false);
  assert.deepEqual(
    {
      pendingMinor:svc.getWalletState('user-1').pendingMinor,
      settledMinor:svc.getWalletState('user-1').settledMinor,
      reservedMinor:svc.getWalletState('user-1').reservedMinor,
      availableMinor:svc.getWalletState('user-1').availableMinor
    },
    {pendingMinor:9000000,settledMinor:2000000,reservedMinor:1000000,availableMinor:1000000}
  );
  assert.equal(
    svc.getAuditEvents('user-1').filter(event=>event.action==='withdrawal_reserved').length,
    1
  );
});

test('withdrawal idempotency key rejects changed amount',()=>{
  const svc=createDemoWithdrawalService();
  const destination=registerSolana(svc);
  svc.setDemoBalance('user-1',2000000);
  svc.requestWithdrawal({
    userId:'user-1',
    idempotencyKey:'withdrawal-key',
    destinationId:destination.id,
    amountMinor:1000000
  });
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'user-1',
      idempotencyKey:'withdrawal-key',
      destinationId:destination.id,
      amountMinor:500000
    }),
    /IDEMPOTENCY_CONFLICT/
  );
  assert.equal(svc.getWalletState('user-1').reservedMinor,1000000);
});

test('pending-only earnings cannot fund a withdrawal',()=>{
  const svc=createDemoWithdrawalService();
  const destination=registerSolana(svc);
  svc.setDemoBalance('user-1',{pendingMinor:5000000,settledMinor:0});
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'user-1',
      idempotencyKey:'pending-only-key',
      destinationId:destination.id,
      amountMinor:1
    }),
    /INSUFFICIENT_SETTLED_DEMO_BALANCE/
  );
  assert.equal(svc.getWalletState('user-1').reservedMinor,0);
});

test('cancellation releases reservation exactly once',()=>{
  const svc=createDemoWithdrawalService();
  const destination=registerSolana(svc);
  svc.setDemoBalance('user-1',1000000);
  const withdrawal=svc.requestWithdrawal({
    userId:'user-1',
    idempotencyKey:'withdrawal-key',
    destinationId:destination.id,
    amountMinor:400000
  });
  const input={
    userId:'user-1',
    withdrawalId:withdrawal.id,
    idempotencyKey:'cancel-key'
  };
  const first=svc.cancelWithdrawal(input);
  const retry=svc.cancelWithdrawal(input);
  assert.equal(retry,first);
  assert.equal(first.status,'DEMO_CANCELLED');
  assert.equal(svc.getWalletState('user-1').reservedMinor,0);
  assert.equal(svc.getWalletState('user-1').availableMinor,1000000);
  assert.equal(
    svc.getAuditEvents('user-1').filter(
      event=>event.action==='withdrawal_reservation_released'
    ).length,
    1
  );
});

test('revoked destination blocks new requests',()=>{
  const svc=createDemoWithdrawalService();
  const destination=registerSolana(svc);
  svc.setDemoBalance('user-1',1000000);
  svc.revokeDestination({
    userId:'user-1',
    destinationId:destination.id,
    idempotencyKey:'revoke-key'
  });
  assert.throws(
    ()=>svc.requestWithdrawal({
      userId:'user-1',
      idempotencyKey:'withdrawal-key',
      destinationId:destination.id,
      amountMinor:1
    }),
    /DESTINATION_REVOKED/
  );
});

test('audit events are append-only, frozen and contain no full address',()=>{
  const svc=createDemoWithdrawalService();
  registerSolana(svc);
  const events=svc.getAuditEvents('user-1');
  const destinationEvent=events.find(event=>event.action==='destination_registered');
  assert.ok(destinationEvent);
  assert.equal(Object.isFrozen(destinationEvent),true);
  assert.equal(Object.isFrozen(destinationEvent.metadata),true);
  assert.equal(JSON.stringify(events).includes(sol),false);
  assert.equal(JSON.stringify(events).includes('seed'),false);
  assert.equal(JSON.stringify(events).includes('private'),false);
});
