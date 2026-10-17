import test from "node:test";
import assert from "node:assert/strict";
import { createLoopsNotifier } from "./loops-notifier.mjs";
const args = { apiKey: "test-key", enabled: true, transactionalIds: { "network.device_offline": "template_123456" } };
const event = { project: "network", event: "device_offline", email: "user@example.com", optedIn: true };
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
