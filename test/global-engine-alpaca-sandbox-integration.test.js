import test from "node:test";
import assert from "node:assert/strict";
import { AlpacaBrokerSandboxAdapter, alpacaAccountState } from "../global-engine/adapters/alpaca-broker-sandbox.js";
import { AlpacaSandboxEventProcessor } from "../global-engine/alpaca-sandbox-events.js";
import { certifyAlpacaSandbox } from "../global-engine/alpaca-sandbox-certification.js";
import { BrokerLedger, BrokerOrderStore, BrokerReconciler } from "../global-engine/broker-core.js";

// All credentials, accounts, events and responses here are local test fixtures. No provider requests.
const BASIC = { region: "us", authMode: "basic", apiKey: "fixture-key", apiSecret: "fixture-secret" };
const json = (value, status = 200) => Response.json(value, { status });
const sse = text => new Response(text, { headers: { "content-type": "text/event-stream" } });
const consume = async generator => { const events = []; for await (const event of generator) events.push(event); return events; };
const fill = (cumulative, eventId, executionId, event = "partial_fill", quantity = .5) => ({
  account_id: "fixture-account", event_id: eventId, execution_id: executionId, event, qty: String(quantity), price: "100",
  order: { id: "fixture-order", symbol: "AAPL", side: "buy", filled_qty: String(cumulative) }
});
const tracked = () => {
  const orders = new BrokerOrderStore(), ledger = new BrokerLedger();
  const processor = new AlpacaSandboxEventProcessor({ orders, ledger });
  const order = orders.create({ accountId: "fixture-account", idempotencyKey: "fixture-client", symbol: "AAPL", side: "BUY", quantity: 1 });
  processor.track(order, "fixture-order"); return { orders, ledger, processor, order };
};

test("US Basic auth goes directly to Broker Sandbox and never to the EU token endpoint", async () => {
  const calls = [];
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async (url, options) => { calls.push({ url, options }); return json({ id: "fixture-account" }); } });
  await adapter.getAccount("fixture-account");
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://broker-api.sandbox.alpaca.markets/v1/accounts/fixture-account");
  assert.equal(calls[0].options.headers.Authorization, "Basic " + Buffer.from("fixture-key:fixture-secret").toString("base64"));
  assert.equal(calls[0].options.redirect, "error"); assert.ok(calls[0].options.signal);
  assert.equal(JSON.stringify(adapter).includes("fixture-secret"), false);
  assert.deepEqual(adapter.status(), { region: "us", authMode: "basic", configured: true, sandboxOrders: false, liveExecution: false, custody: false, withdrawals: false });
});

for (const region of ["us", "eu"]) test(`${region} OAuth token is cached, shared concurrently and refreshed on expiry`, async () => {
  let now = 0, authCalls = 0; const calls = [];
  const adapter = new AlpacaBrokerSandboxAdapter({ region, authMode: "oauth", clientId: "fixture-client", clientSecret: "fixture-client-secret", clock: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("authx.")) { authCalls++; assert.equal(options.body.get("grant_type"), "client_credentials"); return json({ access_token: "fixture-token", token_type: "Bearer", expires_in: 899 }); }
      assert.equal(options.headers.Authorization, "Bearer fixture-token"); return json({ id: "fixture-account" });
    }
  });
  await Promise.all([adapter.getAccount("fixture-account"), adapter.getPositions("fixture-account"), adapter.getTradingAccount("fixture-account")]);
  assert.equal(authCalls, 1);
  await adapter.getAccount("fixture-account"); assert.equal(authCalls, 1);
  now = 900000; await adapter.getAccount("fixture-account"); assert.equal(authCalls, 2);
  assert.ok(calls.every(call => call.url.includes(region === "eu" ? ".sandbox.eu.alpaca.markets" : ".sandbox.alpaca.markets")));
  assert.ok(calls.every(call => call.options.redirect === "error"));
});

test("production, lookalike and mismatched region hosts are rejected before any network call", () => {
  for (const baseUrl of ["https://broker-api.alpaca.markets", "https://broker-api.sandbox.alpaca.markets.evil.test", "http://broker-api.sandbox.alpaca.markets", "https://broker-api.sandbox.eu.alpaca.markets", "https://broker-api.sandbox.alpaca.markets/v1", "https://broker-api.sandbox.alpaca.markets?live=true"]) {
    assert.throws(() => new AlpacaBrokerSandboxAdapter({ ...BASIC, baseUrl }), /official sandbox host/);
  }
  assert.throws(() => new AlpacaBrokerSandboxAdapter({ region: "us", authMode: "oauth", authUrl: "https://authx.alpaca.markets" }), /official sandbox host/);
  assert.throws(() => new AlpacaBrokerSandboxAdapter({ ...BASIC, region: "eu" }), /requires OAuth/);
  assert.throws(() => new AlpacaBrokerSandboxAdapter({ ...BASIC, region: "constructor" }), /Invalid/);
  const adapter = new AlpacaBrokerSandboxAdapter(BASIC);
  assert.throws(() => { adapter.baseUrl = "https://broker-api.alpaca.markets"; }, TypeError);
  assert.throws(() => { adapter.region = "eu"; }, TypeError);
});

