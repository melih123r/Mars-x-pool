# MARS-X Network: 100-user pilot decision

Status: partner negotiation, **not approved for live traffic**.

- Accept proposed publisher settlement threshold of **USD 50**; confirm it in signed partner terms. This is not guaranteed earnings.
- Pilot target: **100 explicitly consenting Android users**, subject to partner acceptance and Google Play policy.
- Proposed user withdrawal threshold: **USD 1** from *settled* user balances; do not promise immediate payout. Provider fees, payout rails, legal obligations and reserve requirements remain unverified.
- Proposed revenue share: 80% to eligible users, 20% to MARS-X, only on finalized eligible publisher revenue, subject to executed agreement.
- Proposed withdrawal fee of USD 0.15 is a **proposal**, not implemented; must be disclosed in advance, tested against payout processor cost, and approved under applicable rules.
- Advertising publisher revenue: 100% to MARS-X; advertising is independent of Network consent.
- Single access tier; no Free/Pro/Premium/VIP subscription.

## Hard release gates
1. Partner confirms individual-founder eligibility, France/EEA eligibility, revenue redistribution permission, payment method, fees, and USD 50 payout threshold in writing.
2. Receive and review contract, DPA, SDK and security docs; assess Google Play and GDPR compliance.
3. Obtain explicit revocable consent and transparent bandwidth/data-use disclosure; do not silently proxy or route third-party traffic.
4. Track revenue states: estimated -> partner-confirmed -> settled -> withdrawable; no user withdrawals from unsettled funds.
5. Implement withdrawal ledger, idempotency, fraud/abuse prevention, payout reconciliation, payment-provider integration and auditable fee disclosures.
6. Pass CI, device installation, network security, stop-switch and payout simulation tests before any production rollout.

## Pilot break-even
For 100 users each earning USD 1 withdrawable and 80/20 split, partner must settle at least USD 125, **plus** payout fees and overhead. At USD 30 monthly overhead and no other income, break-even requires USD 150 gross partner revenue; transaction fees may raise this. USD 50 settlement threshold alone does not finance USD 100 user payouts.

No production SDK, real user traffic, or live payouts authorized by this document.
