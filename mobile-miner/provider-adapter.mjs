import {providerHealth,normalizeShare,normalizeSettlement} from './provider-events.mjs';
export function createReadOnlyProviderAdapter(transport){
 if(!transport||typeof transport.fetchHealth!=='function'||typeof transport.fetchEvents!=='function')throw new Error('read-only-transport-required');
 return Object.freeze({
  async health(){return providerHealth(await transport.fetchHealth(),Date.now());},
  async events(cursor){
   const raw=await transport.fetchEvents(cursor); if(!Array.isArray(raw?.events))return {events:[],nextCursor:cursor,rejected:1};
   const events=[]; let rejected=0;
   for(const e of raw.events){
    if(e?.type==='share'){const n=normalizeShare(e); n.accepted?events.push({...n,type:'share'}):rejected++;}
    else if(e?.type==='settlement'){const n=normalizeSettlement(e); n.confirmed?events.push({...n,type:'settlement'}):rejected++;}
    else rejected++;
   }
   return {events,nextCursor:raw.nextCursor??cursor,rejected};
  }
 });
}
export function assertNoTradingOrWithdrawal(adapter){
 return !['placeOrder','convert','withdraw','send','sign'].some(k=>typeof adapter?.[k]==='function');
}
