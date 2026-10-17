# Shared Loops notification adapter — MARS-X

A single server-side notification interface for Finance, Network, and Telegram. Import `createLoopsNotifier` from `loops-notifier.mjs`.

**Production disabled by default.** The connected Loops team has no published transactional templates and no verified sending domain as of 2026-10-17. Do not enable sends until both are configured and tested.

Configuration (server-side only): `LOOPS_API_KEY` secret, event-to-published-template ID mapping, `enabled` feature flag, per-user opt-in and preference storage. Never include the key in Android, browser bundles, or commits.

Example:
```js
const notifier = createLoopsNotifier({
  apiKey: process.env.LOOPS_API_KEY,
  enabled: process.env.LOOPS_NOTIFICATIONS_ENABLED === "true",
  transactionalIds: { "network.device_offline": process.env.LOOPS_NETWORK_OFFLINE_TEMPLATE_ID }
});
await notifier.notify({ project: "network", event: "device_offline", email: recipient, optedIn: userAllowsEmail, idempotencyKey: persistedBusinessEventId, data: { status: "offline" } });
```

Run `node --test integrations/loops-notifications/loops-notifier.test.mjs`.

**Not yet implemented:** durable outbox, deduplication, per-user preferences/revocation store, application event wiring, real-domain verification, live send test. The adapter does not enable actual bandwidth sharing, brokerage or Telegram task execution.

## Reliability and official SDK
Loops officially recommends the `loops` npm SDK. This lightweight fetch adapter stays dependency-free for now to avoid modifying the existing package lock or production dependencies. The adapter uses the same documented transactional endpoint and `Idempotency-Key` header. It retries only HTTP 429 and 5xx, with bounded exponential backoff; network exceptions retry using the SAME key. A 409 is **not** success: reconcile the event with provider records. Provider keys deduplicate for 24 hours only; production still needs a durable local event/outbox record, recipient preferences and reconciliation after ambiguous outcomes. Never generate a new key to bypass a 409.

The official SDK may replace the fetch transport in a follow-up, after a lockfile-controlled install and CI validation. Do not enable real sends until verified sending domain, published templates, application event wiring, and end-to-end consent checks are in place.
