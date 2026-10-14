export function reconcileChangeNow({remote,local}={}){
 if(!remote?.id||!local?.reference)return result(false,["missing_reference"]);
 if(String(remote.id)!==String(local.reference))return result(false,["reference_mismatch"]);
 const issues=[];const rs=String(remote.status||"unknown").toLowerCase(),ls=String(local.status||"unknown").toLowerCase();
 if(rs!==ls)issues.push("status_mismatch");
 compareAmount(remote.fromAmount??remote.amount,local.debit,"debit_mismatch",issues);
 compareAmount(remote.toAmount??remote.amountSend,local.credit,"credit_mismatch",issues);
 const ra=String(remote.fromCurrency||remote.from_currency||"").toLowerCase(),la=String(local.assetIn||"").toLowerCase();if(ra&&la&&ra!==la)issues.push("asset_in_mismatch");
 const rb=String(remote.toCurrency||remote.to_currency||"").toLowerCase(),lb=String(local.assetOut||"").toLowerCase();if(rb&&lb&&rb!==lb)issues.push("asset_out_mismatch");
 return result(issues.length===0,issues);
}
export class ChangeNowStatusCache{
 constructor({ttlMs=5000}={}){if(!Number.isFinite(ttlMs)||ttlMs<=0)throw new Error("ttlMs must be positive");this.ttlMs=ttlMs;this.map=new Map();}
 get(id,{now=Date.now()}={}){const x=this.map.get(String(id));if(!x||now-x.at>this.ttlMs){this.map.delete(String(id));return null}return x.value}
 set(id,value,{now=Date.now()}={}){if(!id)throw new Error("id required");this.map.set(String(id),{at:now,value});return value}
}
export async function withChangeNowRetry(fn,{attempts=3,baseDelayMs=50,sleep=(ms)=>new Promise(r=>setTimeout(r,ms))}={}){
 if(typeof fn!=="function")throw new Error("fn required");let last;
 for(let i=0;i<attempts;i++){try{return await fn(i)}catch(e){last=e;if(i+1>=attempts||!retryable(e))throw e;await sleep(baseDelayMs*(2**i));}}
 throw last;
}
function retryable(e){const s=Number(e?.status||String(e?.message||"").match(/HTTP\s+(\d+)/)?.[1]);return s===429||s>=500||e?.name==="AbortError"}
function compareAmount(a,b,label,out){if(a===undefined||a===null||b===undefined||b===null)return;const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x-y)>1e-10)out.push(label)}
function result(ok,issues){return Object.freeze({ok,issues:Object.freeze(issues),autoCorrected:false})}
