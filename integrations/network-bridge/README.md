# MARS-X Network Bridge — integration prototype

A dependency-free, consent-gated adapter for the **existing** licensed `/register` and `/heartbeat` API routes.

- No partner SDK, bandwidth forwarding, mining, rewards, or payments.
- No Android-side API keys; the adapter must run only in a trusted component with a verified session.
- Consent is checked both before and after asynchronous session retrieval.
- No automatic retry: registration and heartbeats must respect explicit opt-in and cancellation.
- `onEvent` is a best-effort hook, **not** a durable queue or Loops production integration.

Run: `node --test integrations/network-bridge/network-bridge.test.mjs`.

**Before production:** integrate with the actual Android session/consent model, ensure server-side consent revocation is enforced, add persistent outbox and notification preferences, and test on real devices. A separate partner agreement is required for actual bandwidth sharing.
