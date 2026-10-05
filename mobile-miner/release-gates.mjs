export const RELEASE_GATES=Object.freeze([
 'arm64EngineBuilt','engineArtifactHashRecorded','backendCiPassed','androidCiPassed',
 'tlsStratumVerified','acceptedShareObserved','realDeviceSafetyPassed','readOnlyProviderConnected'
]);
export function releaseProgress(state={}){
 const verified=RELEASE_GATES.filter(k=>state[k]===true);
 return {verified,total:RELEASE_GATES.length,percent:Math.round(verified.length/RELEASE_GATES.length*100),
  remaining:RELEASE_GATES.filter(k=>state[k]!==true),ready:verified.length===RELEASE_GATES.length};
}
