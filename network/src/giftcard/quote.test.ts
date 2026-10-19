import { describe, expect, it } from 'vitest';
import { feeMinor, quoteGiftCard } from './quote';

const product = {
  id: 'sandbox-fr',
  countries: [{abbr:'FR'}],
  currency_codes:['EUR'],
  skus:[{min:1,max:100}],
};
describe('MARS-X gift-card quotes', () => {
  it.each([
    [100,5],[300,5],[500,10],[1000,10],[2000,20],[5000,25],[10000,30],
  ])('charges %i minor units => fee %i', (amount, expected) => {
    expect(feeMinor(amount)).toBe(expected);
  });
  it('itemizes provider costs and service fee', () => {
    expect(quoteGiftCard({product,country:'FR',currency:'EUR',faceMinor:100,providerFeeMinor:7}))
      .toMatchObject({faceMinor:100,serviceFeeMinor:5,providerFeeMinor:7,totalDebitMinor:112});
  });
  it('rejects unavailable countries and currencies', () => {
    expect(() => quoteGiftCard({product,country:'US',currency:'EUR',faceMinor:100})).toThrow();
    expect(() => quoteGiftCard({product,country:'FR',currency:'USD',faceMinor:100})).toThrow();
  });
  it('rejects unsupported denomination and invalid fees', () => {
    expect(() => quoteGiftCard({product,country:'FR',currency:'EUR',faceMinor:50})).toThrow();
    expect(() => quoteGiftCard({product,country:'FR',currency:'EUR',faceMinor:100,providerFeeMinor:-1})).toThrow();
  });
});
