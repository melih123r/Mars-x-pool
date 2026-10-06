export function verifyStratumProbe(p){
 if(!p||p.tls!==true)return{verified:false,reason:'tls-required'};
 if(p.certificateValid!==true)return{verified:false,reason:'certificate-invalid'};
 if(p.protocol!=='stratum')return{verified:false,reason:'protocol-unverified'};
 if(p.authorized!==true)return{verified:false,reason:'worker-not-authorized'};
 if(p.acceptedShare!==true)return{verified:false,reason:'accepted-share-not-observed'};
 if(typeof p.poolHost!=='string'||p.poolHost.length<4)return{verified:false,reason:'pool-host-required'};
 return{verified:true,reason:'tls-stratum-and-share-verified',poolHost:p.poolHost};
}
export function probeIsFresh(p,now=Date.now(),maxAgeMs=60000){
 return Number.isFinite(p?.observedAtMs)&&p.observedAtMs<=now&&now-p.observedAtMs<=maxAgeMs;
}
