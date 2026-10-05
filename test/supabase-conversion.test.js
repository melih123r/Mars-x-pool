import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../supabase/functions/marsx-pool-api/worker.js";
import { readOnlyConversion } from "../supabase/functions/marsx-pool-api/conversion.js";

const KEY = "test-changenow-key-never-forward";
const OPERATOR = "test-operator-token";
const ENV = { WORKER_TOKEN: OPERATOR, CHANGENOW_API_KEY: KEY };
const INPUT = { fromCurrency: "eth", fromNetwork: "eth", toCurrency: "sol", toNetwork: "sol", amount: "0.01" };

function mockProvider(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify({
      fromCurrency: "eth", fromNetwork: "eth", toCurrency: "sol", toNetwork: "sol",
      fromAmount: Number(new URL(url).searchParams.get("fromAmount")), toAmount: 0.216,
      depositFee: 0.00006, withdrawalFee: 0.000612, transactionSpeedForecast: "10-60",
      ...overrides,
    }), { status: 200 });
  };
  return { calls, fetchImpl };
}

function quote(options = {}) {
  return readOnlyConversion({ method: "POST", pathname: "/conversion/changenow-quote", env: ENV, data: INPUT, ...options });
}

function request(path, method = "GET", token, data = INPUT) {
  return new Request(`https://pool.example${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  });
}

test("Supabase conversion authorizes before using any provider credential", async () => {
  const provider = mockProvider();
  const app = createApp({ store: {}, fetchImpl: provider.fetchImpl });
  for (const token of [undefined, "incorrect-token"]) {
    const response = await app.fetch(request("/conversion/changenow-quote", "POST", token), ENV);
    assert.equal(response.status, 401);
  }
  assert.equal(provider.calls.length, 0);
  const response = await app.fetch(request("/conversion/changenow-quote", "POST", OPERATOR), ENV);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).executionEnabled, false);
  assert.equal(provider.calls.length, 1);
});

test("quote subtracts the disclosed 2% once and only requests a floating GET estimate", async () => {
  const provider = mockProvider();
  const response = await quote({ fetchImpl: provider.fetchImpl });
  assert.equal(response.status, 200);
  assert.equal(response.body.grossInput, "0.01");
  assert.equal(response.body.platformFeeInput, "0.0002");
  assert.equal(response.body.providerInput, "0.0098");
  assert.equal(response.body.platformFeeBps, 200);
  assert.equal(response.body.quote.toAmount, 0.216);
  assert.equal(response.body.fullRouteVerified, false);
  const [{ url, options }] = provider.calls;
  assert.equal(url.origin, "https://api.changenow.io");
  assert.equal(url.pathname, "/v2/exchange/estimated-amount");
  assert.equal(url.searchParams.get("fromAmount"), "0.0098");
  assert.equal(url.searchParams.get("flow"), "standard");
  assert.equal(options.method, "GET");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers["x-changenow-api-key"], KEY);
  assert.ok(!JSON.stringify(response.body).includes(KEY));
});

test("fee calculation preserves native precision without floating point", async () => {
  const provider = mockProvider();
  const response = await quote({ data: { ...INPUT, amount: "0.010000000000000001" }, fetchImpl: provider.fetchImpl });
  assert.equal(response.status, 200);
  assert.equal(response.body.platformFeeInput, "0.000200000000000001");
  assert.equal(response.body.providerInput, "0.0098");
});

test("invalid amounts and mismatched asset networks never contact providers", async () => {
  const provider = mockProvider();
  for (const data of [null, [], "input"]) {
    assert.equal((await quote({ data, fetchImpl: provider.fetchImpl })).status, 400);
  }
  for (const amount of ["0", "-1", "1e-3", "NaN", "Infinity", "01", "0.000000000000000001", "1.0000000000000000001", "1000000000000"]) {
    assert.equal((await quote({ data: { ...INPUT, amount }, fetchImpl: provider.fetchImpl })).status, 400);
  }
  for (const data of [{ fromNetwork: "sol" }, { toNetwork: "eth" }, { toCurrency: "usdt" }, { fromCurrency: "../../admin" }]) {
    assert.equal((await quote({ data: { ...INPUT, ...data }, fetchImpl: provider.fetchImpl })).status, 400);
  }
  assert.equal(provider.calls.length, 0);
});

test("missing credentials fail closed without contacting providers", async () => {
  const fetchImpl = () => { throw new Error("provider must not be called"); };
  assert.equal((await quote({ env: {}, fetchImpl })).body.error, "changenow_api_key_required");
  const verus = await readOnlyConversion({ method: "POST", pathname: "/conversion/verus-estimate", data: { amountVrsc: "1" }, env: ENV, fetchImpl });
  assert.equal(verus.status, 503);
  assert.equal(verus.body.error, "verus_scan_developer_key_required");
});

test("provider errors and timeouts are sanitized, including unsupported VRSC", async () => {
  for (const [providerStatus, expectedStatus] of [[400, 422], [401, 503], [403, 503], [429, 503], [500, 502]]) {
    const response = await quote({ fetchImpl: async () => new Response(JSON.stringify({ message: `Currency vrsc is not supported ${KEY}` }), { status: providerStatus }) });
    assert.equal(response.status, expectedStatus);
    assert.equal(response.body.providerStatus, providerStatus);
    assert.ok(!JSON.stringify(response.body).includes(KEY));
  }
  const timeout = await quote({ fetchImpl: async () => { throw new DOMException(KEY, "TimeoutError"); } });
  assert.equal(timeout.status, 504);
  assert.equal(timeout.body.error, "provider_timeout");
  assert.ok(!JSON.stringify(timeout.body).includes(KEY));
});

test("invalid or mismatched provider quotes never become usable estimates", async () => {
  for (const data of [{ toCurrency: "eth" }, { fromAmount: 100 }, { toAmount: -1 }, { toAmount: "Infinity" }]) {
    assert.equal((await quote({ fetchImpl: mockProvider(data).fetchImpl })).status, 502);
  }
  assert.equal((await quote({ fetchImpl: async () => new Response("not JSON") })).status, 502);
});

test("public currency list reports support without claiming API credential verification", async () => {
  const response = await readOnlyConversion({ method: "GET", pathname: "/conversion/changenow-status", env: ENV,
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.headers["x-changenow-api-key"], undefined);
      return Response.json([{ ticker: "eth", network: "eth" }, { ticker: "sol", network: "sol" }]);
    },
  });
  assert.deepEqual(response.body.supported, { eth: true, sol: true, vrsc: false });
  assert.equal(response.body.apiKeyConfigured, true);
  assert.equal(response.body.credentialVerifiedByThisRequest, false);
});

test("unlock flags and apparent credentials cannot enable execution or signer calls", async () => {
  const env = { ...ENV, VERUS_SCAN_API_KEY: "test-verus", VRSC_TREASURY_SIGNER_URL: "https://signer.example", REAL_WITHDRAWALS_ENABLED: "true", REAL_PAYOUTS_ENABLED: "true" };
  const app = createApp({ store: {}, fetchImpl: () => { throw new Error("no network or signer calls allowed"); } });
  const gate = await app.fetch(request("/conversion/execute", "POST"), env);
  assert.equal(gate.status, 503);
  const body = await gate.json();
  assert.equal(body.executionEnabled, false);
  assert.equal(body.withdrawable, false);
  assert.equal(body.credentials.treasurySignerVerified, false);
  const readiness = await app.fetch(request("/conversion/readiness"), env);
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json()).fullRouteVerified, false);
});

test("Supabase retains the live account deletion and privacy endpoints", async () => {
  const app = createApp({ store: {} });
  for (const path of ["/privacy", "/delete-account"]) {
    const response = await app.fetch(request(path), {});
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes("abdilmelih08@gmail.com"));
  }
});
