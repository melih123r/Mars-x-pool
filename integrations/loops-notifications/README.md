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
await notifier.notify({ project: "network", event: "device_offline", email: recipient, optedIn: userAllowsEmail, data: { status: "offline" } });
```

Run `node --test integrations/loops-notifications/loops-notifier.test.mjs`.

**Not yet implemented:** durable outbox, deduplication, per-user preferences/revocation store, application event wiring, real-domain verification, live send test. The adapter does not enable actual bandwidth sharing, brokerage or Telegram task execution.
