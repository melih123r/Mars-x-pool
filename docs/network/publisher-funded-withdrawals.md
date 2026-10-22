# MARS-X Network — Publisher-funded user withdrawals (SDK-independent design)

Status: DESIGN ONLY. No real payment execution enabled. This is not an authorization to custody funds, make payments, or distribute partner revenue.

## Flow
1. Partner pays the verified publisher account after settlement; receipt is reconciled and deduplicated.
2. The publisher allocates user entitlements according to a documented, partner-authorized revenue-share policy. No balance is withdrawable before partner funds are settled and funded.
3. User registers a destination wallet and network; show an explicit warning about irreversible transfers and wrong networks.
4. User requests withdrawal. Server verifies authenticated user, available **settled** balance, eligibility, payout minimum, network, fees, sanctions/fraud/rate limits and destination address.
5. In a serializable database transaction, reserve the requested amount using a unique idempotency key. Never debit an account twice.
6. A separate payout operator reviews and approves the request. No mobile client has signing keys or direct access to the publisher's wallet.
7. An approved, appropriately authorized payout service signs and broadcasts the transfer from a dedicated, capped hot wallet; main treasury funds stay offline or separately secured.
8. On finality, record immutable transaction ID, network, fee, amount, status and timestamp. On definitive failure, release reservation exactly once. For unknown status, reconcile before retrying.

## Minimal entities
- earnings_ledger(id, user_id, partner_receipt_id, gross, user_share, currency, status: pending|settled|reversed, created_at)
- withdrawal_requests(id, user_id, idempotency_key, destination_address, network, amount, fee, currency, status: requested|reserved|review|approved|broadcast|confirmed|failed|cancelled, created_at, updated_at)
- payout_transactions(id, withdrawal_id, tx_hash, network, nonce, status, fee, created_at)
- audit_events(id, actor_id, action, object_id, timestamp, metadata)

Constraints: unique(partner_receipt_id, user_id, allocation_version); unique(user_id, idempotency_key); unique(network, tx_hash) when present. Monetary values are integers in smallest units; avoid floats.

## API contract (future; mock-only until approved)
- GET /network/wallet -> {pending, settled, reserved, withdrawable, currency, is_demo}
- POST /network/withdrawals -> {amount_minor, currency, network, destination_address, idempotency_key}
- GET /network/withdrawals -> list of status records
- GET /network/withdrawals/{id} -> details and blockchain receipt where available
- POST /internal/network/withdrawals/{id}/approve -> operator-only, audit-logged; unavailable in demo

## SDK-free Play demo release
- All balances and withdrawals clearly labelled DEMO / SIMULATED.
- Withdrawal request UI may simulate request creation locally or against a sandbox, with **no real transfer** and no real wallet signature.
- API and background workers MUST default to PAYOUTS_ENABLED=false and TRAFFIC_ENABLED=false. A release build must not silently turn either on.
- Do not expose wallet seed phrases, private keys, or signing APIs to the Android app.
- Partner permission to redistribute proceeds, publisher KYC, payment-provider terms, France/EEA requirements, fraud controls and Google Play policy need review before activation.
- Neither USDT chain choice nor revenue share/fees are approved yet; configure only after explicit decisions and written partner authorization.

## Test gates
- Concurrent duplicate request -> one reservation.
- Insufficient or pending-only balance -> rejected.
- Malformed address / unsupported chain -> rejected.
- Retry after timeout -> idempotent status retrieval, no double payment.
- Failed or reorged transaction -> safe reconciliation.
- Disabled real payout flag -> zero signing/broadcast calls.
- No secrets in logs, CI artifacts, APK or repository.
