import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';

const ID=/^[A-Za-z0-9_-]{8,64}$/;
const CODE=/^[0-9]{6}$/;
const sha256=v=>createHash('sha256').update(String(v)).digest('hex');
const equalHex=(a,b)=>{
 if(!/^[a-f0-9]{64}$/.test(a||'')||!/^[a-f0-9]{64}$/.test(b||''))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
};

export function createPairingControl({now=Date.now,codeTtlMs=5*60_000,tokenTtlMs=24*60*60_000}={}){
 const codes=new Map(),sessions=new Map(),commands=new Map();
 const clean=()=>{
  const t=now();
  for(const [k,v] of codes)if(v.expiresAt<=t||v.used)codes.delete(k);
  for(const [k,v] of sessions)if(v.expiresAt<=t||v.revoked)sessions.delete(k);
 };
 return Object.freeze({
  issue({poolId,workerId}){
   clean();
   if(!ID.test(poolId||'')||!ID.test(workerId||''))throw new TypeError('invalid-identity');
   let code; do{code=String(randomInt(0,1_000_000)).padStart(6,'0');}while(codes.has(code));
   codes.set(code,{poolId,workerId,expiresAt:now()+codeTtlMs,used:false});
   return {code,expiresAt:now()+codeTtlMs};
  },
  redeem({code,poolId,workerId,userConfirmed}){
   clean();
   if(userConfirmed!==true)return {paired:false,reason:'local-confirmation-required'};
   if(!CODE.test(code||'')||!ID.test(poolId||'')||!ID.test(workerId||''))return {paired:false,reason:'invalid-pairing-request'};
   const record=codes.get(code);
   if(!record||record.used||record.expiresAt<=now())return {paired:false,reason:'pairing-code-expired-or-used'};
   if(record.poolId!==poolId||record.workerId!==workerId)return {paired:false,reason:'pairing-identity-mismatch'};
   record.used=true; codes.delete(code);
   const token=randomBytes(32).toString('base64url'),sessionId=randomBytes(16).toString('hex');
   sessions.set(sessionId,{poolId,workerId,tokenHash:sha256(token),expiresAt:now()+tokenTtlMs,revoked:false,lastNonce:-1});
   return {paired:true,sessionId,token,expiresAt:now()+tokenTtlMs};
  },
  authenticate({sessionId,token,workerId,nonce}){
   clean(); const s=sessions.get(sessionId);
   if(!s||s.workerId!==workerId||!Number.isSafeInteger(nonce)||nonce<=s.lastNonce||!equalHex(s.tokenHash,sha256(token||'')))
    return {ok:false,reason:'session-invalid-or-replayed'};
   s.lastNonce=nonce; return {ok:true,poolId:s.poolId,workerId:s.workerId};
  },
  requestStop({workerId,reason='remote-stop'}){
   if(!ID.test(workerId||''))throw new TypeError('invalid-worker');
   const command={type:'STOP',reason:String(reason).slice(0,80),issuedAt:now()};
   commands.set(workerId,command); return command;
  },
  command({workerId}){return commands.get(workerId)||null;},
  acknowledgeStop({workerId}){const c=commands.get(workerId);if(c?.type==='STOP')commands.delete(workerId);return Boolean(c);},
  revoke({sessionId}){const s=sessions.get(sessionId);if(s)s.revoked=true;return Boolean(s);}
 });
}
