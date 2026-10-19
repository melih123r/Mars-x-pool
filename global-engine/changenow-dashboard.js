export function buildChangeNowSeries(events=[]){
 const pts=[];for(const e of events){const t=parseTime(e.updatedAt??e.updated_at??e.createdAt),out=finite(e.toAmount??e.amountSend??e.estimatedAmount);if(t===null||out===null)continue;pts.push({time:t,value:out,status:String(e.status||"unknown").toLowerCase()});}
 pts.sort((a,b)=>a.time-b.time);return Object.freeze(pts);
}
export function buildChangeNowDashboard({quotes=[],transactions=[]}={}){
 const q=quotes.map(normalizeQuote).filter(Boolean).sort((a,b)=>b.time-a.time);
 const tx=transactions.map(normalizeTx).filter(Boolean);
 const completed=tx.filter(x=>x.status==="finished").length,failed=tx.filter(x=>["failed","expired"].includes(x.status)).length,refunded=tx.filter(x=>x.status==="refunded").length,pending=tx.length-completed-failed-refunded;
 const latest=q[0]||null;return Object.freeze({provider:"ChangeNOW",latestQuote:latest,series:Object.freeze(q.slice().reverse().map(x=>({time:x.time,value:x.toAmount}))),transactions:Object.freeze({total:tx.length,completed,failed,refunded,pending}),executionLocked:true});
}
function normalizeQuote(x){const time=parseTime(x.timestamp??x.createdAt??x.updatedAt),from=finite(x.fromAmount),to=finite(x.toAmount??x.estimatedAmount);return time!==null&&from!==null&&from>0&&to!==null&&to>0?Object.freeze({time,fromAmount:from,toAmount:to,rate:to/from}):null}
function normalizeTx(x){const id=String(x.id||"");if(!id)return null;return {id,status:String(x.status||"unknown").toLowerCase()}}
function parseTime(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return Number.isFinite(v)?v:null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function finite(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
