import test from "node:test";
import assert from "node:assert/strict";
import { LemonEventBuffer, lemonWebhookPolicy } from "../global-engine/lemon-events.js";

const evt=(id,created_at,context={account:"cusa_fixture"},type="account.created")=>({id,type,created_at,context});

test("Lemon event buffer deduplicates by event id",()=>{
  const b=new LemonEventBuffer({maxEvents:10});
  const first=b.ingest(evt("evt_12345678","2026-10-11T00:00:00Z"));
  const second=b.ingest(evt("evt_12345678","2026-10-11T00:00:00Z"));
  assert.equal(first.accepted,true);
  assert.equal(second.duplicate,true);
  assert.equal(b.size(),1);
});

test("Lemon event buffer flags out-of-order events for API snapshot refresh",()=>{
  const b=new LemonEventBuffer();
  b.ingest(evt("evt_abcdefgh","2026-10-11T00:00:02Z",{order:"ord_fixture"},"order.updated"));
  const older=b.ingest(evt("evt_ijklmnop","2026-10-11T00:00:01Z",{order:"ord_fixture"},"order.updated"));
  assert.equal(older.accepted,true);
  assert.equal(older.requiresSnapshotRefresh,true);
  assert.equal(older.entityKey,"order:ord_fixture");
});

test("Lemon event buffer validates event envelope and stays bounded",()=>{
  const b=new LemonEventBuffer({maxEvents:2});
  assert.throws(()=>b.ingest({}),/invalid Lemon event id/);
  b.ingest(evt("evt_11111111","2026-10-11T00:00:00Z"));
  b.ingest(evt("evt_22222222","2026-10-11T00:00:01Z"));
  b.ingest(evt("evt_33333333","2026-10-11T00:00:02Z"));
  assert.equal(b.size(),2);
  assert.equal(b.ingest(evt("evt_11111111","2026-10-11T00:00:03Z")).duplicate,false);
});

test("Lemon webhook policy requires async verified persistent processing for production",()=>{
  assert.equal(lemonWebhookPolicy.acknowledgeWithinMs,10000);
  assert.equal(lemonWebhookPolicy.validateSignatureBeforeQueue,true);
  assert.equal(lemonWebhookPolicy.processSynchronously,false);
  assert.equal(lemonWebhookPolicy.persistentQueueRequiredForProduction,true);
  assert.equal(lemonWebhookPolicy.signatureVerificationImplemented,false);
});
