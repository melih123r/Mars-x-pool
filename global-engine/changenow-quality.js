export class ChangeNowQuoteGuard{
 constructor({maxAgeMs=30000}={}){if(!Number.isFinite(maxAgeMs)||maxAgeMs<=0)throw new Error("maxAgeMs must be positive");this.maxAgeMs=maxAgeMs;}
 assess(quote,{now=Date.now()}={}){
  if(!quote||typeof quote!=="object")return fail("missing_quote");
  const out=finite(quote.toAmount??quote.estimatedAmount);const input=finite(quote.fromAmount);
  if(input===null||input<=0)return fail("invalid_input_amount");if(out===null||out<=0)return fail("invalid_output_amount");
  const ts=time(quote.timestamp??quote.createdAt??quote.updatedAt);if(ts===null)return fail("missing_timestamp");
  const age=Math.max(0,now-ts);if(age>this.maxAgeMs)return Object.freeze({ok:false,reason:"stale_quote",ageMs:age});
  return Object.freeze({ok:true,reason:null,ageMs:age,fromAmount:input,toAmount:out,rate:out/input});
 }
}
export function buildCurrencyNetworkIndex(rows=[]){
 const map=new Map();for(const r of rows){const asset=String(r.ticker||r.currency||"").toLowerCase(),network=String(r.network||"").toLowerCase();if(!asset||!network||r.isAvailable===false||r.active===false)continue;const key=asset+":"+network;if(!map.has(key))map.set(key,Object.freeze({asset,network,name:String(r.name||asset),available:true}));}return Object.freeze([...map.values()].sort((a,b)=>(a.asset+":"+a.network).localeCompare(b.asset+":"+b.network)));
}
function finite(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null}
function time(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return Number.isFinite(v)?v:null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function fail(reason){return Object.freeze({ok:false,reason,ageMs:null})}
