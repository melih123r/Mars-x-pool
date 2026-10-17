const KEY=/^[A-Za-z0-9:_-]{1,160}$/;

const LUA=`
if redis.call("SETNX", KEYS[1], "1") == 0 then
  return 0
end
redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
redis.call("XADD", KEYS[2], "*", "event_id", ARGV[2], "partition_key", ARGV[3], "event_json", ARGV[4])
return 1
`;

export class RedisLemonWebhookQueue {
  constructor({
    client,
    streamKey="marsx:lemon:webhooks",
    dedupePrefix="marsx:lemon:webhook:dedupe:",
    dedupeTtlSec=7*24*60*60,
    durabilityConfirmed=false
  }={}){
    if(!client||typeof client.eval!=="function") throw new Error("Redis client with eval required");
    if(!KEY.test(streamKey)) throw new Error("invalid Lemon Redis stream key");
    if(!KEY.test(dedupePrefix)) throw new Error("invalid Lemon Redis dedupe prefix");
    if(!Number.isInteger(dedupeTtlSec)||dedupeTtlSec<300||dedupeTtlSec>30*24*60*60) throw new Error("invalid Lemon dedupe TTL");
    this.client=client;
    this.streamKey=streamKey;
    this.dedupePrefix=dedupePrefix;
    this.dedupeTtlSec=dedupeTtlSec;
    this.durable=durabilityConfirmed===true;
  }

  async enqueue(item){
    if(!item||typeof item!=="object"||typeof item.id!=="string"||!/^evt_[A-Za-z0-9_-]{8,128}$/.test(item.id)) throw new Error("invalid Lemon webhook queue item id");
    if(typeof item.partitionKey!=="string"||item.partitionKey.length<1||item.partitionKey.length>256) throw new Error("invalid Lemon webhook partition key");
    if(!item.event||typeof item.event!=="object"||Array.isArray(item.event)) throw new Error("invalid Lemon webhook queue event");
    const eventJson=JSON.stringify(item.event);
    if(eventJson.length>256*1024) throw new Error("Lemon webhook queue event too large");
    const result=await this.client.eval(LUA,{
      keys:[this.dedupePrefix+item.id,this.streamKey],
      arguments:[String(this.dedupeTtlSec),item.id,item.partitionKey,eventJson]
    });
    if(result!==0&&result!==1&&result!=="0"&&result!=="1") throw new Error("invalid Redis Lemon webhook queue result");
    return {duplicate:Number(result)===0};
  }

  status(){
    return Object.freeze({
      type:"REDIS_STREAM",
      durable:this.durable,
      streamKey:this.streamKey,
      dedupeTtlSec:this.dedupeTtlSec
    });
  }
}
