export function compareVenues(quotes=[]){
  return quotes.filter(q=>Number.isFinite(Number(q?.effectiveCost))).map(q=>({
    venue:q.venue,effectiveCost:Number(q.effectiveCost),price:Number(q.price),
    fee:Number(q.fee||0),executable:q?.metadata?.executable===true
  })).sort((a,b)=>a.effectiveCost-b.effectiveCost).map((x,i,a)=>({
    ...x,rank:i+1,best:i===0,savingVsWorst:a.length>1?Number((a[a.length-1].effectiveCost-x.effectiveCost).toFixed(8)):0
  }));
}
