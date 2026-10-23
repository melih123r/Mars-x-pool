# MARS-X Network — Rewarded Video Revenue Contract (Draft)

## Distribution
- Net, **verified and actually received** eligible rewarded-video advertising revenue: **70% MARS-X / 30% user**.
- Additional platform fee: **0%**. No points or token conversion.
- Accounting currency: EUR cents. User's eligible share is credited **directly to their in-app advertising balance**, only after a qualifying partner confirms payment and reward eligibility.
- Do not promise guaranteed earnings, pay for views, or use client-side view counts as monetary proof.
- **Current live advertising balance remains €0.00.** The Android preview must not create, increment, or unlock any financial balance.

## Withdrawal terms (approved proposal; not enabled)
- Minimum requested withdrawal: **EUR 10.00** of verified, settled, available balance.
- Withdrawal platform fee: **5% of requested gross withdrawal**, rounded up to the nearest euro cent.
- External bank/blockchain network costs are **additional**, disclosed in the quote before confirmation; no silent charges.
- Example: EUR 100.00 gross → EUR 5.00 MARS-X withdrawal fee → EUR 95.00 before external network costs.
- The **0% additional advertising allocation fee** and **5% withdrawal fee** apply to different stages and do not conflict.
- Withdrawals remain disabled until approved partner, payout provider, compliance checks, ledger and reconciliation are live.

## Eligibility gate (fail closed)
1. Obtain written partner approval **explicitly allowing cash/withdrawable rewarded-video incentives** in all target regions. Do not assume Google AdMob allows direct cash/crypto rewards; do not activate this scheme with AdMob.
2. Obtain required account, advertiser placement IDs, privacy disclosures, consent flows, and fraud controls.
3. Validate signed server-to-server reward callback, event uniqueness, partner reconciliation, and actual net revenue receipts.
4. Post a single immutable ledger entry per eligible revenue event (idempotency key); allocate integer cents as user_share = floor(net_cents * 30 / 100), platform_share = net_cents - user_share. No extra fee.
5. Define settlement, refunds/chargebacks, minimum payout, taxes, identity verification, disputes, and prohibited traffic controls before withdrawals.
6. Use server-side access controls and audit logging. No client-side API keys or reward balance mutation.

## Current state
This is an approved **business allocation specification**, not a live cash reward implementation. All ad requests, partner payouts, and balance mutations remain disabled until the gates above are satisfied.
