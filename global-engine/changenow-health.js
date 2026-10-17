export function changeNowHealth({configured=false,currencies=null,quote=null,lastStatus=null,now=Date.now(),maxQuoteAgeMs=30000}={}){
 const checks={configured:Boolean(configured),currencies:Array.isArray(currencies)&&currencies.length>0,quote:false,status:Boolean(lastStatus)};
 const ts=parseTime(quote?.timestamp??quote?.createdAt??quote?.updatedAt),out=finite(quote?.toAmount??quote?.estimatedAmount);
 checks.quote=ts!==null&&out!==null&&out>0&&Math.max(0,now-ts)<=maxQuoteAgeMs;
 const ready=checks.configured&&checks.currencies&&checks.quote;
 return Object.freeze({provider:"ChangeNOW",readyReadOnly:ready,readyExecution:false,checks:Object.freeze(checks),executionBlockers:Object.freeze(["explicit_execution_approval","validated_live_route","transaction_specific_confirmation"])});
}
export function changeNowErrorView(error){
 const status=Number(error?.status||String(error?.message||"").match(/HTTP\s+(\d+)/)?.[1]);
 let kind="unknown",retryable=false;
 if(status===429){kind="rate_limited";retryable=true}else if(status>=500){kind="provider_unavailable";retryable=true}else if(status===401||status===403){kind="authentication"}else if(status>=400){kind="request_rejected"}else if(error?.name==="AbortError"){kind="timeout";retryable=true}
 return Object.freeze({kind,retryable,status:Number.isFinite(status)?status:null,message:"ChangeNOW request could not be completed"});
}
function parseTime(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return Number.isFinite(v)?v:null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function finite(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null}
