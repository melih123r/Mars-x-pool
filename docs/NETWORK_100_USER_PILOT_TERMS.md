# MARS-X Network: 1,000-user pilot decision

Status: partner negotiation, **not approved for live traffic**.

- Accept proposed publisher settlement threshold of **USD 50** only if confirmed in signed partner terms. This is not guaranteed earnings.
- Minimum pilot target: **1,000 explicitly consenting Android users**, subject to partner acceptance and Google Play policy.
- Architecture target: **10,000+ users** without changing the fail-closed consent, ledger, payout and abuse controls.
- Proposed user withdrawal threshold: **USD 1** from *settled* user balances; do not promise immediate payout. Provider fees, payout rails, legal obligations and reserve requirements remain unverified.
- Proposed revenue share: 80% to eligible users, 20% to MARS-X, only on finalized eligible publisher revenue, subject to executed agreement.
- Proposed withdrawal fee of USD 0.15 is a **proposal**, not implemented; it must be disclosed in advance, tested against payout processor cost, and approved under applicable rules.
- Advertising publisher revenue: 100% to MARS-X; advertising is independent of Network consent.
- Single access tier; no Free/Pro/Premium/VIP subscription.

## Hard release gates
1. Partner confirms individual-founder eligibility, France/EEA eligibility, revenue redistribution permission, payment method, fees, and settlement threshold in writing.
2. Receive and review contract, DPA, SDK and security docs; assess Google Play and GDPR compliance.
3. Obtain explicit revocable consent and transparent bandwidth/data-use disclosure; do not silently proxy or route third-party traffic.
4. Track revenue states: estimated -> partner-confirmed -> settled -> withdrawable; no user withdrawals from unsettled funds.
5. Implement withdrawal ledger, idempotency, fraud/abuse prevention, payout reconciliation, payment-provider integration and auditable fee disclosures.
6. Pass CI, Android 8+ physical-device installation, orientation, battery/thermal, permission-revocation, background/foreground-service, network security, stop-switch and payout simulation tests before any production rollout.
7. Validate the 1,000-user pilot load and the 10,000+ scale target with reproducible test evidence.
8. Keep Network start and withdrawals fail-closed until partner and payout approvals exist.

## Pilot economics
For 1,000 users each to have USD 1 withdrawable with an 80/20 split, eligible settled partner revenue must be at least **USD 1,250**, before payout fees, reserves and operating overhead. A USD 50 publisher settlement threshold alone does not fund the pilot. Any production economics must be recalculated from the signed partner and payout-provider terms.

No production SDK, real user traffic, or live payouts are authorized by this document.
