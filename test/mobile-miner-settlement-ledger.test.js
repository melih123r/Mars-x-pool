import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSettlementLedger} from '../mobile-miner/settlement-ledger.mjs';
const event={provider:'fixture',settlementId:'settle-001',accountId:'user-001',wallet:'wallet-fixture',transactionId:'tx-001',amountVrsc:'0.00000003',confirmedAtMs:1000};
// Test fixture verifier only; deliberately not a real provider integration.
const options={verifyEvidence:(e,proof)=>proof==='fixture-proof'?{verified:true,evidenceHash:'a'.repeat(64)}:{verified:false}};
test('durable exact records survive restart and scoped replays',()=>{
 const dir=mkdtempSync(join(tmpdir(),'marsx-ledger-'));const path=join(dir,'ledger.sqlite');let ledger;
 try{
 ledger=openSettlementLedger(path,options);ledger.record(event,'fixture-proof');ledger.close();
 ledger=openSettlementLedger(path,options);
 assert.equal(ledger.record(event,'fixture-proof').duplicate,true);
 ledger.record({...event,provider:'another-fixture'},'fixture-proof');
 assert.deepEqual(ledger.review('user-001'),{recordedVrsc:'0.00000006',settlementCount:2,spendableVrsc:'0.00000000',creditEnabled:false,withdrawalEnabled:false});
 assert.equal(ledger.review('other-user').recordedVrsc,'0.00000000');
 }finally{ledger?.close();rmSync(dir,{recursive:true,force:true});}
});
test('conflicting replay rolls back without changing original record',()=>{
 const ledger=openSettlementLedger(':memory:',options);
 try{ledger.record(event,'fixture-proof');
 for(const patch of [{amountVrsc:'99'},{accountId:'other'},{wallet:'other'},{transactionId:'other'},{confirmedAtMs:1001}])
 assert.throws(()=>ledger.record({...event,...patch},'fixture-proof'),/conflicting/);
 assert.equal(ledger.review('user-001').recordedVrsc,'0.00000003');
 }finally{ledger.close();}
});
test('flags, missing evidence, floating point and future timestamps cannot enter ledger',()=>{
 assert.throws(()=>openSettlementLedger(':memory:'),/verifier/);
 const ledger=openSettlementLedger(':memory:',options);
 try{
 assert.throws(()=>ledger.record({...event,providerConfirmed:true},null),/not-verified/);
 for(const patch of [{amountVrsc:0.1},{amountVrsc:'0'},{confirmedAtMs:Date.now()+60000}])assert.throws(()=>ledger.record({...event,...patch},'fixture-proof'));
 assert.equal(ledger.review('user-001').settlementCount,0);
 }finally{ledger.close();}
});
