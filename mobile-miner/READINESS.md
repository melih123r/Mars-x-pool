# Experimental VRSC readiness — 2026-10-05

## Verified in development
- Pinned Android ARM64 engine built; APK compilation, signing, engine hash, dependency and alignment checks passed.
- TLS Stratum subscribe/authorize probe succeeded against bzdev.vipor.net:5140. This was a connection probe, not a mining share.
- Single-thread foreground worker, consent, safety stops and correlated accepted-share diagnostics implemented.
- Provider adapter output survives reconciliation and replay; conflicting settlement aliases rejected.
- Commission arithmetic uses integer atoms and decimal strings. Direct-wallet mode has no MARS-X collectible commission. Managed mode is preview only.
- Conversion and withdrawal policy returns execution-disabled even when eligibility checks pass. No new live financial routes added.

## Required external evidence
1. Real supported Android device: start, valid accepted share, thermal/battery/network stops, foreground-background behavior and parent-process death. Service-side safety telemetry is implemented; real-device validation is still required.
2. Authenticated provider settlement transport and actual payout evidence bound to the correct wallet, worker and provider. Boolean providerConfirmed/providerVerified fields are internal adapter contracts, not cryptographic proof. Current generic adapter/tests are not a live payout integration.
3. Wire the SQLite exact-amount reconciliation ledger to an authenticated provider verifier and persistent deployment volume. The new ledger passes restart, provider-scoped replay and conflict tests, but is not connected to production or spendable balances. Legacy Number-based settlement helpers are prototypes and must not be used for live financial balances.
4. A supported provider mechanism for fee collection: direct wallet payouts cannot supply a MARS-X 10% pool or 2% withdrawal fee. No fee has been collected.
5. Production distribution review and signing, device coverage and an explicitly supported distribution channel for the native worker. The experimental worker package is separate from the existing Play management app.

Custody, conversion and withdrawal execution remain disabled. No accepted mining share, actual settlement, user earnings or platform income has been demonstrated by development tests.
