const TF_MS={"1m":60000,"5m":300000,"15m":900000,"1h":3600000,"4h":14400000,"1D":86400000,"1W":604800000};
export function auditBars(bars=[],{timeframe,now=Date.now(),maxStaleIntervals=3}={}){
 const step=TF_MS[timeframe];if(!step)throw new Error("unsupported timeframe");
 let invalid=0,duplicates=0,gaps=0;const seen=new Set(),sorted=[...bars].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 for(let i=0;i<sorted.length;i++){const b=sorted[i],t=Date.parse(b.time),v=[b.open,b.high,b.low,b.close,b.volume??0].map(Number);
  if(!Number.isFinite(t)||!v.every(Number.isFinite)||Math.min(...v.slice(0,4))<=0||v[4]<0||v[1]<Math.max(v[0],v[3],v[2])||v[2]>Math.min(v[0],v[3],v[1]))invalid++;
  if(seen.has(t))duplicates++;seen.add(t);if(i&&Number.isFinite(t)){const d=t-Date.parse(sorted[i-1].time);if(d>step*1.5)gaps+=Math.max(1,Math.round(d/step)-1);}
 }
 const last=sorted.length?Date.parse(sorted.at(-1).time):NaN,stale=!Number.isFinite(last)||now-last>step*maxStaleIntervals;
 const score=Math.max(0,100-invalid*20-duplicates*10-Math.min(40,gaps*2)-(stale?20:0));
 return {ok:score>=80&&invalid===0,score,invalid,duplicates,gaps,stale,samples:sorted.length,lastTime:Number.isFinite(last)?new Date(last).toISOString():null};
}
export function compareProviders(a=[],b=[],{maxDeviationBps=100}={}){
 const bm=new Map(b.map(x=>[Date.parse(x.time),Number(x.close)]));let matched=0,outliers=0,sum=0,max=0;
 for(const x of a){const y=bm.get(Date.parse(x.time)),p=Number(x.close);if(!(p>0&&y>0))continue;const d=Math.abs(p-y)/((p+y)/2)*10000;matched++;sum+=d;max=Math.max(max,d);if(d>maxDeviationBps)outliers++;}
 return {ok:matched>0&&outliers===0,matched,outliers,avgDeviationBps:matched?sum/matched:null,maxDeviationBps:matched?max:null};
}
