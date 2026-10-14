# Real pool adapter v1

This module is the production-accounting boundary for future LTC/DOGE pool integration.

Current state:
- validates provider settlement snapshots;
- computes the configured 10% pool service fee;
- quotes withdrawals with the configured 2% service fee and an explicit network fee;
- keeps provider references so credits can be reconciled and deduplicated;
- contains no wallet private keys and cannot broadcast withdrawals.

## Production gates
1. Add an authenticated provider adapter using official pool credentials stored only in runtime secrets.
2. Map provider worker/share/settlement identifiers into `normalizePoolSnapshot`.
3. Credit user balances only from provider-confirmed settlements; never from client-reported hashrate.
4. Store a unique provider settlement reference and reject duplicates.
5. Reconcile provider totals against the internal ledger before enabling withdrawals.
6. Implement withdrawals behind a separate signer/custody boundary, allowlisted assets/networks, idempotency and manual kill switch.
7. Test minimum withdrawal, fee disclosure, rejected/failed withdrawal refunds and network-fee handling.
8. Keep all real-mining/reward feature flags OFF until end-to-end reconciliation passes.

The Android client may display hashrate and estimates, but estimates must be labelled as estimates and must not create spendable balances.
