const trimSlash=s=>String(s||"").replace(/\/+$/,"");
const enc=v=>encodeURIComponent(String(v));
const required=(v,n)=>{if(v===undefined||v===null||v==="")throw new Error(n+" required");return v;};
export class ChangeNowAdapter{
 constructor({apiKey=process.env.CHANGENOW_API_KEY,baseUrl=process.env.CHANGENOW_API_BASE_URL||"https://api.changenow.io/v2",allowTransactions=false,timeoutMs=8000}={}){
  this.apiKey=apiKey;this.baseUrl=trimSlash(baseUrl);this.allowTransactions=allowTransactions===true;this.timeoutMs=Number(timeoutMs);this.mode="quote-only";
  if(!Number.isFinite(this.timeoutMs)||this.timeoutMs<1)throw new Error("timeoutMs must be positive");
 }
 configured(){return Boolean(this.apiKey);}
 async request(path,{method="GET",body,auth=true}={}){
  if(auth&&!this.apiKey)throw new Error("ChangeNOW API credential is not configured");
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),this.timeoutMs);
  try{
   const headers={Accept:"application/json",...(body!==undefined?{"Content-Type":"application/json"}:{}),...(auth?{"x-changenow-api-key":this.apiKey}:{})};
   const r=await fetch(this.baseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:c.signal,redirect:"error"});
   const text=await r.text();let data={};
   if(text){try{data=JSON.parse(text)}catch{if(r.ok)throw new Error("ChangeNOW invalid JSON response");}}
   if(!r.ok){const e=new Error("ChangeNOW HTTP "+r.status);e.status=r.status;throw e;}
   return data;
  }finally{clearTimeout(timer)}
 }
 currencies({active=true,flow="standard"}={}){return this.request("/exchange/currencies?active="+active+"&flow="+enc(flow),{auth:false});}
 minAmount({fromCurrency,toCurrency,fromNetwork,toNetwork,flow="standard"}){
  required(fromCurrency,"fromCurrency");required(toCurrency,"toCurrency");
  const q=new URLSearchParams({fromCurrency,toCurrency,flow});if(fromNetwork)q.set("fromNetwork",fromNetwork);if(toNetwork)q.set("toNetwork",toNetwork);
  return this.request("/exchange/min-amount?"+q,{auth:false});
 }
 estimate({fromCurrency,toCurrency,fromAmount,fromNetwork,toNetwork,flow="standard"}){
  required(fromCurrency,"fromCurrency");required(toCurrency,"toCurrency");required(fromAmount,"fromAmount");
  const amount=Number(fromAmount);if(!Number.isFinite(amount)||amount<=0)throw new Error("fromAmount must be positive");
  const q=new URLSearchParams({fromCurrency,toCurrency,fromAmount:String(fromAmount),flow});if(fromNetwork)q.set("fromNetwork",fromNetwork);if(toNetwork)q.set("toNetwork",toNetwork);
  return this.request("/exchange/estimated-amount?"+q,{auth:true});
 }
 status(transactionId){required(transactionId,"transactionId");return this.request("/exchange/by-id?id="+enc(transactionId),{auth:true});}
 createTransaction(){if(!this.allowTransactions)throw new Error("ChangeNOW transaction creation disabled");throw new Error("ChangeNOW transaction creation requires explicit approved execution path");}
 capabilities(){return Object.freeze({quotes:true,currencies:true,minAmount:true,status:true,createTransaction:false,withdrawals:false,payouts:false,custody:false});}
}
