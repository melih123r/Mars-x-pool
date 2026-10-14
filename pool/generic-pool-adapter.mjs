const ALLOWED_ASSETS=new Set(["VRSC","XMR","ZEPH","QUBIC"]);

function required(v,n){if(!v) throw new Error(`${n} required`);return v;}

export function createGenericPoolAdapter({asset,baseUrl,apiKey,fetchImpl=fetch}){
  asset=String(asset||"").toUpperCase();
  if(!ALLOWED_ASSETS.has(asset)) throw new Error("unsupported generic pool asset");
  required(baseUrl,"baseUrl"); required(apiKey,"apiKey");
  const base=String(baseUrl).replace(/\/$/,"");
  async function request(path){
    if(!String(path).startsWith("/")) throw new Error("invalid pool path");
    const res=await fetchImpl(base+path,{headers:{"Authorization":`Bearer ${apiKey}`,"Accept":"application/json"}});
    if(!res.ok) throw new Error(`pool http ${res.status}`);
    return res.json();
  }
  return Object.freeze({
    asset,
    async workerStatus(workerId){required(workerId,"workerId");return request(`/workers/${encodeURIComponent(workerId)}`);},
    async settlements(workerId){required(workerId,"workerId");return request(`/settlements/${encodeURIComponent(workerId)}`);}
  });
}

export function normalizeGenericSettlement({asset,workerId,row}){
  if(!ALLOWED_ASSETS.has(asset)) throw new Error("unsupported generic pool asset");
  required(workerId,"workerId"); required(row?.reference,"provider reference");
  const grossUnits=BigInt(row.grossUnits);
  if(grossUnits<=0n) throw new Error("grossUnits must be positive");
  return Object.freeze({source:"provider_settlement",provider:"generic_pool",asset,workerId,providerReference:String(row.reference),grossUnits,observedAt:row.observedAt||new Date().toISOString()});
}
