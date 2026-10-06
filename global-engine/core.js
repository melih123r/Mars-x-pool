export const ASSET_CLASSES = Object.freeze(["CRYPTO","EQUITY","FX","FUTURE","OPTION","BOND","COMMODITY","ETF"]);

export function instrument(input) {
  if (!input?.symbol || !input?.assetClass) throw new Error("symbol and assetClass are required");
  const assetClass = String(input.assetClass).toUpperCase();
  if (!ASSET_CLASSES.includes(assetClass)) throw new Error("unsupported assetClass");
  return Object.freeze({ symbol:String(input.symbol).toUpperCase(), assetClass, quoteCurrency:String(input.quoteCurrency || "USD").toUpperCase() });
}

export function order(input) {
  const side=String(input?.side || "").toUpperCase();
  if (!["BUY","SELL"].includes(side)) throw new Error("side must be BUY or SELL");
  const amount=Number(input?.amount);
  if (!Number.isFinite(amount) || !(amount>0)) throw new Error("amount must be a finite positive number");
  return Object.freeze({ id:input.id || crypto.randomUUID(), instrument:instrument(input.instrument), side, amount, type:String(input.type || "MARKET").toUpperCase(), createdAt:new Date().toISOString() });
}

export function quote(input) {
  const price=Number(input?.price), fee=Number(input?.fee || 0);
  if (!Number.isFinite(price) || !Number.isFinite(fee) || !(price>0) || fee<0) throw new Error("invalid quote");
  return Object.freeze({ venue:String(input.venue), price, fee, timestamp:input.timestamp || new Date().toISOString(), metadata:input.metadata || {} });
}
