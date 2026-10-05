import test from 'node:test'; import assert from 'node:assert/strict';
import {rankWithdrawalQuotes,canExecuteConversion,canExecuteWithdrawal,validateDestination} from '../mobile-miner/withdrawal-routing.mjs';
const future=Date.now()+60000;
const q=(p={})=>({asset:'TRX',network:'TRON',providerConfirmed:true,executable:true,netValueVrsc:9.79,totalExternalCostVrsc:.1,expiresAtMs:future,liquidityScore:.95,...p});
test('ranks only confirmed economical liquid quotes',()=>{
 const out=rankWithdrawalQuotes([q(),q({asset:'XLM',network:'STELLAR',netValueVrsc:9.8}),q({providerConfirmed:false}),q({totalExternalCostVrsc:.21}),q({liquidityScore:.2})],10);
 assert.deepEqual(out.map(x=>x.asset),['XLM','TRX']);
});
test('conversion uses settled VRSC and explicit confirmation',()=>{
 assert.equal(canExecuteConversion({userConfirmed:false,settledBalanceVrsc:10,amountVrsc:1,quote:q()}).allowed,false);
 assert.deepEqual(canExecuteConversion({userConfirmed:true,settledBalanceVrsc:10,amountVrsc:1,quote:q()}),{allowed:false,eligible:true,reason:'execution-disabled'});
});
test('withdrawal uses target balance and destination, never settled VRSC directly',()=>{
 const args={userConfirmed:true,targetBalance:100,amount:10,quote:q(),asset:'TRX',network:'TRON',address:'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'};
 assert.deepEqual(canExecuteWithdrawal(args),{allowed:false,eligible:true,reason:'execution-disabled'});
 assert.equal(canExecuteWithdrawal({...args,quote:q({network:'BSC'})}).reason,'quote-destination-mismatch');
 assert.equal(canExecuteWithdrawal({...args,userConfirmed:false}).allowed,false);
 assert.equal(canExecuteWithdrawal({...args,targetBalance:1}).allowed,false);
});
test('network validators fail closed',()=>{
 assert.equal(validateDestination('BNB','BSC','0x0000000000000000000000000000000000000001').valid,true);
 assert.equal(validateDestination('TRX','BSC','TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE').valid,false);
 assert.equal(validateDestination('XLM','STELLAR','bad').valid,false);
});
test('expired/unconfirmed quote cannot execute',()=>{
 const a={userConfirmed:true,settledBalanceVrsc:10,amountVrsc:1};
 assert.equal(canExecuteConversion({...a,quote:q({providerConfirmed:false})}).allowed,false);
 assert.equal(canExecuteConversion({...a,quote:q({expiresAtMs:Date.now()-1})}).allowed,false);
});
