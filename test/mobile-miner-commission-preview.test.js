import test from 'node:test';
import assert from 'node:assert/strict';
import {commissionPreview,vrscAtoms} from '../mobile-miner/commission-preview.mjs';
test('direct-wallet payouts cannot create platform fee income',()=>{
 const p=commissionPreview({grossVrsc:'10'});
 assert.equal(p.userNetVrsc,'10.00000000');
 assert.equal(p.platformFeePreviewVrsc,'0.00000000');
 assert.equal(p.collectiblePlatformFeeVrsc,'0.00000000');
 assert.equal(p.executionEnabled,false);assert.equal(p.balanceCreditEnabled,false);
});
test('managed preview conserves amount with sequential fees and user external costs',()=>{
 const p=commissionPreview({grossVrsc:'10',externalCostVrsc:'0.01',payoutMode:'managed-preview'});
 assert.equal(p.poolFeeVrsc,'1.00000000');assert.equal(p.withdrawalFeeVrsc,'0.18000000');
 assert.equal(p.userNetVrsc,'8.81000000');
 assert.equal(vrscAtoms(p.grossVrsc),vrscAtoms(p.poolFeeVrsc)+vrscAtoms(p.withdrawalFeeVrsc)+vrscAtoms(p.externalCostVrsc)+vrscAtoms(p.userNetVrsc));
 assert.equal(p.collectiblePlatformFeeVrsc,'0.00000000');
});
test('atom amounts and large totals retain exact precision',()=>{
 assert.equal(commissionPreview({grossVrsc:'0.00000001',payoutMode:'managed-preview'}).userNetVrsc,'0.00000001');
 assert.equal(commissionPreview({grossVrsc:'9007199254740993'}).userNetVrsc,'9007199254740993.00000000');
});
test('rejects malformed decimals, unsupported modes and unaffordable costs',()=>{
 for(const x of [1,'-1','1e3','0.000000001','01','NaN']) assert.throws(()=>vrscAtoms(x));
 assert.throws(()=>commissionPreview({grossVrsc:'0'}));
 assert.throws(()=>commissionPreview({grossVrsc:'1',payoutMode:'unknown'}));
 assert.throws(()=>commissionPreview({grossVrsc:'1',externalCostVrsc:'2'}));
});
