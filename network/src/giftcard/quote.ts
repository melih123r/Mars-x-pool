/** Product-specific reward redemption quotes; no orders or balance mutations. */
export type Sku = { min: number; max: number };
export type RewardProduct = { id: string; countries: Array<{abbr: string}>; currency_codes: string[]; skus: Sku[] };
export type Quote = { productId: string; country: string; currency: string; faceMinor: number; serviceFeeMinor: number; providerFeeMinor: number; totalDebitMinor: number };
/** The platform's separate 20% share applies to settled network revenue, not gift-card face value. */
export const NETWORK_PLATFORM_SHARE = 0.20;
export function feeMinor(faceMinor: number, productFeeMinor?: number): number {
  if (!Number.isSafeInteger(faceMinor) || faceMinor < 1) throw new Error("invalid amount");
  // Proposed face-value-based default, overridable by an explicitly configured product fee.
  const defaultFee = faceMinor < 500 ? 5 : faceMinor < 2000 ? 15 : faceMinor < 5000 ? 30 : faceMinor < 10000 ? 50 : 75;
  if (productFeeMinor === undefined) return defaultFee;
  if (!Number.isSafeInteger(productFeeMinor) || productFeeMinor < 0) throw new Error("invalid product fee");
  return productFeeMinor;
}
export function quoteGiftCard(input: { product: RewardProduct; country: string; currency: string; faceMinor: number; providerFeeMinor?: number; productFeeMinor?: number }): Quote {
  const {product, country, currency, faceMinor} = input;
  const providerFeeMinor = input.providerFeeMinor ?? 0;
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) throw new Error("invalid locale");
  if (!product.countries.some(c => c.abbr === country) || !product.currency_codes.includes(currency)) throw new Error("product unavailable in country/currency");
  if (!Number.isSafeInteger(faceMinor) || faceMinor < 1 || !Number.isSafeInteger(providerFeeMinor) || providerFeeMinor < 0) throw new Error("invalid amount");
  const denomination = faceMinor / 100;
  if (!product.skus.some(s => denomination >= s.min && denomination <= s.max)) throw new Error("invalid product denomination");
  const serviceFeeMinor = feeMinor(faceMinor,input.productFeeMinor);
  const totalDebitMinor = faceMinor + serviceFeeMinor + providerFeeMinor;
  if (!Number.isSafeInteger(totalDebitMinor)) throw new Error("overflow");
  return {productId:product.id,country,currency,faceMinor,serviceFeeMinor,providerFeeMinor,totalDebitMinor};
}
