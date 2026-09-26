# Closed beta release runbook

## Release gate

All items below must be true for the exact commit distributed to testers:

- Backend tests pass.
- Translation parity passes for EN/TR/ID/AR.
- Release policy checks pass.
- Android lint passes.
- Debug APK and release AAB build successfully.
- `/health` returns HTTP 200 with `ok=true`, `service=marsx-pool-worker-api`, `storage=redis`, `persistent=true`, `version=0.6.0` and `payoutMode=sandbox`.
- A beta licence activates, registration succeeds, heartbeat succeeds and an unauthorised request is rejected.
- `USDT_TEST` remains non-withdrawable and clearly labelled in every language.
- No real Qonversion/Google Play purchase is enabled until the matching products, entitlements, cancellation flow and server secret are configured.

## Tester flow

1. Install only from the Play closed-test link or the owner-provided test APK.
2. Confirm the endpoint is the official HTTPS Railway domain.
3. Accept the displayed terms.
4. Activate the assigned one-device beta licence.
5. Register the worker and send a manual heartbeat.
6. Refresh sandbox account and payout history.
7. Complete the eight-item checklist and share genuine feedback.

## Operational checks

- Check `/health` before inviting a tester.
- Never send `WORKER_TOKEN`, `ADMIN_TOKEN`, Railway secrets or Qonversion server keys to a tester.
- Revoke a leaked beta licence and issue a different one.
- Preserve the dormant-balance reserve as a client liability; never recognise it as company revenue.
- Keep the existing Railway service and private Redis connection. Do not expose Redis publicly.

## Not production-ready

Real mining jobs, Stratum, share verification, real hashrate attribution, KYC/AML, custody and real payouts remain outside this closed beta. They require separately verified infrastructure, contracts, legal review and security controls.
