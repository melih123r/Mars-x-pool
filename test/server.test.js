import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createServer, MemoryStore } from "../server.js";

const LICENSE_KEY = "MARSX-TEST-ABCD-EFGH-IJKL";
const LICENSE_PEPPER = "test-pepper-that-is-at-least-32-characters-long";
const LICENSE_SESSION_SECRET = "test-session-secret-at-least-32-characters";
const LICENSE_RECORDS = [{
  id: "beta_test_001",
  keyHash: createHmac("sha256", LICENSE_PEPPER).update(LICENSE_KEY).digest("hex"),
  status: "active",
  maxDevices: 1,
}];

async function runServer(options = {}) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function activate(baseUrl, installId = "install_1234567890", key = LICENSE_KEY) {
  return fetch(`${baseUrl}/license/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      license_key: key,
      install_id: installId,
      terms_accepted: true,
      terms_version: "2026-09-26-v2",
      app_version: "0.6-beta",
    }),
  });
}

function licensedOptions(extra = {}) {
  return {
    token: "admin-token",
    adminToken: "payout-admin-token",
    store: new MemoryStore(),
    licensePepper: LICENSE_PEPPER,
    licenseSessionSecret: LICENSE_SESSION_SECRET,
    licenseRecords: LICENSE_RECORDS,
    ...extra,
  };
}

async function activateAndRegister(baseUrl, workerId = "node-001", installId = "install_1234567890") {
  const activation = await activate(baseUrl, installId);
  assert.equal(activation.status, 200);
  const { session_token: sessionToken } = await activation.json();
  const licenseHeaders = {
    Authorization: `License ${sessionToken}`,
    "Content-Type": "application/json",
  };
  const registration = await fetch(`${baseUrl}/register`, {
    method: "POST",
    headers: licenseHeaders,
    body: JSON.stringify({ workerId, install_id: installId, platform: "android-36", label: "Beta node" }),
  });
  assert.equal(registration.status, 200);
  return {
    sessionToken,
    headers: {
      ...licenseHeaders,
      "X-Install-Id": installId,
      "X-Worker-Id": workerId,
    },
  };
}

test("health and privacy are public", async () => {
  const { server, baseUrl } = await runServer(licensedOptions());
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "marsx-pool-worker-api",
      version: "0.6.0",
      storage: "memory",
      persistent: false,
      licensing: "ready",
      license_provider: "marsx_beta",
      payoutMode: "sandbox",
      dormantPolicy: "safeguarded-liability-reserve",
    });
    const privacy = await fetch(`${baseUrl}/privacy`);
    assert.equal(privacy.status, 200);
    assert.match(await privacy.text(), /Privacy Policy/);
  } finally {
    await close(server);
  }
});

test("invalid key and missing terms are denied", async () => {
  const { server, baseUrl } = await runServer(licensedOptions());
  try {
    const badKey = await activate(baseUrl, "install_1234567890", "WRONG");
    assert.equal(badKey.status, 401);
    const missingTerms = await fetch(`${baseUrl}/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: LICENSE_KEY, install_id: "install_1234567890" }),
    });
    assert.equal(missingTerms.status, 400);
  } finally {
    await close(server);
  }
});

test("activation binds one device and creates a valid session", async () => {
  const { server, baseUrl } = await runServer(licensedOptions());
  try {
    const activated = await activate(baseUrl);
    assert.equal(activated.status, 200);
    const body = await activated.json();
    assert.equal(body.license_id, "beta_test_001");
    assert.ok(body.session_token);

    const status = await fetch(`${baseUrl}/license/status`, {
      headers: { Authorization: `License ${body.session_token}`, "X-Install-Id": "install_1234567890" },
    });
    assert.equal(status.status, 200);

    const wrongDevice = await fetch(`${baseUrl}/license/status`, {
      headers: { Authorization: `License ${body.session_token}`, "X-Install-Id": "install_wrongdevice" },
    });
    assert.equal(wrongDevice.status, 401);

    const secondDevice = await activate(baseUrl, "install_abcdefghij");
    assert.equal(secondDevice.status, 409);
  } finally {
    await close(server);
  }
});

