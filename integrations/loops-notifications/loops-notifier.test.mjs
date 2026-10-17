import test from "node:test";
import assert from "node:assert/strict";
import { createLoopsNotifier } from "./loops-notifier.mjs";
const args = { apiKey: "test-key", enabled: true, transactionalIds: { "network.device_offline": "template_123456" } };
const event = { project: "network", event: "device_offline", email: "user@example.com", optedIn: true, idempotencyKey: "network:event:12345678" };
test("disabled by default", async () => {
  const n = createLoopsNotifier({ apiKey: "test" });
  assert.equal((await n.notify(event)).reason, "disabled");
});
test("requires opt-in before sending", async () => {
  let called = false;
  const n = createLoopsNotifier({ ...args, fetchImpl: async () => { called = true; } });
  assert.equal((await n.notify({ ...event, optedIn: false })).reason, "consent_required");
  assert.equal(called, false);
});
test("requires configured published template ID", async () => {
  const n = createLoopsNotifier({ ...args, transactionalIds: {} });
  assert.equal((await n.notify(event)).reason, "template_not_configured");
});
test("sends only allowlisted variables with server-side key", async () => {
  let url, opts;
  const n = createLoopsNotifier({ ...args, fetchImpl: async (u, o) => { url = u; opts = o; return { ok: true, status: 200 }; } });
  assert.deepEqual(await n.notify({ ...event, data: { status: "offline", secret: "never send" } }), { ok: true, status: 200 });
  assert.equal(url, "https://app.loops.so/api/v1/transactional");
  assert.equal(opts.headers.authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(opts.body).dataVariables, { status: "offline" });
});
test("rejects unsupported project", async () => {
  const n = createLoopsNotifier(args);
  assert.equal((await n.notify({ ...event, project: "other" })).reason, "unsupported_event");
});
test("fails closed on network error", async () => {
  const n = createLoopsNotifier({ ...args, fetchImpl: async () => { throw Error("secret"); } });
  assert.equal((await n.notify(event)).reason, "network_error");
});

test("retries 429 with same idempotency key", async () => {
  const keys = []; let count = 0;
  const n = createLoopsNotifier({ ...args, sleep: async () => {}, fetchImpl: async (_u, opts) => {
    keys.push(opts.headers["Idempotency-Key"]); count++;
    return { ok: count === 2, status: count === 2 ? 200 : 429 };
  } });
  assert.equal((await n.notify(event)).ok, true);
  assert.equal(count, 2);
  assert.deepEqual(keys, ["network:event:12345678", "network:event:12345678"]);
});
test("does not retry non-transient 400 errors", async () => {
  let count = 0;
  const n = createLoopsNotifier({ ...args, sleep: async () => {}, fetchImpl: async () => { count++; return { ok: false, status: 400 }; } });
  assert.equal((await n.notify(event)).status, 400);
  assert.equal(count, 1);
});
test("409 is reported for reconciliation, not retried", async () => {
  let count = 0;
  const n = createLoopsNotifier({ ...args, fetchImpl: async () => { count++; return { ok: false, status: 409 }; } });
  assert.equal((await n.notify(event)).reason, "duplicate_or_conflict_reconcile");
  assert.equal(count, 1);
});
test("requires durable business event idempotency key", async () => {
  const n = createLoopsNotifier(args);
  assert.equal((await n.notify({ ...event, idempotencyKey: undefined })).reason, "idempotency_key_required");
});
