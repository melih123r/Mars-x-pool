const clamp=x=>Math.max(0,Math.min(100,Number(x)||0));
export function marsxConfidence({liquidity=50,macro=50,momentum=50,positioning=50,volatility=50,risk=50,dataQuality=100,freshness=100,historicalReliability=50}={}){
 const L=(clamp(liquidity)+clamp(macro))/2,M=(clamp(momentum)+clamp(positioning)+clamp(volatility))/3,A=(clamp(risk)+clamp(historicalReliability))/2;
 const raw=.30*L+.40*M+.30*A,trust=(clamp(dataQuality)/100)*(clamp(freshness)/100);
 return {score:clamp(raw*trust),rawScore:clamp(raw),trustFactor:trust,directionFactor:{L,M,A},weights:{L:.30,M:.40,A:.30},mode:"ANALYTICS_ONLY"};
}
