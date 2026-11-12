// Quote-only routing policy. Conversion and withdrawal are distinct irreversible actions.
export const TARGETS = Object.freeze([
  { asset:'VRSC',network:'VERUS' }, { asset:'LTC',network:'LITECOIN' },
  { asset:'DOGE',network:'DOGECOIN' }, { asset:'TRX',network:'TRON' },
  { asset:'XLM',network:'STELLAR' }, { asset:'BNB',network:'BSC' }
]);
const fresh=q=>q?.providerConfirmed===true&&q.executable===true&&Number.isFinite(q.expiresAtMs)&&q.expiresAtMs>Date.now();

export function rankWithdrawalQuotes(quotes,amountVrsc,marsxFeeBps=200){
 if(!Number.isFinite(amountVrsc)||amountVrsc<=0)return[];
 const budget=amountVrsc*marsxFeeBps/10000;
 return (quotes||[]).filter(q=>fresh(q)&&q.asset&&q.network&&Number.isFinite(q.netValueVrsc)&&q.netValueVrsc>0&&
  Number.isFinite(q.totalExternalCostVrsc)&&q.totalExternalCostVrsc>=0&&q.totalExternalCostVrsc<=budget&&
  Number.isFinite(q.liquidityScore)&&q.liquidityScore>=.8).sort((a,b)=>b.netValueVrsc-a.netValueVrsc);
}
export function canExecuteConversion({userConfirmed,settledBalanceVrsc,amountVrsc,quote}){
 if(userConfirmed!==true)return{allowed:false,reason:'conversion-confirmation-required'};
 if(!Number.isFinite(amountVrsc)||amountVrsc<=0||!Number.isFinite(settledBalanceVrsc)||settledBalanceVrsc<amountVrsc)
  return{allowed:false,reason:'insufficient-settled-balance'};
 if(!fresh(quote))return{allowed:false,reason:'provider-confirmation-required'};
 return{allowed:true,reason:'eligible-for-conversion'};
}
export function validateDestination(asset,network,address,memo){
 if(typeof address!=='string')return{valid:false,reason:'address-required'};
 if(asset==='TRX'&&network==='TRON')return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)?{valid:true}:{valid:false,reason:'invalid-tron-address'};
 if(asset==='XLM'&&network==='STELLAR')return /^G[A-Z2-7]{55}$/.test(address)?
   {valid:true,memoRequired:typeof memo==='string'&&memo.length>0?false:null}:{valid:false,reason:'invalid-stellar-address'};
 if(asset==='BNB'&&network==='BSC')return /^0x[0-9a-fA-F]{40}$/.test(address)?{valid:true}:{valid:false,reason:'invalid-bsc-address'};
 if(asset==='LTC'&&network==='LITECOIN')return /^(ltc1[ac-hj-np-z02-9]{39,87}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address)?{valid:true}:{valid:false,reason:'invalid-litecoin-address'};
 if(asset==='VRSC'&&network==='VERUS')return /^R[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(address)?{valid:true}:{valid:false,reason:'invalid-verus-address'};
 return{valid:false,reason:'unsupported-network'};
}
export function canExecuteWithdrawal({userConfirmed,targetBalance,amount,quote,asset,network,address,memo}){
 if(userConfirmed!==true)return{allowed:false,reason:'withdrawal-confirmation-required'};
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(targetBalance)||targetBalance<amount)
  return{allowed:false,reason:'insufficient-target-balance'};
 const d=validateDestination(asset,network,address,memo); if(!d.valid)return{allowed:false,reason:d.reason};
 if(!fresh(quote))return{allowed:false,reason:'provider-confirmation-required'};
 return{allowed:true,reason:'eligible-for-withdrawal'};
}
