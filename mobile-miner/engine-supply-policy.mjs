import crypto from 'node:crypto';
export const ENGINE_SOURCE=Object.freeze({
 repository:'monkins1010/ccminer', branch:'ARM',
 commit:'1667394ad4120d64b0c57367e71cb832ad2e3645', license:'GPL-3.0'
});
export function verifyEngineArtifact({source,sha256,bytes}){
 if(!source||source.repository!==ENGINE_SOURCE.repository||source.branch!==ENGINE_SOURCE.branch||
   source.commit!==ENGINE_SOURCE.commit||source.license!==ENGINE_SOURCE.license)
   return {verified:false,reason:'unpinned-source'};
 if(!(bytes instanceof Uint8Array)||bytes.length===0)return {verified:false,reason:'artifact-required'};
 if(!/^[0-9a-f]{64}$/i.test(sha256||''))return {verified:false,reason:'sha256-required'};
 const actual=crypto.createHash('sha256').update(bytes).digest('hex');
 if(actual.toLowerCase()!==sha256.toLowerCase())return {verified:false,reason:'sha256-mismatch'};
 return {verified:true,reason:'pinned-source-and-artifact-verified',sha256:actual};
}
export function releaseGate({artifactVerified,tlsVerified,stratumVerified,acceptedShareVerified,foregroundServiceVerified,deviceTestVerified}){
 const checks={artifactVerified,tlsVerified,stratumVerified,acceptedShareVerified,foregroundServiceVerified,deviceTestVerified};
 const missing=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
 return {ready:missing.length===0,missing};
}
