# MARS-X Network — partner onboarding and launch gates

**Scope:** Network only; Finance and Telegram excluded.

## TraffMonetizer publisher SDK
- [x] Initial publisher inquiry and follow-up sent.
- [x] Partner stated USD 0.10 per GB of eligible routed traffic, paid to one publisher account; device-level earnings available.
- [x] Partner stated SDK access follows app listing review, individual publisher KYC and SDK agreement.
- [ ] Written confirmation that an Android closed-testing listing is acceptable (or production listing requirement).
- [ ] Written confirmation of individual-founder KYC, end-user KYC requirements and 70/30 end-user distribution terms.
- [ ] Publisher KYC completed by account owner and SDK agreement signed.
- [ ] Official Android SDK delivered, verified, and integrated following vendor instructions.
- [ ] Android device testing: explicit fresh consent, foreground disclosure, stop/revoke, data usage, battery/thermal and network safety.
- [ ] Server-side signed earnings receipt, device/user mapping, fraud review and immutable idempotent ledger.

## Rewarded-video cash advertising (separate partner requirement)
- [ ] Written approval from an advertising partner specifically permitting cash/withdrawable incentives; TraffMonetizer bandwidth SDK approval **does not** constitute rewarded-video approval.
- [ ] Signed event verification, advertiser settlement and reconciliation before any cash credits.

## Withdrawal provider
- [x] Display-only quote: 5% withdrawal fee, EUR 10 minimum, separately disclosed external fees.
- [ ] Provider contract, eligibility/KYC requirements, payout rails, fraud controls, reconciliation and refund handling.
- [ ] Live transfers explicitly enabled only after all gates pass and end-to-end tests succeed.

## Release acceptance — Android device checklist
- [ ] Install the **latest artifact from the current Network branch** (do not reuse an older Pool APK).
- [ ] Cold launch and relaunch after force-stop; confirm Network home renders without crashes.
- [ ] Deny consent: confirm no routing, no foreground service, no ad requests and zero balances.
- [ ] Grant **test-only** consent: confirm it does **not** start real traffic or silently grant advertising consent.
- [ ] Revoke test consent and restart: confirm revocation persists and the UI reflects it.
- [ ] Rotate portrait/landscape, background/foreground, airplane mode and low battery: no unexpected starts.
- [ ] Withdrawal button stays disabled; EUR 10 minimum and 5% fee disclosed; no actual transfers.
- [ ] Verify app icon and package/version match Network release, not legacy Pool.
- [ ] Capture device model, Android version, APK SHA-256, build run URL, screenshots and test outcomes.

## Settlement and withdrawal implementation contract
- Separate **bandwidth traffic revenue** from **rewarded-video advertising revenue**: do not combine receipts or assume a bandwidth SDK authorizes cash video rewards.
- Never use client-reported views, bytes or earnings as a source of monetary truth.
- Each eligible provider receipt must have a unique immutable ID, provider signature verification, reconciliation status and currency; reject duplicates.
- Account for pending, settled, reversed and paid balances separately. User available balance may not exceed settled, non-reversed entitlement.
- Calculate allocations in integer minor units, record any rounding remainder deterministically, and avoid floating-point ledger balances.
- Withdrawal request must atomically reserve funds, verify owner and payee eligibility, prevent replay/double spend, and record external fees before final confirmation.
- Refunds, rejected payouts, disputes and chargebacks require audited reversing entries rather than editing old transactions.
- Keep production payments and SDK traffic behind server-controlled launch flags; client test consent is never production authorization.

## Safety
All real network routing, ad SDK requests, monetary credits and withdrawals remain disabled until documented approval and verification. A green GitHub CI run does not prove device acceptance or partner approval.