test("direct requests cannot bypass order gates or enable funding/custody/withdrawals", async () => {
  let calls = 0;
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async () => { calls++; return json({}); } });
  await assert.rejects(() => adapter.request("/v1/trading/accounts/a/orders", { method: "POST", body: {} }), /submission disabled/);
  await assert.rejects(() => adapter.cancelOrder("a", "o"), /submission disabled/);
  for (const path of ["/v1/accounts/a/transfers", "/v1/journals", "/v1/testing/incoming_wires", "/v1/custody", "/v1/accounts/a/withdrawals"]) await assert.rejects(() => adapter.request(path, { method: "POST", body: {} }), /operation disabled/);
  await assert.rejects(() => adapter.request("https://broker-api.alpaca.markets/v1/accounts"), /Invalid.*path/);
  assert.throws(() => adapter.getAccount("a/../../orders"), /invalid/);
  await assert.rejects(() => adapter.placeOrder(), /live execution disabled/);
  assert.equal(calls, 0);
});

test("individual Sandbox order cancellation accepts HTTP 204 and bulk cancellation remains disabled", async () => {
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, allowOrders: true, fetchImpl: async (_, options) => { assert.equal(options.method, "DELETE"); return new Response(null, { status: 204 }); } });
  assert.equal(await adapter.cancelOrder("a", "o"), null);
  await assert.rejects(() => adapter.request("/v1/trading/accounts/a/orders", { method: "DELETE" }), /Unsupported order mutation/);
});

test("malformed OAuth responses cannot send an undefined bearer token", async () => {
  for (const token of [{}, { access_token: "fixture", expires_in: 10, token_type: "unexpected" }, { access_token: "fixture", expires_in: -1, token_type: "Bearer" }]) {
    let calls = 0;
    const adapter = new AlpacaBrokerSandboxAdapter({ clientId: "fixture", clientSecret: "fixture", fetchImpl: async () => { calls++; return json(token); } });
    await assert.rejects(() => adapter.getAccount("a"), /Invalid.*auth response/); assert.equal(calls, 1);
  }
});

test("provider errors do not expose provider response bodies or credentials", async () => {
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async () => new Response("fixture-sensitive-error-body", { status: 401 }) });
  await assert.rejects(() => adapter.getAccount("a"), error => error.message === "Alpaca Broker HTTP 401");
});

test("SSE handles comments, CRLF, chunk boundaries and cancels after the bounded event count", async () => {
  const encoder = new TextEncoder(), text = ': heartbeat\r\n\r\nid: fixture-id\r\ndata: {"event_id":"fixture-id","label":"ş"}\r\n\r\ndata: {"event_id":"second"}\r\n\r\n';
  const bytes = encoder.encode(text); let cancelled = false, offset = 0;
  const body = new ReadableStream({ pull(controller) { if (offset < bytes.length) { controller.enqueue(bytes.slice(offset, offset + 3)); offset += 3; } else controller.close(); }, cancel() { cancelled = true; } });
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async (url, options) => {
    assert.ok(url.includes("/v2/events/trades?since=2026-10-06")); assert.equal(options.headers.Accept, "text/event-stream");
    return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8" } });
  } });
  assert.deepEqual(await consume(adapter.events("trades", { since: "2026-10-06", maxEvents: 1 })), [{ event_id: "fixture-id", label: "ş" }]);
  assert.equal(cancelled, true);
});

test("SSE rejects malformed events, truncated frames and provider-reported data loss", async () => {
  for (const [text, expected] of [["data: broken\n\n", /Invalid.*SSE event/], ['data: {"a":1}', /Truncated/], [": you are reading too slowly, dropped 10 messages\n\n", /replay/], [": internal server error\n\n", /replay/]]) {
    const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async () => sse(text) });
    await assert.rejects(() => consume(adapter.events("trades")), expected);
  }
});

test("SSE invalid replay ranges fail before authentication or network calls", async () => {
  let calls = 0; const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, fetchImpl: async () => { calls++; return sse(""); } });
  await assert.rejects(() => consume(adapter.events("trades", { until: "2026-10-06" })), /since/);
  await assert.rejects(() => consume(adapter.events("trades", { since: "2026-10-07", until: "2026-10-06" })), /range/);
  assert.equal(calls, 0);
});

