import { createHash } from 'node:crypto';
export function sha256(bytes){ return createHash('sha256').update(bytes).digest('hex'); }
export function verifyEngine({bytes,expectedSha256,abi,license,sourceCommit,tlsCapable}){
 if(!(bytes instanceof Uint8Array)||bytes.length===0)return{verified:false,reason:'engine-missing'};
 if(!/^[0-9a-f]{64}$/i.test(expectedSha256||''))return{verified:false,reason:'hash-missing'};
 if(sha256(bytes)!==expectedSha256.toLowerCase())return{verified:false,reason:'hash-mismatch'};
 if(abi!=='arm64-v8a')return{verified:false,reason:'unsupported-abi'};
 if(license!=='GPL-3.0')return{verified:false,reason:'license-unverified'};
 if(!/^[0-9a-f]{40}$/i.test(sourceCommit||''))return{verified:false,reason:'source-commit-unverified'};
 if(tlsCapable!==true)return{verified:false,reason:'tls-unverified'};
 return{verified:true,reason:'engine-verified',sha256:expectedSha256.toLowerCase(),abi,sourceCommit};
}
export function canStartNativeEngine({engine,safety,userStarted,consent,foregroundService}){
 if(engine?.verified!==true)return{allowed:false,reason:'engine-unverified'};
 if(userStarted!==true)return{allowed:false,reason:'explicit-start-required'};
 if(consent!==true)return{allowed:false,reason:'consent-required'};
 if(foregroundService!==true)return{allowed:false,reason:'foreground-service-required'};
 if(safety?.allowed!==true||safety?.threads!==1)return{allowed:false,reason:'safety-veto'};
 return{allowed:true,reason:'native-start-eligible'};
}
