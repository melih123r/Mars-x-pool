import test from 'node:test';
import assert from 'node:assert/strict';
import { rankWithdrawalQuotes, canExecuteWithdrawal } from '../mobile-miner/withdrawal-routing.mjs';
const future=Date.now()+60000;
const q=(p={})=>({asset:'TRX',network:'TRON',providerConfirmed:true,executable:true,
  netValueVrsc:9.79,totalExternalCostVrsc:0.1,expiresAtMs:future,liquidityScore:0.95,...p});
test('ranks only confirmed economical liquid quotes',()=>{
  const out=rankWithdrawalQuotes([q(),q({asset:'XLM',network:'STELLAR',netValueVrsc:9.8}),
    q({providerConfirmed:false}),q({totalExternalCostVrsc:0.21}),q({liquidityScore:0.2})],10);
  assert.deepEqual(out.map(x=>x.asset),['XLM','TRX']);
});
test('requires explicit user confirmation and settled balance',()=>{
  assert.equal(canExecuteWithdrawal({userConfirmed:false,settledBalanceVrsc:10,amountVrsc:10,quote:q()}).allowed,false);
  assert.equal(canExecuteWithdrawal({userConfirmed:true,settledBalanceVrsc:9,amountVrsc:10,quote:q()}).allowed,false);
  assert.equal(canExecuteWithdrawal({userConfirmed:true,settledBalanceVrsc:10,amountVrsc:10,quote:q()}).allowed,true);
});
test('rejects unconfirmed and expired provider quotes',()=>{
  assert.equal(canExecuteWithdrawal({userConfirmed:true,settledBalanceVrsc:10,amountVrsc:10,quote:q({providerConfirmed:false})}).allowed,false);
  assert.equal(canExecuteWithdrawal({userConfirmed:true,settledBalanceVrsc:10,amountVrsc:10,quote:q({expiresAtMs:Date.now()-1})}).allowed,false);
});