test("licensed registration and heartbeat work while admin listing stays separate", async () => {
  let timestamp = Date.parse("2026-09-25T12:00:00.000Z");
  const options = licensedOptions({ now: () => timestamp });
  const { server, baseUrl } = await runServer(options);
  try {
    const activation = await activate(baseUrl);
    const { session_token: sessionToken } = await activation.json();
    const headers = { Authorization: `License ${sessionToken}`, "Content-Type": "application/json" };

    const denied = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: "node-001", install_id: "install_1234567890" }),
    });
    assert.equal(denied.status, 401);

    const register = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workerId: "node-001", install_id: "install_1234567890", platform: "android-36", label: "Beta node" }),
    });
    assert.equal(register.status, 200);
    assert.equal((await register.json()).worker.licenseId, "beta_test_001");

    timestamp += 30_000;
    const heartbeat = await fetch(`${baseUrl}/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ node_id: "node-001", install_id: "install_1234567890", cpu_percent: 12.5 }),
    });
    assert.equal(heartbeat.status, 200);
    assert.equal((await heartbeat.json()).worker.cpuPercent, 12.5);

    const adminDenied = await fetch(`${baseUrl}/summary`, { headers: { Authorization: `License ${sessionToken}` } });
    assert.equal(adminDenied.status, 401);
    const summary = await fetch(`${baseUrl}/summary`, { headers: { Authorization: "Bearer admin-token" } });
    assert.deepEqual(await summary.json(), { registered: 1, online: 1 });
  } finally {
    await close(server);
  }
});

test("invalid payloads are rejected", async () => {
  const { server, baseUrl } = await runServer(licensedOptions());
  try {
    const response = await fetch(`${baseUrl}/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(response.status, 415);
  } finally {
    await close(server);
  }
});

