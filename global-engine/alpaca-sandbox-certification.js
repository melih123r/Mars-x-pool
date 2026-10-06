import { AlpacaBrokerSandboxAdapter, alpacaAccountState } from "./adapters/alpaca-broker-sandbox.js";
import { AlpacaSandboxEventProcessor } from "./alpaca-sandbox-events.js";
import { BrokerLedger, BrokerOrderStore, BrokerReconciler } from "./broker-core.js";

const PHASES = ["authentication", "sandbox_account", "kyc_lifecycle", "portfolio_positions", "order_lifecycle", "webhook_bridge", "ledger", "reconciliation"];
const TERMINAL = new Set(["filled", "canceled", "rejected", "expired"]);
const number = value => {
  if (!["string", "number"].includes(typeof value) || String(value).trim() === "" || !Number.isFinite(Number(value))) throw new Error("Invalid provider numeric value");
  return Number(value);
};
const positionsMap = rows => {
  if (!Array.isArray(rows)) throw new Error("Invalid provider positions");
  const result = {};
  for (const row of rows) {
    if (typeof row.symbol !== "string" || !/^[A-Z0-9._-]+$/.test(row.symbol) || Object.hasOwn(result, row.symbol)) throw new Error("Invalid provider position symbol");
    result[row.symbol] = number(row.qty);
  }
  return result;
};
const reason = error => {
  const http = /^Alpaca Broker (?:auth )?HTTP (\d{3})$/.exec(String(error?.message));
  return http ? `PROVIDER_HTTP_${http[1]}` : "SANDBOX_VALIDATION_OR_REQUEST_FAILED";
};

