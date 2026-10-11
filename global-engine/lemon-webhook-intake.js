import { verifyLemonWebhookSignature, parseLemonWebhookEvent } from "./lemon-webhook.js";

const entityPartition=(event)=>{
  const c=event?.context;
  if(!c||typeof c!=="object"||Array.isArray(c)) return "global";
  for(const key of ["account","order","transaction","trade","withdrawal","securities_account","person"]){
    if(typeof c[key]==="string"&&c[key]) return key+":"+c[key];
  }
  return "global";
};

export async function intakeLemonWebhook({
  body,
  signatureHeader,
  secret,
  queue,
  nowSec=Math.floor(Date.now()/1000),
  toleranceSec=300,
  production=false
}={}){
  if(!queue||typeof queue.enqueue!=="function") throw new Error("Lemon webhook queue required");
  if(production===true&&queue.durable!==true) throw new Error("persistent Lemon webhook queue required");

  const verified=verifyLemonWebhookSignature({
    body,
    header:signatureHeader,
    secret,
    nowSec,
    toleranceSec
  });
  if(!verified.valid){
    return Object.freeze({status:401,accepted:false,duplicate:false,reason:verified.reason});
  }

  const event=parseLemonWebhookEvent(body);
  const partitionKey=entityPartition(event);
  const result=await queue.enqueue({
    id:event.id,
    partitionKey,
    event
  });
  const duplicate=result===false||result?.duplicate===true;
  return Object.freeze({
    status:200,
    accepted:!duplicate,
    duplicate,
    eventId:event.id,
    partitionKey,
    requiresAsyncProcessing:true
  });
}

export class MemoryLemonWebhookQueue {
  constructor({max=1000}={}){
    if(!Number.isInteger(max)||max<1||max>10000) throw new Error("invalid Lemon webhook queue size");
    this.max=max;
    this.durable=false;
    this.ids=new Set();
    this.rows=[];
  }
  async enqueue(item){
    if(!item||typeof item!=="object"||!item.id||!item.partitionKey||!item.event) throw new Error("invalid Lemon webhook queue item");
    if(this.ids.has(item.id)) return {duplicate:true};
    this.ids.add(item.id);
    this.rows.push(Object.freeze({id:item.id,partitionKey:item.partitionKey,event:item.event}));
    if(this.rows.length>this.max){
      const removed=this.rows.shift();
      this.ids.delete(removed.id);
    }
    return {duplicate:false};
  }
  size(){return this.rows.length;}
}
