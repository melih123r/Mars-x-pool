import {describe,it,expect} from 'vitest';
import {allocateSettledRevenue,rankQuotes,validateDestination} from './earnings';
describe('Network wallet core',()=>{
 it('allocates settled revenue without losing rounding cents',()=>{
  for(const n of [0,1,2,3,4,5,99,100,101,100001]) {
   const a=allocateSettledRevenue(n);
   expect(a.platformMinor+a.usersMinor).toBe(n);
   expect(a.platformMinor).toBe(Math.floor(n/5));
  }
 });
 it('rejects negative and fractional revenue',()=>{
  expect(()=>allocateSettledRevenue(-1)).toThrow();
  expect(()=>allocateSettledRevenue(1.5)).toThrow();
 });
 it('validates supported network address shapes',()=>{
  expect(validateDestination({chain:'base',address:'0x'+'a'.repeat(40),asset:'USDC'}).chain).toBe('base');
  expect(()=>validateDestination({chain:'base',address:'bad',asset:'USDC'})).toThrow();
  expect(()=>validateDestination({chain:'solana',address:'0x'+'a'.repeat(40),asset:'USDC'})).toThrow();
 });
 it('ranks net payout, rejects inconsistent quotes',()=>{
  const q=(network:'base'|'polygon',netMinor:number)=>({network,grossMinor:100,providerFeeMinor:0,networkFeeMinor:100-netMinor,platformFeeMinor:0,fxFeeMinor:0,netMinor});
  expect(rankQuotes([q('base',97),q('polygon',99)]).map(x=>x.network)).toEqual(['polygon','base']);
  expect(rankQuotes([{...q('base',97),netMinor:100}])).toEqual([]);
 });
});
