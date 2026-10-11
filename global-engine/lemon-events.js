const EVENT_ID=/^evt_[A-Za-z0-9_-]{8,128}$/;
const EVENT_TYPE=/^[a-z0-9_.-]{3,128}$/i;

const entityKey=(event)=>{
  const context=event.context;
  if(!context||typeof context!=="object"||Array.isArray(context)) return "global";
  for(const key of ["account","order","transaction","trade","withdrawal","securities_account","person"]){
    if(typeof context[key]==="string"&&context[key]) return key+":"+context[key];
  }
  return "global";
};

export class LemonEventBuffer {
  constructor({maxEvents=1000}={}){
    if(!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>10000) throw new Error("invalid Lemon event buffer size");
    this.maxEvents=maxEvents;
    this.ids=new Set();
    this.rows=[];
    this.lastByEntity=new Map();
  }

  ingest(event){
    if(!event||typeof event!=="object"||Array.isArray(event)) throw new Error("invalid Lemon event");
    if(typeof event.id!=="string"||!EVENT_ID.test(event.id)) throw new Error("invalid Lemon event id");
    if(typeof event.type!=="string"||!EVENT_TYPE.test(event.type)) throw new Error("invalid Lemon event type");
    const timestamp=Date.parse(String(event.created_at||""));
    if(!Number.isFinite(timestamp)) throw new Error("invalid Lemon event timestamp");
    if(this.ids.has(event.id)) return Object.freeze({duplicate:true,accepted:false,requiresSnapshotRefresh:false});
    const key=entityKey(event), previous=this.lastByEntity.get(key);
    const outOfOrder=previous!==undefined&&timestamp<previous;
    this.ids.add(event.id);
    this.lastByEntity.set(key,Math.max(previous??timestamp,timestamp));
    const row=Object.freeze({id:event.id,type:event.type,createdAt:new Date(timestamp).toISOString(),entityKey:key,outOfOrder});
    this.rows.push(row);
    if(this.rows.length>this.maxEvents){
      const removed=this.rows.shift();
      this.ids.delete(removed.id);
    }
    return Object.freeze({duplicate:false,accepted:true,requiresSnapshotRefresh:outOfOrder,entityKey:key});
  }

  size(){ return this.rows.length; }
}

export const lemonWebhookPolicy=Object.freeze({
  acknowledgeWithinMs:10000,
  validateSignatureBeforeQueue:true,
  processSynchronously:false,
  deduplicateBy:"event.id",
  orderPerEntity:true,
  sourceOfTruth:"lemon.markets API snapshot",
  persistentQueueRequiredForProduction:true,
  signatureVerificationImplemented:false
});
