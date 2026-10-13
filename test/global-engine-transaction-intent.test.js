import test from "node:test";
import assert from "node:assert/strict";
import {initializeTransactionIntentStore} from "../global-engine/transaction-intent-store.js";

test("transaction intent reservation is atomic, scoped to user and refuses changed payload",async()=>{
 const records=new Map();
 const pool={async query(sql,params=[]){
  if(sql.startsWith("CREATE TABLE"))return {rows:[]};
  const [user,key,hash]=params;const id=user+":"+key;
  if(sql.includes("INSERT INTO")){
   if(records.has(id))return {rows:[]};
   const row={id:records.size+1,payload_hash:hash,status:"reserved",created_at:"2026-10-13T00:00:00Z"};
   records.set(id,row);return {rows:[row]};
  }
  const row=records.get(id);return {rows:row?[row]:[]};
 }};
 const store=await initializeTransactionIntentStore(pool);
 const base={userId:"user-123",idempotencyKey:"random-token-12345678",payloadHash:"a".repeat(64)};
 assert.equal((await store.reserve(base)).created,true);
 assert.equal((await store.reserve(base)).created,false);
 assert.equal((await store.reserve({...base,payloadHash:"b".repeat(64)})).conflict,true);
 assert.equal((await store.reserve({...base,userId:"user-456"})).created,true);
 await assert.rejects(store.reserve({...base,idempotencyKey:"short"}),/idempotencyKey/);
});
