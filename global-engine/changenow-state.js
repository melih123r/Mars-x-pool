const FINAL=new Set(["finished","failed","refunded","expired"]);
const KNOWN=new Set(["new","waiting","confirming","exchanging","sending","finished","failed","refunded","expired"]);
export function normalizeChangeNowStatus(input={}){
 const status=String(input.status||input.state||"unknown").toLowerCase();
 const normalized=KNOWN.has(status)?status:"unknown";
 return Object.freeze({id:String(input.id||""),status:normalized,terminal:FINAL.has(normalized),fromCurrency:String(input.fromCurrency||input.from_currency||"").toLowerCase(),toCurrency:String(input.toCurrency||input.to_currency||"").toLowerCase(),fromAmount:finite(input.fromAmount??input.amount),toAmount:finite(input.toAmount??input.amountSend),updatedAt:dateValue(input.updatedAt||input.updated_at||input.createdAt)});
}
function finite(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function dateValue(v){if(!v)return null;const n=Date.parse(v);return Number.isFinite(n)?new Date(n).toISOString():null}
export function changeNowTimeline(items=[]){
 const seen=new Set();return items.map(normalizeChangeNowStatus).filter(x=>x.id&&x.status!=="unknown").filter(x=>{const k=x.id+":"+x.status+":"+x.updatedAt;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>String(a.updatedAt||"").localeCompare(String(b.updatedAt||"")));
}
export function changeNowLedgerPreview(tx={}){
 const x=normalizeChangeNowStatus(tx);if(!x.id)throw new Error("transaction id required");
 return Object.freeze({reference:x.id,status:x.status,settled:x.status==="finished",debit:x.fromAmount,credit:x.toAmount,assetIn:x.fromCurrency,assetOut:x.toCurrency});
}
