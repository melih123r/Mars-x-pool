import {describe,it,expect} from 'vitest';
import {RedemptionLedger} from './ledger';
import type {Quote} from './quote';
const q:Quote={productId:'test',country:'FR',currency:'EUR',faceMinor:100,serviceFeeMinor:5,providerFeeMinor:0,totalDebitMinor:105};
describe('withdrawal prototype',()=>{
  it('reserves settled funds and prevents duplicate debit',()=>{
    const l=new RedemptionLedger(200);
    l.reserve('a',q);l.reserve('a',q);
    expect(l.available()).toBe(95);
    expect(()=>l.reserve('b',q)).toThrow('insufficient');
  });
  it('rejects idempotency conflicts',()=>{
    const l=new RedemptionLedger(300);l.reserve('a',q);
    expect(()=>l.reserve('a',{...q,totalDebitMinor:120})).toThrow('conflict');
  });
  it('returns funds exactly once on confirmed failure',()=>{
    const l=new RedemptionLedger(200);l.reserve('a',q);
    l.transition('a','submitted');l.transition('a','failed');l.transition('a','failed');
    expect(l.available()).toBe(200);
    expect(()=>l.transition('a','settled')).toThrow('invalid');
  });
  it('keeps unsettled payout under manual review',()=>{
    const l=new RedemptionLedger(200);l.reserve('a',q);
    l.transition('a','manual_review');expect(l.available()).toBe(95);
  });
});
