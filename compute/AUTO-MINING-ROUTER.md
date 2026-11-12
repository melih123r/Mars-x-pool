# MARS-X Auto Mining Router

User experience: **START -> automatic hardware detection -> eligible worker route -> provider-verified settlement -> balance -> WITHDRAW**.

Candidate routes are VRSC (ARM/CPU), XMR and ZEPH (CPU/RandomX), QUBIC (CPU/GPU workload), and LTC+DOGE (Scrypt ASIC). Candidates remain disabled until their provider adapter, accounting reconciliation, and withdrawal path pass production gates.

Google Play Android builds are a controller only. They must not execute cryptocurrency mining on the handset. External workers may be paired with the account after explicit resource-owner consent.

## Production gates per asset

1. Pin an audited miner/worker implementation and verify its license.
2. Integrate an authenticated pool/provider API without exposing credentials to clients.
3. Verify accepted/rejected work and immutable provider settlement references.
4. Credit only provider-confirmed settlement; estimates remain non-spendable.
5. Reconcile provider totals against the MARS-X ledger and deduplicate references.
6. Configure minimum withdrawal, network fee, pool fee, and withdrawal fee per asset.
7. Keep withdrawals disabled until custody/signer, idempotency, refund and kill-switch tests pass.
8. Enable the asset in the public catalog only after end-to-end production verification.

The router may rank eligible routes by measured net revenue per watt/device-hour after enough trustworthy observations exist. It must never fabricate profitability for an unverified route.
