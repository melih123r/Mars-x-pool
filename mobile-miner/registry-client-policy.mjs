const PROD='worker-registry-production.up.railway.app';
export function registryRequest({url,method='GET',workerId,pairingToken}) {
 let u; try { u=new URL(url); } catch { return {allowed:false,reason:'invalid-url'}; }
 if (u.protocol!=='https:' || u.hostname!==PROD) return {allowed:false,reason:'registry-endpoint-rejected'};
 if (!['GET','POST'].includes(method)) return {allowed:false,reason:'method-rejected'};
 if (typeof workerId!=='string' || !/^[A-Za-z0-9_-]{8,64}$/.test(workerId))
   return {allowed:false,reason:'worker-invalid'};
 if (method==='POST' && (typeof pairingToken!=='string' || pairingToken.length<16))
   return {allowed:false,reason:'pairing-token-required'};
 return {allowed:true,reason:'registry-request-allowed',origin:u.origin,method,workerId};
}
export function telemetryPayload({workerId,status,batteryC,batteryPercent,thermalStatus,sampleMs}) {
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(workerId||'')) return null;
 if (!['STOPPED','RUNNING'].includes(status)) return null;
 if (![batteryC,batteryPercent,thermalStatus,sampleMs].every(Number.isFinite)) return null;
 return {workerId,status,batteryC,batteryPercent,thermalStatus,sampleMs};
}
