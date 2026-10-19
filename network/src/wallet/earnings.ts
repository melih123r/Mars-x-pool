/** Network-first wallet accounting: no private keys, no crypto custody, no live payouts. */
export type Earnings = { settledMinor: number; pendingMinor: number; currency: 'USD' | 'EUR' };
export type Allocation = { platformMinor: number; usersMinor: number };
export function allocateSettledRevenue(totalMinor: number): Allocation {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('invalid settled revenue');
  const platformMinor = Math.floor(totalMinor / 5);
  return {platformMinor, usersMinor: totalMinor - platformMinor};
}
export type WalletDestination = { chain: 'solana' | 'base' | 'polygon'; address: string; asset: 'USDC' };
export function validateDestination(wallet: WalletDestination): WalletDestination {
  if (wallet.asset !== 'USDC') throw new Error('unsupported asset');
  if (wallet.chain === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet.address)) throw new Error('invalid Solana address format');
  } else if (wallet.chain === 'base' || wallet.chain === 'polygon') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address)) throw new Error('invalid EVM address format');
  } else throw new Error('unsupported network');
  return {...wallet};
}
export type PayoutQuote = { network: WalletDestination['chain']; grossMinor: number; providerFeeMinor: number; networkFeeMinor: number; platformFeeMinor: number; fxFeeMinor: number; netMinor: number };
export function rankQuotes(quotes: PayoutQuote[]): PayoutQuote[] {
  return quotes.filter(q => {
    const nums=[q.grossMinor,q.providerFeeMinor,q.networkFeeMinor,q.platformFeeMinor,q.fxFeeMinor,q.netMinor];
    return nums.every(n=>Number.isSafeInteger(n)&&n>=0) && q.grossMinor-q.providerFeeMinor-q.networkFeeMinor-q.platformFeeMinor-q.fxFeeMinor===q.netMinor && q.netMinor>0;
  }).sort((a,b)=>b.netMinor-a.netMinor);
}
