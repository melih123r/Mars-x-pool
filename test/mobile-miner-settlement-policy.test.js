import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedVrscSettlement, mxCreditBalance, displayDisclosure } from '../mobile-miner/settlement-policy.mjs';

const good=(p={})=>({providerConfirmed:true,providerSettlementId:'settle-0001',
  settledVrsc:0.25,confirmedAtMs:1000,...p});

test('rejects estimates, shares and unconfirmed settlement',()=>{
  assert.equal(verifiedVrscSettlement({estimatedVrsc:10}).verified,false);
  assert.equal(verifiedVrscSettlement(good({providerConfirmed:false})).verified,false);
  assert.equal(verifiedVrscSettlement(good({settledVrsc:0})).verified,false);
});

test('credits only unique provider-confirmed settlements',()=>{
  const a=good();
  const b=good({providerSettlementId:'settle-0002',settledVrsc:0.5});
  const out=mxCreditBalance([a,a,b,{estimatedVrsc:99}]);
  assert.equal(out.mxCredit,0.75);
  assert.equal(out.backingVrsc,0.75);
  assert.equal(out.verifiedSettlementCount,2);
});

test('disclosure distinguishes credit from token',()=>{
  assert.match(displayDisclosure(),/MARSX token değildir/);
});
