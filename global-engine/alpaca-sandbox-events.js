// Internal-only: consume events from the adapter's authenticated SSE stream.
// This module is not an unauthenticated public webhook receiver or a user balance store.
export class AlpacaSandboxEventProcessor {
  constructor({ orders, ledger, currency = "USD" }) {
    if (!orders || !ledger || !["USD", "EUR"].includes(currency)) throw new Error("Invalid Sandbox event processor configuration");
    this.orders = orders; this.ledger = ledger; this.currency = currency;
    this.tracked = new Map(); this.seen = new Set(); this.executions = new Set();
    this.cashDelta = 0; this.positionDelta = {}; this.requiresReview = false;
  }
  track(order, providerOrderId) {
    if (!order || !providerOrderId || order.state !== "NEW") throw new Error("Invalid tracked Sandbox order");
    const key = `${order.accountId}:${providerOrderId}`;
    if (this.tracked.has(key)) throw new Error("Sandbox provider order already tracked");
    this.orders.transition(order.id, "PENDING_SUBMIT");
    this.orders.transition(order.id, "SUBMITTED", { providerOrderId });
    this.tracked.set(key, order.id);
  }
  ingest(event) {
    const providerOrder = event?.order, key = `${event?.account_id}:${providerOrder?.id}`;
    const localId = this.tracked.get(key);
    if (!localId) return { ignored: true, reason: "UNTRACKED_ORDER" };
    if (typeof event.event_id !== "string" || !event.event_id) throw new Error("Sandbox SSE event_id required");
    const eventKey = `${event.account_id}:${event.event_id}`;
    if (this.seen.has(eventKey)) return { duplicate: true };
    const order = this.orders.orders.get(localId);
    if (["trade_bust", "trade_correct", "restated", "replaced", "order_cancel_rejected"].includes(event.event)) {
      this.requiresReview = true; return { requiresReview: true, reason: "PROVIDER_REVIEW_REQUIRED" };
    }
    if (providerOrder.symbol !== order.symbol || providerOrder.side !== order.side.toLowerCase()) throw new Error("Sandbox provider order identity mismatch");
    if (["fill", "partial_fill"].includes(event.event)) {
      const cumulative = Number(providerOrder.filled_qty), quantity = Number(event.qty), price = Number(event.price);
      const epsilon = 1e-9;
      if (!Number.isFinite(cumulative) || cumulative < 0 || cumulative > order.quantity + epsilon) throw new Error("Invalid Sandbox cumulative fill");
      if (cumulative <= order.filledQuantity + epsilon) { this.seen.add(eventKey); return { ignored: true, reason: "STALE_FILL" }; }
      const delta = cumulative - order.filledQuantity;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0 || Math.abs(delta - quantity) > epsilon) {
        this.requiresReview = true; throw new Error("Sandbox fill gap or invalid execution; replay required");
      }
      if ((event.event === "fill") !== (Math.abs(cumulative - order.quantity) <= epsilon)) throw new Error("Sandbox fill event and cumulative quantity disagree");
      if (!["SUBMITTED", "PARTIALLY_FILLED", "CANCEL_PENDING"].includes(order.state)) {
        this.requiresReview = true; throw new Error("Sandbox fill conflicts with terminal order state");
      }
      if (typeof event.execution_id !== "string" || !event.execution_id) throw new Error("Sandbox execution_id required");
      const executionKey = `${event.account_id}:${providerOrder.id}:${event.execution_id}`;
      if (this.executions.has(executionKey)) { this.requiresReview = true; throw new Error("Sandbox execution replay conflicts with cumulative fill"); }
      const amount = price * delta;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid Sandbox execution amount");
      this.ledger.post({ idempotencyKey: executionKey, accountId: order.accountId,
        debit: order.side === "BUY" ? "SECURITIES" : "CASH", credit: order.side === "BUY" ? "CASH" : "SECURITIES",
        amount, currency: this.currency, type: "SANDBOX_TRADE", reference: providerOrder.id });
      this.orders.transition(localId, event.event === "fill" ? "FILLED" : "PARTIALLY_FILLED", { filledQuantity: cumulative });
      const sign = order.side === "BUY" ? 1 : -1;
      this.cashDelta -= sign * amount;
      this.positionDelta[order.symbol] = (this.positionDelta[order.symbol] || 0) + sign * delta;
      this.executions.add(executionKey); this.seen.add(eventKey);
      return { accepted: true, fillQuantity: delta, state: order.state };
    }
    const next = { canceled: "CANCELLED", rejected: "REJECTED", expired: "EXPIRED", pending_cancel: "CANCEL_PENDING" }[event.event];
    if (next) {
      if (["FILLED", "CANCELLED", "REJECTED", "EXPIRED"].includes(order.state)) {
        this.seen.add(eventKey); return { ignored: true, reason: "TERMINAL_ORDER" };
      }
      if (next !== order.state) this.orders.transition(localId, next);
    } else if (!["new", "accepted", "pending_new"].includes(event.event)) {
      this.requiresReview = true; return { requiresReview: true, reason: "UNKNOWN_PROVIDER_EVENT" };
    }
    this.seen.add(eventKey); return { accepted: true, state: order.state };
  }
}
