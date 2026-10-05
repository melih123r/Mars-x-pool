// Quote-only routing policy. Never creates balances, orders, conversions or withdrawals.
export const TARGETS = Object.freeze([
  { asset: 'VRSC', network: 'VERUS' },
  { asset: 'LTC', network: 'LITECOIN' },
  { asset: 'DOGE', network: 'DOGECOIN' },
  { asset: 'TRX', network: 'TRON' },
  { asset: 'XLM', network: 'STELLAR' },
  { asset: 'BNB', network: 'BSC' }
]);

export function rankWithdrawalQuotes(quotes, amountVrsc, marsxFeeBps = 200) {
  if (!Number.isFinite(amountVrsc) || amountVrsc <= 0) return [];
  const feeBudgetVrsc = amountVrsc * marsxFeeBps / 10000;
  return (quotes || []).filter(q =>
    q && q.providerConfirmed === true && q.executable === true &&
    q.asset && q.network && Number.isFinite(q.netValueVrsc) && q.netValueVrsc > 0 &&
    Number.isFinite(q.totalExternalCostVrsc) && q.totalExternalCostVrsc >= 0 &&
    q.totalExternalCostVrsc <= feeBudgetVrsc &&
    Number.isFinite(q.expiresAtMs) && q.expiresAtMs > Date.now() &&
    Number.isFinite(q.liquidityScore) && q.liquidityScore >= 0.8
  ).sort((a,b) => b.netValueVrsc - a.netValueVrsc);
}

export function canExecuteWithdrawal({ userConfirmed, settledBalanceVrsc, amountVrsc, quote }) {
  if (userConfirmed !== true) return { allowed:false, reason:'user-confirmation-required' };
  if (!Number.isFinite(settledBalanceVrsc) || !Number.isFinite(amountVrsc) ||
      amountVrsc <= 0 || settledBalanceVrsc < amountVrsc)
    return { allowed:false, reason:'insufficient-settled-balance' };
  if (!quote || quote.providerConfirmed !== true || quote.executable !== true)
    return { allowed:false, reason:'provider-confirmation-required' };
  if (!Number.isFinite(quote.expiresAtMs) || quote.expiresAtMs <= Date.now())
    return { allowed:false, reason:'quote-expired' };
  return { allowed:true, reason:'eligible-for-provider-execution' };
}