test("KYC state mapping preserves rejection and fails closed on unknown provider states", () => {
  assert.equal(alpacaAccountState("SUBMITTED"), "KYC_PENDING"); assert.equal(alpacaAccountState("ACTION_REQUIRED"), "KYC_PENDING");
  assert.equal(alpacaAccountState("APPROVED", "us"), "KYC_PENDING"); assert.equal(alpacaAccountState("APPROVED", "eu"), "ACTIVE");
  assert.equal(alpacaAccountState("REJECTED"), "REJECTED"); assert.equal(alpacaAccountState("new-unknown-state"), "UNKNOWN");
});

test("internal event callback: partial fill, fill, duplicate and out-of-order replay create only confirmed ledger entries", () => {
  const { processor, ledger, order } = tracked(); const first = fill(.5, "e1", "x1"), final = fill(1, "e2", "x2", "fill");
  processor.ingest(first); assert.equal(order.state, "PARTIALLY_FILLED");
  processor.ingest(final); assert.equal(order.state, "FILLED"); assert.equal(order.filledQuantity, 1);
  assert.deepEqual(processor.ingest(final), { duplicate: true });
  assert.equal(processor.ingest({ ...first, event_id: "old-replayed" }).reason, "STALE_FILL");
  assert.equal(ledger.list("fixture-account").length, 2); assert.equal(processor.cashDelta, -100); assert.equal(processor.positionDelta.AAPL, 1);
  assert.equal(processor.ingest({ ...final, account_id: "other-account" }).reason, "UNTRACKED_ORDER");
});

test("missing partial fill, corrections and order identity mismatch never silently credit a ledger", () => {
  const { processor, ledger } = tracked();
  assert.throws(() => processor.ingest(fill(1, "e2", "x2", "fill")), /fill gap/); assert.equal(ledger.entries.length, 0); assert.equal(processor.requiresReview, true);
  const fresh = tracked(); assert.equal(fresh.processor.ingest({ ...fill(.5, "e1", "x1"), event: "trade_correct" }).requiresReview, true);
  assert.equal(fresh.ledger.entries.length, 0);
  assert.throws(() => fresh.processor.ingest({ ...fill(.5, "e1", "x1"), order: { ...fill(.5, "e1", "x1").order, symbol: "SPY" } }), /identity mismatch/);
});

test("cancel/reject events close orders without inventing fills or balances", () => {
  for (const [event, state] of [["canceled", "CANCELLED"], ["rejected", "REJECTED"], ["expired", "EXPIRED"]]) {
    const { processor, ledger, order } = tracked(); processor.ingest({ ...fill(0, "terminal", "unused"), event });
    assert.equal(order.state, state); assert.equal(ledger.entries.length, 0); assert.equal(processor.cashDelta, 0);
  }
});

test("reconciliation rejects invalid numeric values and detects small fractional-position mismatches", () => {
  const reconciler = new BrokerReconciler();
  for (const value of [NaN, Infinity, null, undefined, "", " ", false]) assert.throws(() => reconciler.compare({ internalCash: value, providerCash: 100 }), /invalid reconciliation/);
  assert.throws(() => reconciler.compare({ internalCash: 100, providerCash: 100, providerPositions: { AAPL: NaN } }), /position quantity/);
  const result = reconciler.compare({ internalCash: 100, providerCash: 100, internalPositions: { AAPL: 1 }, providerPositions: { AAPL: 1.001 } });
  assert.equal(result.ok, false); assert.equal(result.autoCorrected, false);
});

function providerFixture({ outcome = "filled", drift = 0, cancelFailure = false } = {}) {
  const calls = []; let submitted = false;
  const providerOrder = () => ({ id: "fixture-order", symbol: "AAPL", side: "buy", qty: "1", filled_qty: outcome === "filled" ? "1" : "0", status: outcome });
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method });
    if (path === "/v1/accounts" && options.method === "GET") return json([]);
    if (path === "/v1/accounts" && options.method === "POST") return json({ id: "fixture-account", status: "SUBMITTED" });
    if (path === "/v1/accounts/fixture-account") return json({ id: "fixture-account", status: "ACTIVE" });
    if (path.endsWith("/account/portfolio/history")) return json({ equity: [1000], timestamp: [1] });
    if (path.endsWith("/account")) return json({ cash: String(1000 - (submitted && outcome === "filled" ? 100 : 0) + (submitted ? drift : 0)), currency: "USD" });
    if (path.endsWith("/positions")) return json(submitted && outcome === "filled" ? [{ symbol: "AAPL", qty: "1" }] : []);
    if (path.endsWith("/orders") && options.method === "POST") { submitted = true; return json(providerOrder()); }
    if (path.endsWith("/orders/fixture-order") && options.method === "DELETE") {
      if (cancelFailure) return new Response(null, { status: 503 });
      outcome = "canceled"; return new Response(null, { status: 204 });
    }
    if (path.endsWith("/orders/fixture-order")) return json(providerOrder());
    if (path === "/v2/events/trades") {
      const frames = outcome === "filled" ? [fill(.5, "e1", "x1"), fill(1, "e2", "x2", "fill"), fill(1, "e2", "x2", "fill")] : [{ ...fill(0, "cancel-event", "unused"), event: outcome }];
      return sse(frames.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""));
    }
    throw new Error("Unsupported local provider fixture route");
  };
  const adapter = new AlpacaBrokerSandboxAdapter({ ...BASIC, allowOrders: true, fetchImpl });
  const fixture = { synthetic: true, payload: { contact: { email_address: "marsx-sandbox@example.test" }, identity: { given_name: "Fixture" } }, order: { symbol: "AAPL", side: "buy", qty: "1", type: "limit", limit_price: "100", time_in_force: "day" } };
  return { calls, adapter, fixture };
}

