// Offline accounting preview only: never credits balances or executes transfers.
const ATOMS = 100000000n;
export function vrscAtoms(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value))
    throw new TypeError('VRSC amount must be a nonnegative decimal string with at most 8 places');
  const [whole, fraction=''] = value.split('.');
  return BigInt(whole)*ATOMS+BigInt(fraction.padEnd(8,'0'));
}
export function formatVrsc(atoms) {
  return `${atoms/ATOMS}.${(atoms%ATOMS).toString().padStart(8,'0')}`;
}
export function commissionPreview({grossVrsc, externalCostVrsc='0', payoutMode='direct-wallet'}) {
  const gross=vrscAtoms(grossVrsc), external=vrscAtoms(externalCostVrsc);
  if(gross<=0n) throw new RangeError('Positive amount required');
  if(!['direct-wallet','managed-preview'].includes(payoutMode)) throw new TypeError('Unknown payout mode');
  // Direct pool payouts bypass MARS-X custody: there is no collectible platform fee.
  const poolFee=payoutMode==='managed-preview'?gross*1000n/10000n:0n;
  const afterPool=gross-poolFee;
  const withdrawalFee=payoutMode==='managed-preview'?afterPool*200n/10000n:0n;
  const net=afterPool-withdrawalFee-external;
  if(net<0n) throw new RangeError('Costs exceed available amount');
  return Object.freeze({previewOnly:true, executionEnabled:false, balanceCreditEnabled:false,
    payoutMode, grossVrsc:formatVrsc(gross), poolFeeVrsc:formatVrsc(poolFee),
    withdrawalFeeVrsc:formatVrsc(withdrawalFee), externalCostVrsc:formatVrsc(external),
    userNetVrsc:formatVrsc(net), platformFeePreviewVrsc:formatVrsc(poolFee+withdrawalFee),
    collectiblePlatformFeeVrsc:'0.00000000', rounding:'fees rounded down to 1 VRSC atom'});
}
