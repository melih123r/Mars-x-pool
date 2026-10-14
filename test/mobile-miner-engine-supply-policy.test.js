import test from 'node:test'; import assert from 'node:assert/strict'; import crypto from 'node:crypto';
import {ENGINE_SOURCE,verifyEngineArtifact,releaseGate} from '../mobile-miner/engine-supply-policy.mjs';
test('only pinned source plus matching artifact hash verifies',()=>{
 const bytes=new TextEncoder().encode('test-artifact'); const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(verifyEngineArtifact({source:ENGINE_SOURCE,sha256,bytes}).verified,true);
 assert.equal(verifyEngineArtifact({source:{...ENGINE_SOURCE,commit:'bad'},sha256,bytes}).verified,false);
 assert.equal(verifyEngineArtifact({source:ENGINE_SOURCE,sha256:'0'.repeat(64),bytes}).verified,false);
});
test('release stays closed until every real-world gate is verified',()=>{
 assert.equal(releaseGate({artifactVerified:true,tlsVerified:true,stratumVerified:true,acceptedShareVerified:true,foregroundServiceVerified:true,deviceTestVerified:false}).ready,false);
 assert.equal(releaseGate({artifactVerified:true,tlsVerified:true,stratumVerified:true,acceptedShareVerified:true,foregroundServiceVerified:true,deviceTestVerified:true}).ready,true);
});
