'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDemoWalletApi}=require('./demo-wallet-api.cjs');

const sol='FqxVPDjwwMyT4y2tRsQia2pXpwCcgGnH3J4HMhqAkwcU';

test('destination and withdrawal API responses stay masked and demo-only',async()=>{
  const api=createDemoWalletApi();
  api.service.setDemoBalance('api-user',{pendingMinor:500000,settledMinor:2000000});

  const destination=await api.handle({
    method:'POST',
    path:'/network/wallet-destinations',
    userId:'api-user',
    body:{
      idempotencyKey:'api-destination-key',
      network:'SOLANA',
      address:sol,
      verificationToken:'demo-verification-token'
    }
  });
  assert.equal(destination.status,201);
  assert.equal(destination.body.maskedAddress,'FqxVPD…qAkwcU');
  assert.equal('publicAddress' in destination.body,false);
  assert.equal(destination.body.ownershipVerified,false);
  assert.equal(destination.body.payoutsEnabled,false);
  assert.equal(destination.body.broadcastEnabled,false);

  const withdrawal=await api.handle({
    method:'POST',
    path:'/network/withdrawals',
    userId:'api-user',
    body:{
      idempotencyKey:'api-withdrawal-key',
      destinationId:destination.body.id,
      asset:'USDT',
      amountMinor:750000
    }
  });
  assert.equal(withdrawal.status,201);
  assert.equal(withdrawal.body.status,'DEMO_RESERVED');
  assert.equal(withdrawal.body.transactionId,null);
  assert.equal(withdrawal.body.signingEnabled,false);
  assert.equal(withdrawal.body.broadcastEnabled,false);

  const wallet=await api.handle({
    method:'GET',
    path:'/network/wallet',
    userId:'api-user'
  });
  assert.deepEqual(
    {
      pendingMinor:wallet.body.pendingMinor,
      settledMinor:wallet.body.settledMinor,
      reservedMinor:wallet.body.reservedMinor,
      availableMinor:wallet.body.availableMinor
    },
    {pendingMinor:500000,settledMinor:2000000,reservedMinor:750000,availableMinor:1250000}
  );
});

test('API maps replay conflicts and revoked destinations without reserving twice',async()=>{
  const api=createDemoWalletApi();
  api.service.setDemoBalance('api-user',1000000);
  const destinationInput={
    method:'POST',
    path:'/network/wallet-destinations',
    userId:'api-user',
    body:{
      idempotencyKey:'api-destination-key',
      network:'SOLANA',
      address:sol,
      verificationToken:'demo-verification-token'
    }
  };
  const destination=await api.handle(destinationInput);
  const request={
    method:'POST',
    path:'/network/withdrawals',
    userId:'api-user',
    body:{
      idempotencyKey:'api-withdrawal-key',
      destinationId:destination.body.id,
      amountMinor:400000
    }
  };
  const first=await api.handle(request);
  const retry=await api.handle(request);
  assert.deepEqual(retry,first);

  const conflict=await api.handle({
    ...request,
    body:{...request.body,amountMinor:500000}
  });
  assert.equal(conflict.status,409);
  assert.equal(conflict.body.error,'IDEMPOTENCY_CONFLICT');
  assert.equal(api.service.getWalletState('api-user').reservedMinor,400000);

  const revoked=await api.handle({
    method:'DELETE',
    path:'/network/wallet-destinations/'+destination.body.id,
    userId:'api-user',
    body:{idempotencyKey:'api-revoke-key'}
  });
  assert.equal(revoked.status,200);
  assert.ok(revoked.body.revokedAt);

  const blocked=await api.handle({
    method:'POST',
    path:'/network/withdrawals',
    userId:'api-user',
    body:{
      idempotencyKey:'api-after-revoke',
      destinationId:destination.body.id,
      amountMinor:1
    }
  });
  assert.equal(blocked.status,409);
  assert.equal(blocked.body.error,'DESTINATION_REVOKED');
});

test('unsupported routes fail closed with every execution flag disabled',async()=>{
  const api=createDemoWalletApi();
  const result=await api.handle({
    method:'POST',
    path:'/network/sign-and-broadcast',
    userId:'api-user',
    body:{seedPhrase:'must never be accepted'}
  });
  assert.equal(result.status,404);
  assert.equal(result.body.payoutsEnabled,false);
  assert.equal(result.body.trafficEnabled,false);
  assert.equal(result.body.signingEnabled,false);
  assert.equal(result.body.broadcastEnabled,false);
  assert.equal(JSON.stringify(result.body).includes('must never be accepted'),false);
});
