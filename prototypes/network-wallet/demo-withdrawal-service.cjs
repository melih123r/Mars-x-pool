'use strict';
// DEMO ONLY. In-memory sample for SDK-free Play build; no money transfer or signing.
const {validateDemoWithdrawal}=require('./wallet-validation');
function createDemoWithdrawalService() {
  const requests=new Map();
  const balances=new Map();
  const setDemoBalance=(userId,amountMinor)=>{
    if(!Number.isSafeInteger(amountMinor)||amountMinor<0) throw new Error('INVALID_BALANCE');
    balances.set(userId,amountMinor);
  };
  const requestWithdrawal=({userId,idempotencyKey,network,address,asset='USDT',amountMinor})=>{
    if(typeof userId!=='string'||!userId||typeof idempotencyKey!=='string'||!idempotencyKey) throw new Error('UNAUTHORIZED_OR_MISSING_KEY');
    const key=userId+':'+idempotencyKey;
    if(requests.has(key)) return requests.get(key);
    validateDemoWithdrawal({network,address,asset,amountMinor});
    const available=balances.get(userId)||0;
    if(amountMinor>available) throw new Error('INSUFFICIENT_DEMO_BALANCE');
    const record=Object.freeze({id:'demo-'+(requests.size+1),userId,network,address,asset,amountMinor,status:'DEMO_REQUESTED',isDemo:true,broadcast:false});
    balances.set(userId,available-amountMinor);
    requests.set(key,record);
    return record;
  };
  return {setDemoBalance,requestWithdrawal,getDemoBalance:userId=>balances.get(userId)||0};
}
module.exports={createDemoWithdrawalService};
