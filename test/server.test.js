import assert from "node:assert/strict";
import test from "node:test";
import { createServer, MemoryStore } from "../server.js";

async function runServer(options = {}) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

test("health and privacy are public", async () => {
  const { server, baseUrl } = await runServer();
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "marsx-pool-worker-api",
      version: "0.2.0",
      storage: "memory",
      persistent: false,
    });
    const privacy = await fetch(`${baseUrl}/privacy`);
    assert.equal(privacy.status, 200);
    assert.match(await privacy.text(), /Privacy Policy/);
  } finally {
    await close(server);
  }
});

test("protected routes fail safely when the token is missing", async () => {
  const { server, baseUrl } = await runServer({ token: "" });
  try {
    const response = await fetch(`${baseUrl}/workers`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "WORKER_TOKEN not configured" });
  } finally {
    await close(server);
  }
});

test("registration, heartbeat, listing, and summary share one API schema", async () => {
  let timestamp = Date.parse("2026-09-25T12:00:00.000Z");
  const store = new MemoryStore();
  const { server, baseUrl } = await runServer({ token: "test-token", store, now: () => timestamp });
  const headers = { Authorization: "Bearer test-token", "Content-Type": "application/json" };
  try {
    const denied = await fetch(`${baseUrl}/workers`);
    assert.equal(denied.status, 401);

    const register = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workerId: "node-001", platform: "android-36", label: "Beta node" }),
    });
    assert.equal(register.status, 200);
    const registered = await register.json();
    assert.equal(registered.worker.workerId, "node-001");
    assert.equal(registered.worker.platform, "android-36");

    timestamp += 30_000;
    const heartbeat = await fetch(`${baseUrl}/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ node_id: "node-001", cpu_percent: 12.5 }),
    });
    assert.equal(heartbeat.status, 200);
    assert.equal((await heartbeat.json()).worker.cpuPercent, 12.5);

    const summary = await fetch(`${baseUrl}/summary`, { headers: { Authorization: "Bearer test-token" } });
    assert.deepEqual(await summary.json(), { registered: 1, online: 1 });

    const workers = await fetch(`${baseUrl}/workers`, { headers: { Authorization: "Bearer test-token" } });
    const list = await workers.json();
    assert.equal(list.workers.length, 1);
    assert.equal(list.workers[0].status, "online");
  } finally {
    await close(server);
  }
});

test("invalid payloads are rejected", async () => {
  const { server, baseUrl } = await runServer({ token: "test-token" });
  try {
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(response.status, 415);
  } finally {
    await close(server);
  }
});
