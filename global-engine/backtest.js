export function backtest({bars=[],signal,feeBps=0,slippageBps=0,initialCash=10000,quality}={}){
 if(quality&&quality.ok!==true)throw new Error("historical quality gate failed");if(typeof signal!=="function"||bars.length<2)throw new Error("insufficient backtest input");
 let cash=Number(initialCash),units=0,trades=0;const equity=[];
 for(let i=1;i<bars.length;i++){const prev=bars[i-1],bar=bars[i],px=Number(bar.open);if(!(px>0))continue;
  const action=String(signal({history:bars.slice(0,i),previous:prev,index:i})||"HOLD").toUpperCase();
  if(action==="BUY"&&units===0){const p=px*(1+slippageBps/10000),fee=cash*feeBps/10000;units=(cash-fee)/p;cash=0;trades++;}
  else if(action==="SELL"&&units>0){const p=px*(1-slippageBps/10000),gross=units*p,fee=gross*feeBps/10000;cash=gross-fee;units=0;trades++;}
  equity.push({time:bar.time,value:cash+units*Number(bar.close)});
 }
 const finalEquity=equity.at(-1)?.value??Number(initialCash);return {mode:"PAPER_BACKTEST",initialCash:Number(initialCash),finalEquity,trades,returnPct:(finalEquity/Number(initialCash)-1)*100,equity};
}
