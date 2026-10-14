import test from 'node:test'; import assert from 'node:assert/strict';
import {createReadOnlyProviderAdapter,assertNoTradingOrWithdrawal} from '../mobile-miner/provider-adapter.mjs';
test('adapter exposes read-only health/events and no money movement',async()=>{
 const now=Date.now(); const a=createReadOnlyProviderAdapter({
  fetchHealth:async()=>({readOnly:true,checkedAtMs:now}),
  fetchEvents:async()=>({events:[{type:'share',providerVerified:true,workerId:'worker_12345',shareId:'share-0001',acceptedAtMs:now}],nextCursor:'2'})
 });
 assert.equal(assertNoTradingOrWithdrawal(a),true);
 assert.equal((await a.health()).healthy,true);
 assert.equal((await a.events('1')).events.length,1);
});
test('malformed provider data fails closed',async()=>{
 const a=createReadOnlyProviderAdapter({fetchHealth:async()=>({}),fetchEvents:async()=>({events:[{type:'settlement',providerConfirmed:false}]})});
 assert.equal((await a.events()).events.length,0);
});
