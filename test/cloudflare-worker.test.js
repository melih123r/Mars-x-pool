import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleRequest } from "../cloudflare/worker.js";

const LICENSE_KEY = "MARSX-TEST-0000-0000-0000-0000-0000";
const PEPPER = "local-test-license-pepper-32-chars-minimum";
const SESSION_SECRET = "local-test-session-secret-32-chars-minimum";

class FakeD1 {
  constructor() {
    this.devices = new Map();
    this.workers = new Map();
    this.balances = new Map();
    this.dormant = new Map();
    this.payouts = new Map();
  }

  prepare(sql) { return new FakeStatement(this, sql.replace(/\s+/g, " ").trim()); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}

class FakeStatement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new FakeStatement(this.db, this.sql, values); }

  async first() {
    const [a, b] = this.values;
    if (this.sql === "SELECT 1 AS ok") return { ok: 1 };
    if (this.sql.startsWith("SELECT 1 AS ok FROM license_devices")) {
      return this.db.devices.get(a)?.has(b) ? { ok: 1 } : null;
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS count FROM license_devices")) {
      return { count: this.db.devices.get(a)?.size || 0 };
    }
    if (this.sql.startsWith("SELECT * FROM workers WHERE worker_id")) return this.db.workers.get(a) || null;
    if (this.sql.startsWith("SELECT units FROM balances WHERE worker_id")) return { units: this.db.balances.get(a) || 0 };
    if (this.sql.startsWith("SELECT units FROM dormant_balances")) return { units: this.db.dormant.get(a) || 0 };
    if (this.sql.startsWith("SELECT * FROM payouts WHERE worker_id") && this.sql.includes("idempotency_key")) {
      return [...this.db.payouts.values()].find((row) => row.worker_id === a && row.idempotency_key === b) || null;
    }
    return null;
  }

  async all() {
    const [workerId] = this.values;
    if (this.sql.startsWith("SELECT * FROM payouts WHERE worker_id")) {
      return { results: [...this.db.payouts.values()].filter((row) => row.worker_id === workerId) };
    }
    if (this.sql.startsWith("SELECT * FROM workers ORDER BY")) return { results: [...this.db.workers.values()] };
    return { results: [] };
  }

  async run() {
    const v = this.values;
    if (this.sql.startsWith("INSERT INTO license_devices")) {
      const devices = this.db.devices.get(v[0]) || new Set();
      devices.add(v[1]);
      this.db.devices.set(v[0], devices);
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO workers")) {
      const previous = this.db.workers.get(v[0]);
      this.db.workers.set(v[0], {
        worker_id: v[0], license_id: v[1], install_id: v[2], label: v[3], platform: v[4],
        cpu_percent: v[5], hashrate: v[6], registered_at: previous?.registered_at || v[7],
        last_seen: v[8], last_activity_at: v[9], last_activity_ms: v[10], dormant_at: null,
        reactivated_at: v[12], session_id: previous?.session_id || v[13],
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO balances")) {
      if (!this.db.balances.has(v[0]) || !this.sql.includes("DO NOTHING")) this.db.balances.set(v[0], Number(v[1] || 0));
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE workers SET last_activity_at")) {
      const row = this.db.workers.get(v[0]);
      if (row) Object.assign(row, { last_activity_at: v[1], last_activity_ms: v[2] });
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (this.sql.startsWith("DELETE FROM dormant_balances")) {
      this.db.dormant.delete(v[0]);
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

function env() {
  return {
    DB: new FakeD1(),
    LICENSE_PEPPER: PEPPER,
    LICENSE_SESSION_SECRET: SESSION_SECRET,
    LICENSE_RECORDS_JSON: JSON.stringify([{
      id: "local_beta_01",
      keyHash: createHmac("sha256", PEPPER).update(LICENSE_KEY).digest("hex"),
      status: "active",
      maxDevices: 1,
    }]),
    ADMIN_TOKEN: "local-test-admin-token-32-chars-minimum",
    WORKER_TOKEN: "local-test-worker-token-32-chars-minimum",
  };
}

async function call(runtime, path, options = {}) {
  return handleRequest(new Request(`https://example.workers.dev${path}`, options), runtime);
}

test("Cloudflare D1 worker supports the closed-beta contract", async () => {
  const runtime = env();
  const health = await call(runtime, "/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "marsx-pool-worker-api",
    version: "0.6.1",
    storage: "d1",
    persistent: true,
    licensing: "ready",
    license_provider: "marsx_beta",
    payoutMode: "sandbox",
    dormantPolicy: "safeguarded-liability-reserve",
  });

  const installId = "cloudflare_install_12345";
  const activate = await call(runtime, "/license/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      license_key: LICENSE_KEY,
      install_id: installId,
      terms_accepted: true,
      terms_version: "2026-09-26-v2",
      app_version: "0.6.1-beta",
    }),
  });
  assert.equal(activate.status, 200);
  const activated = await activate.json();
  assert.ok(activated.session_token);

  const wrongDevice = await call(runtime, "/license/status", {
    headers: { Authorization: `License ${activated.session_token}`, "X-Install-Id": "cloudflare_wrong_12345" },
  });
  assert.equal(wrongDevice.status, 401);

  const noAuth = await call(runtime, "/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workerId: "cloudflare-node", install_id: installId }),
  });
  assert.equal(noAuth.status, 401);

  const headers = { Authorization: `License ${activated.session_token}`, "content-type": "application/json" };
  const register = await call(runtime, "/register", {
    method: "POST",
    headers,
    body: JSON.stringify({ workerId: "cloudflare-node", install_id: installId, platform: "android-36", label: "Cloudflare beta" }),
  });
  assert.equal(register.status, 200);

  const heartbeat = await call(runtime, "/heartbeat", {
    method: "POST",
    headers,
    body: JSON.stringify({ node_id: "cloudflare-node", install_id: installId, cpu_percent: 12.5, hashrate: 0 }),
  });
  assert.equal(heartbeat.status, 200);
  assert.equal((await heartbeat.json()).worker.cpuPercent, 12.5);

  const account = await call(runtime, "/account", {
    headers: {
      Authorization: `License ${activated.session_token}`,
      "X-Install-Id": installId,
      "X-Worker-Id": "cloudflare-node",
    },
  });
  assert.equal(account.status, 200);
  const accountBody = await account.json();
  assert.equal(accountBody.asset, "USDT_TEST");
  assert.equal(accountBody.withdrawable, false);
  assert.equal(accountBody.availableUnits, 0);

  const adminDenied = await call(runtime, "/summary", {
    headers: { Authorization: `License ${activated.session_token}` },
  });
  assert.equal(adminDenied.status, 401);
});
