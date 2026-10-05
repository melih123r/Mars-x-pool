import test from 'node:test'; import assert from 'node:assert/strict'; import {sha256,verifyEngine,canStartNativeEngine} from '../mobile-miner/engine-verification.mjs';
const bytes=new TextEncoder().encode('test-engine');
const good=()=>verifyEngine({bytes,expectedSha256:sha256(bytes),abi:'arm64-v8a',license:'GPL-3.0',sourceCommit:'1667394ad4120d64b0c57367e71cb832ad2e3645',tlsCapable:true});
test('engine provenance and TLS are mandatory',()=>{
 assert.equal(good().verified,true);
 assert.equal(verifyEngine({bytes,expectedSha256:sha256(bytes),abi:'arm64-v8a',license:'GPL-3.0',sourceCommit:'1667394ad4120d64b0c57367e71cb832ad2e3645',tlsCapable:false}).verified,false);
 assert.equal(verifyEngine({bytes,expectedSha256:'0'.repeat(64),abi:'arm64-v8a',license:'GPL-3.0',sourceCommit:'1667394ad4120d64b0c57367e71cb832ad2e3645',tlsCapable:true}).verified,false);
});
test('start requires verified engine explicit consent foreground and one thread',()=>{
 const base={engine:good(),userStarted:true,consent:true,foregroundService:true,safety:{allowed:true,threads:1}};
 assert.equal(canStartNativeEngine(base).allowed,true);
 assert.equal(canStartNativeEngine({...base,userStarted:false}).allowed,false);
 assert.equal(canStartNativeEngine({...base,foregroundService:false}).allowed,false);
 assert.equal(canStartNativeEngine({...base,safety:{allowed:true,threads:2}}).allowed,false);
});
