const STATUS_LABEL=Object.freeze({new:"Created",waiting:"Awaiting deposit",confirming:"Confirming",exchanging:"Exchanging",sending:"Sending",finished:"Completed",failed:"Failed",refunded:"Refunded",expired:"Expired",unknown:"Unavailable"});
export function buildChangeNowSwapView({quote=null,transaction=null,fromAsset="",toAsset="",networkIn="",networkOut=""}={}){
 const status=String(transaction?.status||"unknown").toLowerCase();
 const safeStatus=Object.hasOwn(STATUS_LABEL,status)?status:"unknown";
 const amountIn=num(quote?.fromAmount??transaction?.fromAmount),amountOut=num(quote?.toAmount??quote?.estimatedAmount??transaction?.toAmount);
 return Object.freeze({provider:"ChangeNOW",from:{asset:String(fromAsset||transaction?.fromCurrency||"").toUpperCase(),network:String(networkIn||"").toUpperCase(),amount:amountIn},to:{asset:String(toAsset||transaction?.toCurrency||"").toUpperCase(),network:String(networkOut||"").toUpperCase(),amount:amountOut},status:safeStatus,statusLabel:STATUS_LABEL[safeStatus],progress:progress(safeStatus),canExecute:false,quoteAvailable:amountOut!==null});
}
function num(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function progress(s){return ({new:.05,waiting:.15,confirming:.35,exchanging:.6,sending:.8,finished:1,failed:1,refunded:1,expired:1,unknown:0})[s]}
export function changeNowChartMarker(tx={}){
 const p=num(tx.toAmount??tx.amountSend),t=tx.updatedAt||tx.updated_at;if(p===null||!t||!Number.isFinite(Date.parse(t)))return null;
 const status=String(tx.status||"unknown").toLowerCase();return Object.freeze({time:Date.parse(t),price:p,label:"ChangeNOW "+(STATUS_LABEL[status]||STATUS_LABEL.unknown),status});
}
