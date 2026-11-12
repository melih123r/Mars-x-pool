export function rankMiningRoutes(routes, observations={}) {
  return routes.map(route=>{
    const o=observations[route.asset] || {};
    const revenue=Number(o.confirmedRevenueUnits||0);
    const energyWh=Number(o.energyWh||0);
    const deviceHours=Number(o.deviceHours||0);
    const samples=Number(o.samples||0);
    const verified=Boolean(o.providerVerified) && samples>=3;
    const score=verified && energyWh>0 && deviceHours>0
      ? revenue / energyWh / deviceHours
      : null;
    return {...route, profitabilityVerified:verified, score};
  }).sort((a,b)=>{
    if (a.score===null && b.score===null) return 0;
    if (a.score===null) return 1;
    if (b.score===null) return -1;
    return b.score-a.score;
  });
}

export function chooseMiningRoute(routes, observations={}) {
  const ranked=rankMiningRoutes(routes, observations);
  const winner=ranked.find(x=>x.enabled && x.profitabilityVerified);
  return winner ? {selected:winner, reason:"verified_net_efficiency"} :
    {selected:null, reason:"no_verified_live_route"};
}
