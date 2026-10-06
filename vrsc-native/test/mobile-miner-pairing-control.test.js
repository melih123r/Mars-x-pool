import test from 'node:test';import assert from 'node:assert/strict';
import {createPairingControl} from '../mobile-miner/pairing-control.mjs';
const ids={poolId:'pool_12345678',workerId:'worker_12345'};
test('pairing code is single use and requires explicit local confirmation',()=>{
 let t=1000;const p=createPairingControl({now:()=>t});const {code}=p.issue(ids);
 assert.equal(p.redeem({...ids,code,userConfirmed:false}).paired,false);
 const s=p.redeem({...ids,code,userConfirmed:true});assert.equal(s.paired,true);assert.ok(s.token.length>=32);
 assert.equal(p.redeem({...ids,code,userConfirmed:true}).paired,false);
});
test('pairing code expires and is identity bound',()=>{
 let t=1000;const p=createPairingControl({now:()=>t,codeTtlMs:10});const {code}=p.issue(ids);
 assert.equal(p.redeem({...ids,workerId:'worker_99999',code,userConfirmed:true}).paired,false);
 t=1011;assert.equal(p.redeem({...ids,code,userConfirmed:true}).paired,false);
});
test('session token is hashed server-side and monotonically rejects replay',()=>{
 const p=createPairingControl();const {code}=p.issue(ids);const s=p.redeem({...ids,code,userConfirmed:true});
 assert.equal(p.authenticate({sessionId:s.sessionId,token:s.token,workerId:ids.workerId,nonce:1}).ok,true);
 assert.equal(p.authenticate({sessionId:s.sessionId,token:s.token,workerId:ids.workerId,nonce:1}).ok,false);
 assert.equal(p.authenticate({sessionId:s.sessionId,token:'wrong',workerId:ids.workerId,nonce:2}).ok,false);
 assert.equal(p.authenticate({sessionId:s.sessionId,token:s.token,workerId:ids.workerId,nonce:2}).ok,true);
});
test('remote control exposes STOP only and revoke invalidates session',()=>{
 const p=createPairingControl();const {code}=p.issue(ids);const s=p.redeem({...ids,code,userConfirmed:true});
 assert.deepEqual(p.requestStop({workerId:ids.workerId,reason:'operator'}).type,'STOP');
 assert.equal(p.command({workerId:ids.workerId}).type,'STOP');assert.equal(p.acknowledgeStop({workerId:ids.workerId}),true);
 assert.equal(p.command({workerId:ids.workerId}),null);assert.equal(p.revoke({sessionId:s.sessionId}),true);
 assert.equal(p.authenticate({sessionId:s.sessionId,token:s.token,workerId:ids.workerId,nonce:1}).ok,false);
});
