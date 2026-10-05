import test from 'node:test'; import assert from 'node:assert/strict';
import {reconcileProviderEvents,creditableVrsc} from '../mobile-miner/provider-reconciliation.mjs';
const share={type:'share',providerVerified:true,workerId:'worker_12345',shareId:'share-0001',acceptedAtMs:1};
const settlement={type:'settlement',providerConfirmed:true,settlementId:'settle-001',amountVrsc:.25,confirmedAtMs:2};
test('duplicate provider events are idempotent',()=>{
 const a=reconcileProviderEvents([share,share,settlement,settlement]);
 assert.equal(a.newShares,1); assert.equal(a.newSettlements,1); assert.equal(a.settledVrsc,.25);
 const b=reconcileProviderEvents([share,settlement],a);
 assert.equal(b.newShares,0); assert.equal(b.newSettlements,0); assert.equal(b.settledVrsc,.25);
});
test('shares never create withdrawable VRSC',()=>{
 const s=reconcileProviderEvents([share]);
 assert.equal(creditableVrsc(s),0);
});
test('unconfirmed settlement is rejected',()=>{
 const s=reconcileProviderEvents([{...settlement,providerConfirmed:false}]);
 assert.equal(s.rejected,1); assert.equal(creditableVrsc(s),0);
});

import {createReadOnlyProviderAdapter} from '../mobile-miner/provider-adapter.mjs';
test('adapter events remain valid across reconciliation and replay',async()=>{
 const adapter=createReadOnlyProviderAdapter({fetchHealth:async()=>({}),fetchEvents:async()=>({events:[share,settlement]})});
 const batch=await adapter.events();
 assert.equal(batch.rejected,0);
 const first=reconcileProviderEvents(batch.events);
 assert.equal(first.newShares,1);assert.equal(first.newSettlements,1);assert.equal(first.settledVrsc,.25);
 const replay=reconcileProviderEvents(batch.events,first);
 assert.equal(replay.newShares,0);assert.equal(replay.newSettlements,0);assert.equal(replay.settledVrsc,.25);
});
test('conflicting raw and normalized settlement fields cannot credit',()=>{
 for(const override of [{providerSettlementId:'other-001'},{settledVrsc:99}]){
 const state=reconcileProviderEvents([{...settlement,...override}]);
 assert.equal(state.rejected,1);assert.equal(state.settledVrsc,0);
 }
});
