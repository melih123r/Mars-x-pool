import test from "node:test";
import assert from "node:assert/strict";
import { RedisLemonWebhookQueue } from "../global-engine/lemon-webhook-redis-queue.js";

test("Redis Lemon webhook queue performs atomic dedupe plus stream enqueue contract",async()=>{
  const calls=[];
  const client={async eval(script,options){calls.push({script,options});return 1;}};
  const queue=new RedisLemonWebhookQueue({client,durabilityConfirmed:true,dedupeTtlSec:3600});
  const result=await queue.enqueue({
    id:"evt_12345678",
    partitionKey:"account:cusa_fixture",
    event:{id:"evt_12345678",type:"account.created",created_at:"2026-10-11T00:00:00Z",context:{account:"cusa_fixture"}}
  });
  assert.equal(result.duplicate,false);
  assert.equal(queue.status().durable,true);
  assert.equal(queue.status().type,"REDIS_STREAM");
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.keys[0],"marsx:lemon:webhook:dedupe:evt_12345678");
  assert.equal(calls[0].options.keys[1],"marsx:lemon:webhooks");
  assert.equal(calls[0].options.arguments[0],"3600");
  assert.equal(calls[0].options.arguments[1],"evt_12345678");
  assert.equal(calls[0].options.arguments[2],"account:cusa_fixture");
  assert.ok(calls[0].script.includes("SETNX"));
  assert.ok(calls[0].script.includes("XADD"));
});

test("Redis Lemon webhook queue reports duplicate atomically",async()=>{
  const client={async eval(){return 0;}};
  const queue=new RedisLemonWebhookQueue({client,durabilityConfirmed:true});
  const result=await queue.enqueue({
    id:"evt_abcdefgh",
    partitionKey:"order:ord_fixture",
    event:{id:"evt_abcdefgh",type:"order.updated",created_at:"2026-10-11T00:00:00Z",context:{order:"ord_fixture"}}
  });
  assert.equal(result.duplicate,true);
});

test("Redis Lemon webhook queue is not production-durable until deployment persistence is confirmed",()=>{
  const client={async eval(){return 1;}};
  assert.equal(new RedisLemonWebhookQueue({client}).durable,false);
  assert.equal(new RedisLemonWebhookQueue({client,durabilityConfirmed:true}).durable,true);
});

test("Redis Lemon webhook queue validates keys, TTL and event envelope",async()=>{
  const client={async eval(){return 1;}};
  assert.throws(()=>new RedisLemonWebhookQueue({client,streamKey:"bad key"}),/invalid Lemon Redis stream key/);
  assert.throws(()=>new RedisLemonWebhookQueue({client,dedupeTtlSec:60}),/invalid Lemon dedupe TTL/);
  const queue=new RedisLemonWebhookQueue({client});
  await assert.rejects(()=>queue.enqueue({id:"bad",partitionKey:"x",event:{}}),/invalid Lemon webhook queue item id/);
});
