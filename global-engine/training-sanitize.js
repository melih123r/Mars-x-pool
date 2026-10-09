const ALLOWED=["symbol","assetClass","side","orderType","notionalBucket","holdingTimeBucket","slippageBps","feeBps","outcomeBps","confidence","regime","venueClass","timestampBucket"];
export function sanitizeTrainingEvent(event={}){const out={};for(const k of ALLOWED)if(event[k]!==undefined)out[k]=event[k];return Object.freeze(out);}
export function bucketNotional(n){const x=Math.abs(Number(n)||0);return x<100?"LT_100":x<1000?"100_1K":x<10000?"1K_10K":x<100000?"10K_100K":"GE_100K";}