test("certification with no credentials is BLOCKED, makes zero requests and never reports success", async () => {
  let calls = 0;
  const adapter = new AlpacaBrokerSandboxAdapter({ authMode: "basic", apiKey: "", apiSecret: "", fetchImpl: async () => { calls++; return json([]); } });
  const result = await certifyAlpacaSandbox({ adapter });
  assert.equal(result.certified, false); assert.equal(result.phases.authentication.reason, "CREDENTIALS_NOT_CONFIGURED"); assert.equal(calls, 0);
});

test("default certification remains read-only and will not create accounts or orders", async () => {
  const { adapter, calls } = providerFixture();
  const result = await certifyAlpacaSandbox({ adapter, accountId: "fixture-account" });
  assert.equal(result.certified, false); assert.equal(result.phases.order_lifecycle.status, "BLOCKED");
  assert.ok(calls.every(call => call.method === "GET"));
  assert.equal(result.phases.kyc_lifecycle.reason, "ACTIVE_SNAPSHOT_ONLY_NO_KYC_TRANSITION_OBSERVED");
});

test("LOCAL CONTRACT E2E: Basic auth -> account -> KYC -> portfolio -> order -> SSE callback -> ledger -> reconciliation", async () => {
  const { adapter, fixture } = providerFixture();
  const result = await certifyAlpacaSandbox({ adapter, fixture, allowWrites: true, pause: async () => {} });
  assert.equal(result.certified, true); assert.equal(result.simulatedFills, 2);
  assert.ok(Object.values(result.phases).every(phase => phase.status === "PASS"));
  assert.equal(result.liveExecution, false); assert.equal(result.custody, false); assert.equal(result.withdrawals, false);
  assert.equal(JSON.stringify(result).includes("fixture-secret"), false); assert.equal(JSON.stringify(result).includes("example.test"), false);
});

test("LOCAL CONTRACT E2E never certifies a cash mismatch or treats a cancel as a ledger fill", async () => {
  const drifted = providerFixture({ drift: 1 });
  const mismatch = await certifyAlpacaSandbox({ ...drifted, allowWrites: true, pause: async () => {} });
  assert.equal(mismatch.certified, false); assert.equal(mismatch.phases.reconciliation.reason, "PROVIDER_LEDGER_MISMATCH_NO_AUTO_CORRECTION");
  const cancelled = providerFixture({ outcome: "canceled" });
  const result = await certifyAlpacaSandbox({ ...cancelled, allowWrites: true, pause: async () => {} });
  assert.equal(result.certified, false); assert.equal(result.simulatedFills, 0); assert.equal(result.phases.ledger.status, "NOT_RUN");
});

test("queued Sandbox orders are cancelled only by their own account/order ID", async () => {
  const fixture = providerFixture({ outcome: "new" });
  const result = await certifyAlpacaSandbox({ ...fixture, allowWrites: true, pollAttempts: 1, pause: async () => {} });
  assert.equal(result.orderOutcome, "canceled"); assert.equal(result.certified, false); assert.equal(result.simulatedFills, 0);
  const mutations = fixture.calls.filter(call => call.method === "DELETE");
  assert.deepEqual(mutations, [{ path: "/v1/trading/accounts/fixture-account/orders/fixture-order", method: "DELETE" }]);
});

test("unconfirmed cancellation or cleanup cannot return a successful certification", async () => {
  const fixture = providerFixture({ outcome: "new", cancelFailure: true });
  const result = await certifyAlpacaSandbox({ ...fixture, allowWrites: true, pollAttempts: 1, pause: async () => {} });
  assert.equal(result.certified, false); assert.equal(result.phases.order_lifecycle.status, "FAIL");
  assert.equal(result.cleanup, "ORDER_CLEANUP_UNCONFIRMED_REVIEW_REQUIRED");
});
