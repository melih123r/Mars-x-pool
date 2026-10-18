import test from "node:test";
import assert from "node:assert/strict";
import { createNetworkBridge } from "./network-bridge.mjs";
const base = { apiBase: "https://example.com", getSession: async () => ({ token: "test", installId: "install" }) };
test("rejects non-HTTPS endpoints", () => {
  assert.throws(() => createNetworkBridge({ ...base, apiBase: "http://example.com", hasConsent: () => true }), /HTTPS/);
});
test("never sends without consent", async () => {
  let calls = 0;
  const bridge = createNetworkBridge({ ...base, hasConsent: () => false, fetchImpl: async () => { calls++; } });
  assert.equal((await bridge.heartbeat({ workerId: "abc" })).reason, "consent_required");
  assert.equal(calls, 0);
});
test("rejects missing license", async () => {
  const bridge = createNetworkBridge({ ...base, getSession: async () => null, hasConsent: () => true });
  assert.equal((await bridge.register({ workerId: "abc" })).reason, "license_required");
});
test("rechecks consent after session lookup", async () => {
  let allowed = true, calls = 0;
  const bridge = createNetworkBridge({ ...base, getSession: async () => { allowed = false; return { token: "test", installId: "install" }; }, hasConsent: () => allowed, fetchImpl: async () => { calls++; } });
  assert.equal((await bridge.register({ workerId: "abc" })).reason, "consent_required");
  assert.equal(calls, 0);
});
test("posts only to expected heartbeat route", async () => {
  let url, opts;
  const bridge = createNetworkBridge({ ...base, hasConsent: () => true, fetchImpl: async (u, o) => { url = u; opts = o; return { ok: true, status: 200 }; } });
  assert.deepEqual(await bridge.heartbeat({ workerId: "abc" }), { ok: true, status: 200 });
  assert.equal(url, "https://example.com/heartbeat");
  assert.equal(opts.headers.authorization, "License test");
  assert.equal(opts.redirect, "error");
});
test("does not leak request errors", async () => {
  const bridge = createNetworkBridge({ ...base, hasConsent: () => true, fetchImpl: async () => { throw new Error("secret token"); } });
  assert.equal((await bridge.heartbeat({ workerId: "abc" })).reason, "network_error");
});
test("notification failures do not invalidate successful API call", async () => {
  const bridge = createNetworkBridge({ ...base, hasConsent: () => true, fetchImpl: async () => ({ ok: true, status: 201 }), onEvent: async () => { throw new Error("mail down"); } });
  assert.equal((await bridge.register({ workerId: "abc" })).ok, true);
});

test("rejects invalid worker payloads before network access", async () => {
  let calls = 0;
  const bridge = createNetworkBridge({ ...base, hasConsent: () => true, fetchImpl: async () => { calls++; return { ok: true, status: 200 }; } });
  for (const worker of [null, [], {}, { workerId: "" }, { workerId: "../admin" }, { workerId: "x".repeat(129) }]) {
    assert.deepEqual(await bridge.register(worker), { ok: false, reason: "invalid_worker" });
  }
  assert.equal(calls, 0);
});
test("rejects invalid request timeout configuration", () => {
  for (const timeoutMs of [0, -1, 99, 60001, Infinity, NaN, 1.5]) {
    assert.throws(() => createNetworkBridge({ ...base, hasConsent: () => true, timeoutMs }), /timeoutMs/);
  }
});
