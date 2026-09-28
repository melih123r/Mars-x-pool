# Closed beta release runbook

## Release gate

All items below must be true for the exact commit distributed to testers:

- Backend tests pass.
- Translation parity passes for EN/TR/ID/AR.
- Release policy checks pass.
- Android lint passes.
- Debug APK and release AAB build successfully.
- Cloudflare `/health` returns HTTP 200 with `ok=true`, `service=marsx-pool-worker-api`, `storage=d1`, `persistent=true`, `version=0.8.0`, `google_auth=ready` and `payoutMode=sandbox`.
- A beta licence activates, registration succeeds, heartbeat succeeds and an unauthorised request is rejected.
- `USDT_TEST` remains non-withdrawable and clearly labelled in every language.
- No real Qonversion/Google Play purchase is enabled until the matching products, entitlements, cancellation flow and server secret are configured.

## Tester flow

1. Install only from the Play closed-test link or the owner-provided test APK.
2. Confirm the endpoint is the official HTTPS Cloudflare Workers domain.
3. Accept the displayed terms.
4. Activate the assigned one-device beta licence.
5. Register the worker and send a manual heartbeat.
6. Refresh sandbox account and payout history.
7. Complete the eight-item checklist and share genuine feedback.

## Operational checks

- Check `/health` before inviting a tester.
- Never send `WORKER_TOKEN`, `ADMIN_TOKEN`, Cloudflare/Railway secrets or Qonversion server keys to a tester.
- Revoke a leaked beta licence and issue a different one.
- Preserve the dormant-balance reserve as a client liability; never recognise it as company revenue.
- Keep Railway/Redis only as a private rollback target during the verified migration window. Do not expose Redis publicly or cancel Railway before the Cloudflare checks pass.

## Not production-ready

Real mining jobs, Stratum, share verification, real hashrate attribution, KYC/AML, custody and real payouts remain outside this closed beta. They require separately verified infrastructure, contracts, legal review and security controls.
