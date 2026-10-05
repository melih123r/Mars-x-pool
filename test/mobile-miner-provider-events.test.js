import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeShare,normalizeSettlement,providerHealth} from '../mobile-miner/provider-events.mjs';
test('share requires provider verification',()=>{
 assert.equal(normalizeShare({workerId:'phone_1',shareId:'share-001',acceptedAtMs:1}).accepted,false);
 assert.equal(normalizeShare({providerVerified:true,workerId:'phone_1',shareId:'share-001',acceptedAtMs:1}).accepted,true);
});
test('settlement requires confirmed positive VRSC amount',()=>{
 assert.equal(normalizeSettlement({providerConfirmed:false}).confirmed,false);
 const s=normalizeSettlement({providerConfirmed:true,settlementId:'settle-01',amountVrsc:.1,confirmedAtMs:1});
 assert.equal(s.confirmed,true); assert.equal(s.settledVrsc,.1);
});
test('provider connection must be fresh and read only',()=>{
 const now=100000;
 assert.equal(providerHealth({readOnly:false,checkedAtMs:now},now).healthy,false);
 assert.equal(providerHealth({readOnly:true,checkedAtMs:now-60001},now).healthy,false);
 assert.equal(providerHealth({readOnly:true,checkedAtMs:now},now).healthy,true);
});