test("licensed sandbox payouts reserve balance once and rejected payouts refund it", async () => {
  let timestamp = Date.parse("2026-09-25T12:00:00.000Z");
  const { server, baseUrl } = await runServer(licensedOptions({ now: () => timestamp }));
  try {
    const { headers } = await activateAndRegister(baseUrl);
    const adminHeaders = { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" };
    const credit = await fetch(`${baseUrl}/admin/credits`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ workerId: "node-001", amountUnits: 5_000_000, reason: "test credit" }),
    });
    assert.equal(credit.status, 201);

    const requestBody = JSON.stringify({
      amountUnits: 2_000_000,
      destination: "sandbox-wallet-001",
      idempotencyKey: "payout-key-0001",
    });
    const first = await fetch(`${baseUrl}/payouts`, { method: "POST", headers, body: requestBody });
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    assert.equal(firstBody.availableUnits, 3_000_000);
    assert.equal(firstBody.payout.sandbox, true);

    const retry = await fetch(`${baseUrl}/payouts`, { method: "POST", headers, body: requestBody });
    assert.equal(retry.status, 200);
    const retryBody = await retry.json();
    assert.equal(retryBody.created, false);
    assert.equal(retryBody.payout.id, firstBody.payout.id);
    assert.equal(retryBody.availableUnits, 3_000_000);

    const tooLarge = await fetch(`${baseUrl}/payouts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amountUnits: 4_000_000, destination: "sandbox-wallet-001", idempotencyKey: "payout-key-0002" }),
    });
    assert.equal(tooLarge.status, 409);

    timestamp += 1_000;
    const rejected = await fetch(`${baseUrl}/admin/payouts/${firstBody.payout.id}`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ status: "rejected", reference: "sandbox rejection" }),
    });
    assert.equal(rejected.status, 200);
    const account = await fetch(`${baseUrl}/account`, { headers });
    assert.equal(account.status, 200);
    assert.equal((await account.json()).availableUnits, 5_000_000);
  } finally {
    await close(server);
  }
});

test("dormant sandbox balance stays a client liability and restores on licensed return", async () => {
  let timestamp = Date.parse("2026-09-01T12:00:00.000Z");
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const { server, baseUrl } = await runServer(licensedOptions({
    now: () => timestamp,
    dormantAfterMs: sevenDays,
  }));
  try {
    const { headers } = await activateAndRegister(baseUrl);
    const adminHeaders = { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" };
    await fetch(`${baseUrl}/admin/credits`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ workerId: "node-001", amountUnits: 3_000_000 }),
    });

    timestamp += eightDays();
    const sweep = await fetch(`${baseUrl}/admin/dormancy/sweep`, {
      method: "POST",
      headers: adminHeaders,
      body: "{}",
    });
    assert.equal(sweep.status, 200);
    assert.deepEqual(await sweep.json(), {
      ok: true,
      accountsMarked: 1,
      movedUnits: 3_000_000,
      asset: "USDT_TEST",
      reserveType: "client-liability",
      companyRevenue: false,
    });

    const dormancy = await fetch(`${baseUrl}/admin/dormancy`, { headers: adminHeaders });
    const dormantBody = await dormancy.json();
    assert.equal(dormantBody.dormantAccounts, 1);
    assert.equal(dormantBody.reservedUnits, 3_000_000);
    assert.equal(dormantBody.companyRevenue, false);

    const account = await fetch(`${baseUrl}/account`, { headers });
    assert.equal(account.status, 200);
    const accountBody = await account.json();
    assert.equal(accountBody.availableUnits, 3_000_000);
    assert.equal(accountBody.restoredFromDormantUnits, 3_000_000);
  } finally {
    await close(server);
  }
});

function eightDays() {
  return 8 * 24 * 60 * 60 * 1000;
}

test("Qonversion entitlement is exchanged for a short device-bound session", async () => {
  const calls = [];
  const qonversionFetch = async (url, options) => {
    calls.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).includes("/identities/")) {
      return new Response(JSON.stringify({
        object: "identity",
        id: "node-qonversion12345",
        user_id: "QON_testuser12345678",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      object: "list",
      data: [{
        object: "user_entitlement",
        id: "pro",
        is_active: true,
        product: { product_id: "marsx_pro_monthly" },
      }],
      has_more: false,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { server, baseUrl } = await runServer({
    token: "admin-token",
    store: new MemoryStore(),
    licenseSessionSecret: LICENSE_SESSION_SECRET,
    qonversionSecretKey: "test_sk_1234567890",
    qonversionEntitlementIds: ["pro", "farm"],
    qonversionFetch,
  });
  try {
    const exchange = await fetch(`${baseUrl}/billing/qonversion/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity_id: "node-qonversion12345",
        install_id: "node-qonversion12345",
        terms_accepted: true,
        terms_version: "2026-09-26-v2",
        app_version: "0.6-beta",
      }),
    });
    assert.equal(exchange.status, 200);
    const body = await exchange.json();
    assert.equal(body.provider, "qonversion");
    assert.equal(body.entitlement_id, "pro");
    assert.ok(body.session_token);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].authorization, "Bearer test_sk_1234567890");

    const status = await fetch(`${baseUrl}/license/status`, {
      headers: {
        Authorization: `License ${body.session_token}`,
        "X-Install-Id": "node-qonversion12345",
      },
    });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).provider, "qonversion");

    const wrongDevice = await fetch(`${baseUrl}/license/status`, {
      headers: {
        Authorization: `License ${body.session_token}`,
        "X-Install-Id": "node-otherdevice12345",
      },
    });
    assert.equal(wrongDevice.status, 401);
  } finally {
    await close(server);
  }
});

test("Qonversion session is denied without an active configured entitlement", async () => {
  const qonversionFetch = async (url) => new Response(JSON.stringify(
    String(url).includes("/identities/")
      ? { object: "identity", id: "node-qonversion12345", user_id: "QON_testuser12345678" }
      : { object: "list", data: [{ id: "pro", is_active: false }], has_more: false }
  ), { status: 200, headers: { "Content-Type": "application/json" } });
  const { server, baseUrl } = await runServer({
    store: new MemoryStore(),
    licenseSessionSecret: LICENSE_SESSION_SECRET,
    qonversionSecretKey: "test_sk_1234567890",
    qonversionFetch,
  });
  try {
    const response = await fetch(`${baseUrl}/billing/qonversion/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity_id: "node-qonversion12345",
        install_id: "node-qonversion12345",
        terms_accepted: true,
        terms_version: "2026-09-26-v2",
      }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "qonversion_entitlement_inactive");
  } finally {
    await close(server);
  }
});
