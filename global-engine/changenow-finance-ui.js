const STATUS_LABEL=Object.freeze({new:"Created",waiting:"Awaiting deposit",confirming:"Confirming",exchanging:"Exchanging",sending:"Sending",finished:"Completed",failed:"Failed",refunded:"Refunded",expired:"Expired",unknown:"Unavailable"});
export function buildChangeNowSwapView({quote=null,transaction=null,fromAsset="",toAsset="",networkIn="",networkOut=""}={}){
 const status=String(transaction?.status||"unknown").toLowerCase(),safeStatus=Object.hasOwn(STATUS_LABEL,status)?status:"unknown";
 const amountIn=num(quote?.fromAmount??transaction?.fromAmount),amountOut=num(quote?.toAmount??quote?.estimatedAmount??transaction?.toAmount);
 const rate=num(quote?.rate??(amountIn&&amountOut?amountOut/amountIn:null)),minAmount=num(quote?.minAmount),maxAmount=num(quote?.maxAmount),fee=num(quote?.fee??quote?.networkFee);
 const validUntil=validDate(quote?.validUntil??quote?.valid_until),expired=validUntil!==null&&validUntil<=Date.now();
 return Object.freeze({provider:"ChangeNOW",from:{asset:String(fromAsset||transaction?.fromCurrency||"").toUpperCase(),network:String(networkIn||quote?.fromNetwork||"").toUpperCase(),amount:amountIn},to:{asset:String(toAsset||transaction?.toCurrency||"").toUpperCase(),network:String(networkOut||quote?.toNetwork||"").toUpperCase(),amount:amountOut},rate,minAmount,maxAmount,fee,validUntil,quoteExpired:expired,status:safeStatus,statusLabel:STATUS_LABEL[safeStatus],progress:progress(safeStatus),canExecute:false,quoteAvailable:amountOut!==null&&!expired});
}
function num(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function validDate(v){if(!v)return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function progress(s){return ({new:.05,waiting:.15,confirming:.35,exchanging:.6,sending:.8,finished:1,failed:1,refunded:1,expired:1,unknown:0})[s]}
export function changeNowChartMarker(tx={}){
 const p=num(tx.toAmount??tx.amountSend),t=tx.updatedAt||tx.updated_at;if(p===null||!t||!Number.isFinite(Date.parse(t)))return null;
 const status=String(tx.status||"unknown").toLowerCase();return Object.freeze({time:Date.parse(t),price:p,label:"ChangeNOW "+(STATUS_LABEL[status]||STATUS_LABEL.unknown),status});
}
