# MARS-X Finance — ChangeNOW live execution readiness

Status: **NOT APPROVED FOR LIVE TRANSACTIONS**. This checklist is for release review, not a substitute for provider authorization or legal advice.

## Provider and compliance
- [ ] Confirm ChangeNOW API key and account are active for production (do not print or commit secrets).
- [ ] Obtain current supported/restricted jurisdictions, legal contracting entity, user terms, and KYC/AML escalation/refund behavior in writing.
- [ ] Validate that MARS-X's exact operating model (noncustodial routing vs custody, fiat, brokerage, marketing) is covered; obtain independent EU/France regulatory review where needed.
- [ ] Verify partner fee configuration and total-fee disclosures.

## Transaction API
- [ ] Implement transaction creation using provider's current authenticated API specification, with explicit server-side amount, currency, network, destination-address and refund-address validation.
- [ ] Require user confirmation of destination, network, quote expiry, estimated fees, risk warnings and applicable terms before creation.
- [ ] Use an idempotency key per confirmed intent, deduplicate retries and reconcile provider IDs and state changes.
- [ ] Implement status polling/webhooks with signature validation where supported, bounded retries and audit logs without secrets or sensitive personal data.
- [ ] Handle KYC pending, blocked, expired, refund and partial-failure states. Never bypass provider checks.
- [ ] Enforce per-user risk limits, circuit breaker, rate limits, anti-abuse and incident rollback.
- [ ] Test insufficient minimum, stale quote, invalid address/network, provider 4xx/5xx, timeout, duplicate request and refund cases.

## Release gates
- [ ] Pass automated security, unit, integration and Android CI.
- [ ] Perform explicit controlled live pilot with authorized provider account and consenting test users; no test transfers without separate approval.
- [ ] Verify reconciliation, customer support and incident response.
- [ ] Obtain final signoff before enabling transaction creation; leave withdrawals, payouts and custody disabled unless separately implemented, authorized and certified.

Current code: `global-engine/adapters/changenow.js` has quote/status support but `createTransaction()` intentionally rejects calls. The existing `/convert/*` and `/changenow/*` routes are read-only. Do not claim a feature is live because an environment variable exists.
