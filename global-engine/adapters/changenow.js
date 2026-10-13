const trimSlash=s=>String(s||"").replace(/\/+$/,"");
const enc=v=>encodeURIComponent(String(v));
const required=(v,n)=>{if(v===undefined||v===null||v==="")throw new Error(n+" required");return v;};
const DEFAULT_MAX_RESPONSE_BYTES=2*1024*1024;
const HARD_MAX_RESPONSE_BYTES=8*1024*1024;
const responseTooLarge=()=>{const e=new Error("ChangeNOW response exceeds safe size limit");e.code="RESPONSE_TOO_LARGE";e.status=502;return e;};
async function boundedText(response,maxBytes){
 const declared=Number(response.headers?.get?.("content-length"));
 if(Number.isFinite(declared)&&declared>maxBytes)throw responseTooLarge();
 if(!response.body?.getReader){
  const text=await response.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw responseTooLarge();
  return text;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,text="";
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>maxBytes){await reader.cancel();throw responseTooLarge();}
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock();}
}
export class ChangeNowAdapter{
 constructor({apiKey=process.env.CHANGENOW_API_KEY,baseUrl=process.env.CHANGENOW_API_BASE_URL||"https://api.changenow.io/v2",allowTransactions=false,timeoutMs=8000,maxResponseBytes=process.env.CHANGENOW_MAX_RESPONSE_BYTES||DEFAULT_MAX_RESPONSE_BYTES}={}){
  this.apiKey=apiKey;this.baseUrl=trimSlash(baseUrl);this.allowTransactions=allowTransactions===true;this.timeoutMs=Number(timeoutMs);this.maxResponseBytes=Number(maxResponseBytes);this.mode="quote-only";
  if(!Number.isFinite(this.timeoutMs)||this.timeoutMs<1)throw new Error("timeoutMs must be positive");
  if(!Number.isInteger(this.maxResponseBytes)||this.maxResponseBytes<1||this.maxResponseBytes>HARD_MAX_RESPONSE_BYTES)throw new Error("maxResponseBytes must be an integer between 1 and 8388608");
 }
 configured(){return Boolean(this.apiKey);}
 async request(path,{method="GET",body,auth=true}={}){
  if(auth&&!this.apiKey)throw new Error("ChangeNOW API credential is not configured");
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),this.timeoutMs);
  try{
   const headers={Accept:"application/json",...(body!==undefined?{"Content-Type":"application/json"}:{}),...(auth?{"x-changenow-api-key":this.apiKey}:{})};
   const r=await fetch(this.baseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:c.signal,redirect:"error"});
   const text=await boundedText(r,this.maxResponseBytes);let data={};
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
 async createTransaction(intent){
  if(!this.allowTransactions)throw Object.assign(new Error("ChangeNOW transaction creation disabled"),{status:403});
  if(!intent || intent.confirmed!==true)throw Object.assign(new Error("explicit_user_confirmation_required"),{status:400});
  const ticker=v=>typeof v==="string"&&/^[a-z0-9]{2,20}$/.test(v);
  const address=v=>typeof v==="string"&&v.length>=12&&v.length<=256&&/^[a-zA-Z0-9:_-]+$/.test(v);
  const {fromCurrency,toCurrency,fromNetwork,toNetwork,fromAmount,refundAddress,extraId,refundExtraId}=intent;
  if(!ticker(fromCurrency)||!ticker(toCurrency)||!ticker(fromNetwork)||!ticker(toNetwork)||!address(intent.address))
    throw Object.assign(new Error("invalid_exchange_destination_or_pair"),{status:400});
  if(refundAddress!==undefined&&refundAddress!==""&&!address(refundAddress))
    throw Object.assign(new Error("invalid_refund_address"),{status:400});
  if([extraId,refundExtraId].some(v=>v!==undefined&&(typeof v!=="string"||v.length>128)))
    throw Object.assign(new Error("invalid_extra_id"),{status:400});
  if(typeof fromAmount!=="string"||!/^\\d+(?:\\.\\d{1,18})?$/.test(fromAmount)||!(Number(fromAmount)>0)||!Number.isFinite(Number(fromAmount)))
    throw Object.assign(new Error("invalid_exchange_amount"),{status:400});
  if(intent.flow!==undefined&&intent.flow!=="standard")
    throw Object.assign(new Error("unsupported_exchange_flow"),{status:400});
  const body={fromCurrency,toCurrency,fromNetwork,toNetwork,fromAmount,toAmount:"",address:intent.address,
    extraId:extraId||"",refundAddress:refundAddress||"",refundExtraId:refundExtraId||"",
    userId:"",payload:"",contactEmail:"",source:"",flow:"standard",type:"direct",rateId:""};
  return this.request("/exchange",{method:"POST",body,auth:true});
 }
 capabilities(){return Object.freeze({quotes:true,currencies:true,minAmount:true,status:true,createTransaction:false,withdrawals:false,payouts:false,custody:false});}
}
