# MARS-X Network — partner onboarding and launch gates

**Scope:** Network only; Finance and Telegram excluded.

## Proxies.sx Android SDK
- [x] Official Android SDK v1.3.2 and integration guide publicly available.
- [x] SDK dependency pinned and integrated behind explicit branded consent and start/stop controls.
- [x] SDK/device key is injected at build time and absent from source control; empty builds fail closed.
- [x] Partner states earnings depend on eligible customer traffic actually served, with no fixed monthly guarantee.
- [ ] Farmer Partner Agreement 2.0 approved for the MARS-X account.
- [ ] Farmer source declaration completed with app/distribution, device-owner and withdrawal details.
- [ ] Partner reviews real MARS-X screens showing Proxies.sx, connection status and Stop sharing.
- [ ] Pilot country and first two-week consented device count sent to Maya.
- [ ] Android device testing: explicit fresh consent, foreground disclosure, stop/revoke, data usage, battery/thermal and network safety.
- [ ] Partner dashboard/device reports reconciled to server-side user allocation and immutable idempotent ledger.

## Rewarded-video cash advertising (separate partner requirement)
- [ ] Written approval from an advertising partner specifically permitting cash/withdrawable incentives; Proxies.sx bandwidth SDK approval **does not** constitute rewarded-video approval.
- [ ] Signed event verification, advertiser settlement and reconciliation before any cash credits.

## Withdrawal provider
- [x] Display-only quote: 5% withdrawal fee, EUR 10 minimum, separately disclosed external fees.
- [ ] Provider contract, eligibility/KYC requirements, payout rails, fraud controls, reconciliation and refund handling.
- [ ] Live transfers explicitly enabled only after all gates pass and end-to-end tests succeed.

## Release acceptance — Android device checklist
- [ ] Install the **latest artifact from the current Network branch** (do not reuse an older Pool APK).
- [ ] Cold launch and relaunch after force-stop; confirm Network home renders without crashes.
- [ ] Deny consent: confirm no routing, no foreground service, no ad requests and zero balances.
- [ ] Grant Proxies.sx consent: confirm consent alone does not start traffic or silently grant advertising consent.
- [ ] Press Start sharing: confirm the foreground notification, CONNECTED state and Peers dashboard entry.
- [ ] Press Stop sharing and revoke consent: confirm the SDK stops and revocation persists after restart.
- [ ] Revoke test consent in an unconfigured build: confirm the local DEMO path also remains fail-closed.
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
Partner traffic is enabled only in builds supplied with a restricted Proxies.sx key and after explicit user consent plus a separate Start action. Monetary credits and withdrawals remain disabled until partner reconciliation and payout approval. A green GitHub CI run does not prove physical-device acceptance or partner-account approval.
