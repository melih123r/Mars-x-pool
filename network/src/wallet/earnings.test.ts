import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {allocateSettledRevenue,rankQuotes,validateDestination} from './earnings.ts';
describe('Network wallet core',()=>{
 it('allocates settled revenue without losing rounding cents',()=>{
  for(const n of [0,1,2,3,4,5,99,100,101,100001]) {
   const a=allocateSettledRevenue(n);
   assert.equal(a.platformMinor+a.usersMinor,n);
   assert.equal(a.platformMinor,Math.floor(n/5));
  }
 });
 it('rejects negative and fractional revenue',()=>{
  assert.throws(()=>allocateSettledRevenue(-1));
  assert.throws(()=>allocateSettledRevenue(1.5));
 });
 it('validates supported network address shapes',()=>{
  assert.equal(validateDestination({chain:'base',address:'0x'+'a'.repeat(40),asset:'USDC'}).chain,'base');
  assert.throws(()=>validateDestination({chain:'base',address:'bad',asset:'USDC'}));
  assert.throws(()=>validateDestination({chain:'solana',address:'0x'+'a'.repeat(40),asset:'USDC'}));
 });
 it('ranks net payout, rejects inconsistent quotes',()=>{
  const q=(network:'base'|'polygon',netMinor:number)=>({network,grossMinor:100,providerFeeMinor:0,networkFeeMinor:100-netMinor,platformFeeMinor:0,fxFeeMinor:0,netMinor});
  assert.deepEqual(rankQuotes([q('base',97),q('polygon',99)]).map(x=>x.network),['polygon','base']);
  assert.deepEqual(rankQuotes([{...q('base',97),netMinor:100}]),[]);
 });
});
