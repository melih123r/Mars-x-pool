import test from 'node:test'; import assert from 'node:assert/strict';
import {verifyStratumProbe,probeIsFresh} from '../mobile-miner/stratum-verification.mjs';
const good={tls:true,certificateValid:true,protocol:'stratum',authorized:true,acceptedShare:true,poolHost:'pool.example',observedAtMs:Date.now()};
test('accepted share over verified TLS Stratum is required',()=>{
 assert.equal(verifyStratumProbe(good).verified,true);
 for(const k of ['tls','certificateValid','authorized','acceptedShare'])assert.equal(verifyStratumProbe({...good,[k]:false}).verified,false);
});
test('probe evidence must be fresh',()=>{assert.equal(probeIsFresh(good),true);assert.equal(probeIsFresh({...good,observedAtMs:Date.now()-120000}),false);});
