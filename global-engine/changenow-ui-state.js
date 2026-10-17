export function changeNowUiState({health={},quote=null,minAmount=null,error=null,now=Date.now()}={}){
 const executionReady=health.executionReady===true;
 const configured=health.configured===true;
 const validUntil=quote?.validUntil||quote?.validUntilTimestamp||null;
 const expiryMs=validUntil?Date.parse(validUntil):NaN;
 const expired=Number.isFinite(expiryMs)&&expiryMs<=now;
 const estimatedAmount=quote?.toAmount??quote?.estimatedAmount??null;
 let state="READY";
 if(!configured) state="CONNECTION_PENDING";
 else if(error) state="UNAVAILABLE";
 else if(expired) state="EXPIRED";
 else if(!quote) state="AWAITING_QUOTE";
 return Object.freeze({
  provider:"ChangeNOW",mode:"READ_ONLY",state,configured,executionReady:false,
  quoteAvailable:Boolean(quote)&&!expired&&!error,
  canExecute:false,
  primaryAction:executionReady?"EXECUTION_REVIEW_REQUIRED":(configured?"PREVIEW_QUOTE":"PROVIDER_CONNECTION_PENDING"),
  estimatedAmount,
  minAmount:minAmount?.minAmount??minAmount?.amount??minAmount??null,
  rate:quote?.rate??quote?.rateId??null,
  networkFee:quote?.networkFee??null,
  validUntil,expired,
  error:error?{code:error.code||"PROVIDER_UNAVAILABLE",message:"Quote is temporarily unavailable"}:null
 });
}
