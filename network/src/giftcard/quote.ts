/** MARS-X Network product-specific redemption quote engine. Pure functions; no payment calls. */
export type Sku = { min: number; max: number };
export type RewardProduct = { id: string; countries: Array<{abbr: string}>; currency_codes: string[]; skus: Sku[] };
export type Quote = { productId: string; country: string; currency: string; faceMinor: number; serviceFeeMinor: number; providerFeeMinor: number; totalDebitMinor: number };
export function feeMinor(faceMinor: number): number {
  if (!Number.isSafeInteger(faceMinor) || faceMinor < 1) throw new Error("invalid amount");
  // Minor units assume 2-decimal currency; caller must validate currency exponent.
  if (faceMinor < 500) return Math.min(5, Math.floor(faceMinor * 0.05));
  if (faceMinor < 2000) return Math.min(10, Math.floor(faceMinor * 0.02));
  if (faceMinor < 5000) return Math.min(20, Math.floor(faceMinor * 0.01));
  return Math.min(30, Math.floor(faceMinor * 0.005));
}
export function quoteGiftCard(input: { product: RewardProduct; country: string; currency: string; faceMinor: number; providerFeeMinor?: number }): Quote {
  const {product, country, currency, faceMinor} = input;
  const providerFeeMinor = input.providerFeeMinor ?? 0;
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) throw new Error("invalid locale");
  if (!product.countries.some(c => c.abbr === country) || !product.currency_codes.includes(currency)) throw new Error("product unavailable in country/currency");
  if (!Number.isSafeInteger(faceMinor) || faceMinor < 1 || !Number.isSafeInteger(providerFeeMinor) || providerFeeMinor < 0) throw new Error("invalid amount");
  const denomination = faceMinor / 100;
  if (!product.skus.some(s => denomination >= s.min && denomination <= s.max)) throw new Error("invalid product denomination");
  const serviceFeeMinor = feeMinor(faceMinor);
  const totalDebitMinor = faceMinor + serviceFeeMinor + providerFeeMinor;
  if (!Number.isSafeInteger(totalDebitMinor)) throw new Error("overflow");
  return {productId:product.id,country,currency,faceMinor,serviceFeeMinor,providerFeeMinor,totalDebitMinor};
}
