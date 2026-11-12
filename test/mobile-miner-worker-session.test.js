import test from 'node:test';
import assert from 'node:assert/strict';
import { pairWorker,workerTransition } from '../mobile-miner/worker-session.mjs';
const safe={allowed:true,threads:1,reason:'eligible-for-device-test'};
test('pairing requires explicit confirmation and six digit code',()=>{
 assert.equal(pairWorker({poolId:'pool_12345',workerId:'worker_12345',pairingCode:'123456',userConfirmed:false}).paired,false);
 assert.equal(pairWorker({poolId:'pool_12345',workerId:'worker_12345',pairingCode:'123456',userConfirmed:true}).paired,true);
 assert.equal(pairWorker({poolId:'pool_12345',workerId:'worker_12345',pairingCode:'12x456',userConfirmed:true}).paired,false);
});
test('START requires pairing consent and one-thread safety approval',()=>{
 let s={status:'STOPPED',paired:true,consent:false};
 assert.equal(workerTransition(s,'START',safe).status,'STOPPED');
 s=workerTransition(s,'CONSENT');
 assert.equal(workerTransition(s,'START',safe).status,'RUNNING');
 assert.equal(workerTransition({...s,paired:false},'START',safe).status,'STOPPED');
 assert.equal(workerTransition(s,'START',{allowed:true,threads:2}).status,'STOPPED');
});
test('STOP and consent revocation synchronously fail closed',()=>{
 const running={status:'RUNNING',paired:true,consent:true,threads:1};
 assert.equal(workerTransition(running,'STOP',safe).status,'STOPPED');
 const revoked=workerTransition(running,'REVOKE_CONSENT',safe);
 assert.equal(revoked.status,'STOPPED'); assert.equal(revoked.consent,false);
});
test('safety veto stops a running session',()=>{
 const running={status:'RUNNING',paired:true,consent:true,threads:1};
 const out=workerTransition(running,'SAFETY_UPDATE',{allowed:false,threads:0,reason:'battery-temperature'});
 assert.equal(out.status,'STOPPED'); assert.equal(out.stopReason,'battery-temperature');
});