// Returns a redacted report. No credentials, customer identity, payloads or raw events are included.
// With no credentials it performs zero requests. Writes require both explicit flags and a synthetic fixture.
export async function certifyAlpacaSandbox({
  adapter = new AlpacaBrokerSandboxAdapter(), accountId,
  fixture, allowWrites = false, pollAttempts = 8,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  const report = { mode: "SANDBOX_ONLY", certified: false, liveExecution: false, custody: false, withdrawals: false,
    phases: Object.fromEntries(PHASES.map(name => [name, { status: "NOT_RUN" }])), simulatedFills: 0 };
  const mark = (phase, status, code) => { report.phases[phase] = { status, ...(code ? { reason: code } : {}) }; };
  if (!adapter.configured()) { mark("authentication", "BLOCKED", "CREDENTIALS_NOT_CONFIGURED"); return report; }
  if (!Number.isInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 20) throw new Error("Invalid Sandbox poll limit");
  let phase = "authentication", providerOrderId, ownAccountId = accountId;
  let creationStatus = null;
  try {
    const accounts = await adapter.listAccounts();
    if (!Array.isArray(accounts)) throw new Error("Invalid provider accounts");
    mark(phase, "PASS"); phase = "sandbox_account";
    if (!ownAccountId) {
      if (allowWrites !== true || fixture?.synthetic !== true || !fixture.payload) {
        mark(phase, "BLOCKED", "EXPLICIT_SANDBOX_ACCOUNT_OR_SYNTHETIC_FIXTURE_REQUIRED"); return report;
      }
      if (!/^[^@]+@example\.(com|test)$/.test(fixture.payload.contact?.email_address || "")) throw new Error("Synthetic fixture must use an example email domain");
      const created = await adapter.createAccount(fixture.payload);
      ownAccountId = created.id; creationStatus = alpacaAccountState(created.status, adapter.region);
    }
    let account = await adapter.getAccount(ownAccountId);
    if (account.id !== ownAccountId) throw new Error("Provider account mismatch");
    mark(phase, "PASS"); phase = "kyc_lifecycle";
    if (fixture?.cip) {
      if (allowWrites !== true || fixture.synthetic !== true) throw new Error("Synthetic KYC writes require explicit consent");
      await adapter.submitCip(ownAccountId, fixture.cip);
    }
    for (let i = 0; i < pollAttempts && alpacaAccountState(account.status, adapter.region) === "KYC_PENDING"; i++) {
      await pause(250); account = await adapter.getAccount(ownAccountId);
      if (account.id !== ownAccountId) throw new Error("Provider account mismatch");
    }
    if (alpacaAccountState(account.status, adapter.region) !== "ACTIVE") {
      mark(phase, "BLOCKED", "TEST_ACCOUNT_NOT_ACTIVE"); return report;
    }
    mark(phase, creationStatus === "KYC_PENDING" ? "PASS" : "NOT_RUN", creationStatus === "KYC_PENDING" ? undefined : "ACTIVE_SNAPSHOT_ONLY_NO_KYC_TRANSITION_OBSERVED");
    phase = "portfolio_positions";
    const [before, initialPositions, history] = await Promise.all([
      adapter.getTradingAccount(ownAccountId), adapter.getPositions(ownAccountId),
      adapter.getPortfolioHistory(ownAccountId, { period: "1D", timeframe: "1Min" })
    ]);
    const cashBefore = number(before.cash), positionsBefore = positionsMap(initialPositions);
    if (!history || !Array.isArray(history.equity) || !Array.isArray(history.timestamp)) throw new Error("Invalid provider portfolio history");
    const currency = before.currency;
    if (!["USD", "EUR"].includes(currency)) throw new Error("Unsupported Sandbox account currency");
    mark(phase, "PASS"); phase = "order_lifecycle";
    if (allowWrites !== true || !adapter.allowOrders || fixture?.synthetic !== true || !fixture.order) {
      mark(phase, "BLOCKED", "SYNTHETIC_ORDER_AND_BOTH_SANDBOX_WRITE_GATES_REQUIRED"); return report;
    }
    // At most one share of a supported stock/ETF in a clearly identified synthetic Sandbox run.
    const payload = { ...fixture.order, client_order_id: `marsx-sandbox-e2e-${crypto.randomUUID()}` };
    if (!["AAPL", "SPY"].includes(payload.symbol) || payload.side !== "buy" || !["market", "limit"].includes(payload.type) || payload.time_in_force !== "day" || payload.notional !== undefined || number(payload.qty) <= 0 || number(payload.qty) > 1) throw new Error("Invalid synthetic Sandbox order scope");
    if (payload.type === "limit" && (number(payload.limit_price) <= 0 || number(payload.limit_price) > 10000)) throw new Error("Invalid synthetic Sandbox limit price");
    if (payload.order_class || payload.take_profit || payload.stop_loss || payload.extended_hours) throw new Error("Unsupported synthetic order configuration");
    const started = new Date().toISOString();
    const providerOrder = await adapter.createOrder(ownAccountId, payload);
    providerOrderId = providerOrder.id;
    if (!providerOrderId || providerOrder.symbol !== payload.symbol || providerOrder.side !== "buy") throw new Error("Invalid provider order response");
    const orders = new BrokerOrderStore(), ledger = new BrokerLedger();
    const local = orders.create({ accountId: ownAccountId, idempotencyKey: payload.client_order_id, symbol: payload.symbol, side: "BUY", type: payload.type.toUpperCase(), quantity: number(payload.qty) });
    const processor = new AlpacaSandboxEventProcessor({ orders, ledger, currency });
    processor.track(local, providerOrderId);
    let latest = providerOrder;
    for (let i = 0; i < pollAttempts && !TERMINAL.has(latest.status); i++) {
      await pause(250); latest = await adapter.getOrder(ownAccountId, providerOrderId);
      if (latest.id !== providerOrderId) throw new Error("Provider order mismatch");
    }
    if (!TERMINAL.has(latest.status)) {
      await adapter.cancelOrder(ownAccountId, providerOrderId);
      for (let i = 0; i < pollAttempts && !TERMINAL.has(latest.status); i++) {
        await pause(250); latest = await adapter.getOrder(ownAccountId, providerOrderId);
        if (latest.id !== providerOrderId) throw new Error("Provider order mismatch");
      }
    }
    if (!TERMINAL.has(latest.status)) { mark(phase, "BLOCKED", "ORDER_TERMINAL_STATE_UNCONFIRMED"); return report; }
    report.orderOutcome = latest.status;
    mark(phase, "PASS"); phase = "webhook_bridge";
    let received = 0, matching = 0, lastMatch;
    for await (const event of adapter.events("trades", { since: started, until: new Date().toISOString(), maxEvents: 1000 })) {
      received++;
      if (event.account_id === ownAccountId && event.order?.id === providerOrderId) {
        processor.ingest(event); matching++; lastMatch = event;
      }
    }
    if (received >= 1000 || !matching || processor.requiresReview) { mark(phase, "BLOCKED", "COMPLETE_PROVIDER_EVENT_REPLAY_REQUIRED"); return report; }
    if (!processor.ingest(lastMatch).duplicate) throw new Error("Provider event replay was not idempotent");
    if (local.state !== { filled: "FILLED", canceled: "CANCELLED", rejected: "REJECTED", expired: "EXPIRED" }[latest.status]) throw new Error("Provider events and order snapshot disagree");
    mark(phase, "PASS"); report.eventTransport = "AUTHENTICATED_SSE_TO_INTERNAL_CALLBACK";
    phase = "ledger";
    report.simulatedFills = ledger.list(ownAccountId).length;
    mark(phase, report.simulatedFills ? "PASS" : "NOT_RUN", report.simulatedFills ? undefined : "NO_PROVIDER_CONFIRMED_FILL_NO_TRADE_LEDGER_ENTRY_CREATED");
    phase = "reconciliation";
    const [after, finalPositions] = await Promise.all([adapter.getTradingAccount(ownAccountId), adapter.getPositions(ownAccountId)]);
    if (after.currency !== currency) throw new Error("Sandbox currency changed during certification");
    const expectedPositions = { ...positionsBefore };
    for (const [symbol, quantity] of Object.entries(processor.positionDelta)) expectedPositions[symbol] = (expectedPositions[symbol] || 0) + quantity;
    const comparison = new BrokerReconciler().compare({ internalCash: cashBefore + processor.cashDelta, providerCash: number(after.cash), internalPositions: expectedPositions, providerPositions: positionsMap(finalPositions) });
    mark(phase, comparison.ok ? "PASS" : "FAIL", comparison.ok ? undefined : "PROVIDER_LEDGER_MISMATCH_NO_AUTO_CORRECTION");
    report.certified = PHASES.every(name => report.phases[name].status === "PASS");
  } catch (error) { mark(phase, "FAIL", reason(error)); }
  finally {
    if (providerOrderId) {
      try {
        const last = await adapter.getOrder(ownAccountId, providerOrderId);
        if (last.id !== providerOrderId) throw new Error("Provider order mismatch");
        if (!TERMINAL.has(last.status)) {
          await adapter.cancelOrder(ownAccountId, providerOrderId);
          const confirmed = await adapter.getOrder(ownAccountId, providerOrderId);
          if (confirmed.id !== providerOrderId || !TERMINAL.has(confirmed.status)) report.cleanup = "CANCELLATION_UNCONFIRMED_REVIEW_REQUIRED";
        }
      } catch { report.cleanup = "ORDER_CLEANUP_UNCONFIRMED_REVIEW_REQUIRED"; }
      if (report.cleanup) report.certified = false;
    }
  }
  return report;
}
