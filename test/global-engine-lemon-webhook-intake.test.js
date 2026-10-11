import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { intakeLemonWebhook, MemoryLemonWebhookQueue } from "../global-engine/lemon-webhook-intake.js";

const sign=(body,secret,timestamp)=>{
  const digest=crypto.createHmac("sha256",secret).update(String(timestamp)).update(".").update(body).digest("hex");
  return `t=${timestamp},v1=${digest}`;
};

test("Lemon webhook intake verifies, queues and deduplicates without synchronous processing",async()=>{
  const secret="0".repeat(64), nowSec=1000;
  const body=JSON.stringify({id:"evt_12345678",type:"account.created",created_at:"2026-10-11T00:00:00Z",context:{account:"cusa_fixture"}});
  const header=sign(body,secret,nowSec);
  const queue=new MemoryLemonWebhookQueue({max:10});
  const first=await intakeLemonWebhook({body,signatureHeader:header,secret,queue,nowSec,toleranceSec:0});
  assert.deepEqual(first,{
    status:200,accepted:true,duplicate:false,eventId:"evt_12345678",
    partitionKey:"account:cusa_fixture",requiresAsyncProcessing:true
  });
  const second=await intakeLemonWebhook({body,signatureHeader:header,secret,queue,nowSec,toleranceSec:0});
  assert.equal(second.status,200);
  assert.equal(second.accepted,false);
  assert.equal(second.duplicate,true);
  assert.equal(queue.size(),1);
});

test("Lemon webhook intake rejects bad signatures before queueing",async()=>{
  const secret="0".repeat(64), queue=new MemoryLemonWebhookQueue();
  const body=JSON.stringify({id:"evt_abcdefgh",type:"order.updated",created_at:"2026-10-11T00:00:00Z",context:{order:"ord_fixture"}});
  const result=await intakeLemonWebhook({body,signatureHeader:"t=1000,v1="+"1".repeat(64),secret,queue,nowSec:1000,toleranceSec:0});
  assert.equal(result.status,401);
  assert.equal(result.accepted,false);
  assert.equal(queue.size(),0);
});

test("production webhook intake refuses non-durable queues",async()=>{
  const secret="0".repeat(64), nowSec=1000;
  const body=JSON.stringify({id:"evt_87654321",type:"trade.created",created_at:"2026-10-11T00:00:00Z",context:{trade:"trd_fixture"}});
  const header=sign(body,secret,nowSec);
  await assert.rejects(
    ()=>intakeLemonWebhook({body,signatureHeader:header,secret,queue:new MemoryLemonWebhookQueue(),nowSec,toleranceSec:0,production:true}),
    /persistent Lemon webhook queue required/
  );
});

test("Lemon webhook intake uses entity partition keys for ordered processing",async()=>{
  const secret="0".repeat(64), nowSec=1000, seen=[];
  const queue={durable:true,async enqueue(item){seen.push(item);return {duplicate:false};}};
  const body=JSON.stringify({id:"evt_partition1",type:"withdrawal.updated",created_at:"2026-10-11T00:00:00Z",context:{withdrawal:"wd_fixture"}});
  const header=sign(body,secret,nowSec);
  const result=await intakeLemonWebhook({body,signatureHeader:header,secret,queue,nowSec,toleranceSec:0,production:true});
  assert.equal(result.partitionKey,"withdrawal:wd_fixture");
  assert.equal(seen[0].partitionKey,"withdrawal:wd_fixture");
});
