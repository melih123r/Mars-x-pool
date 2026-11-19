import test from "node:test";
import assert from "node:assert/strict";
import {
  createRuntimeConfigLoader,
  retryableConnectionError,
} from "../supabase/functions/marsx-pool-api/runtime-config-loader.js";

test("deduplicates concurrent Vault loads and caches successful results", async () => {
  let count = 0;
  let time = 1000;
  const get = createRuntimeConfigLoader(async () => {
    count++;
    await Promise.resolve();
    return { google_auth: "configured" };
  }, { ttlMs: 100, now: () => time });
  const [a, b, c] = await Promise.all([get(), get(), get()]);
  assert.equal(count, 1);
  assert.deepEqual([a, b, c], [a, a, a]);
  time += 50;
  assert.strictEqual(await get(), a);
  assert.equal(count, 1);
  time += 101;
  assert.deepEqual(await get(), a);
  assert.equal(count, 2);
});

test("retries CONNECT_TIMEOUT once only for read-only config fetch", async () => {
  let attempts = 0;
  let sleeps = 0;
  const get = createRuntimeConfigLoader(async () => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error("transient"), { code: "CONNECT_TIMEOUT" });
    return { ready: true };
  }, { sleep: async (ms) => { assert.equal(ms, 250); sleeps++; } });
  assert.deepEqual(await get(), { ready: true });
  assert.equal(attempts, 2);
  assert.equal(sleeps, 1);
});

test("second timeout fails closed and is not cached", async () => {
  let attempts = 0;
  const get = createRuntimeConfigLoader(async () => {
    attempts++;
    if (attempts <= 2) throw Object.assign(new Error("transient"), { code: "CONNECT_TIMEOUT" });
    return { ready: true };
  }, { sleep: async () => {} });
  await assert.rejects(get(), /transient/);
  assert.deepEqual(await get(), { ready: true });
  assert.equal(attempts, 3);
});

test("does not retry permanent errors or unrecognized errors", async () => {
  let attempts = 0;
  const get = createRuntimeConfigLoader(async () => {
    attempts++;
    throw Object.assign(new Error("auth rejected"), { code: "28P01" });
  }, { sleep: async () => { assert.fail("no retry expected"); } });
  await assert.rejects(get(), /auth rejected/);
  assert.equal(attempts, 1);
  assert.equal(retryableConnectionError({ code: "28P01" }), false);
  assert.equal(retryableConnectionError({ code: "CONNECT_TIMEOUT" }), true);
});
