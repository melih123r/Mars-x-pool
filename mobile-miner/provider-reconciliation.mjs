import { normalizeShare, normalizeSettlement } from './provider-events.mjs';

export function reconcileProviderEvents(events, previous={shareIds:[],settlementIds:[],settledVrsc:0}) {
 const shareIds=new Set(previous.shareIds||[]);
 const settlementIds=new Set(previous.settlementIds||[]);
 let settledVrsc=Number.isFinite(previous.settledVrsc)?previous.settledVrsc:0;
 let newShares=0,newSettlements=0,rejected=0;
 for (const e of events||[]) {
   if (e?.type==='share') {
     const s=normalizeShare(e);
     if (!s.accepted) { rejected++; continue; }
     if (!shareIds.has(s.shareId)) { shareIds.add(s.shareId); newShares++; }
     continue;
   }
   if (e?.type==='settlement') {
     const s=normalizeSettlement(e);
     if (!s.confirmed) { rejected++; continue; }
     if (!settlementIds.has(s.providerSettlementId)) {
       settlementIds.add(s.providerSettlementId); settledVrsc+=s.settledVrsc; newSettlements++;
     }
     continue;
   }
   rejected++;
 }
 return {shareIds:[...shareIds],settlementIds:[...settlementIds],settledVrsc,newShares,newSettlements,rejected};
}

export function creditableVrsc(state) {
 return state && Number.isFinite(state.settledVrsc) && state.settledVrsc>0 ? state.settledVrsc : 0;
}
