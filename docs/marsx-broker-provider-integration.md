# MARS-X Broker Provider Integration

MARS-X is provider-neutral. Production execution, custody and withdrawals remain disabled until a regulated provider is contracted and its credentials/certification are complete.

## Adapter readiness
- lemon.markets: sandbox contract adapter; credential gated; orders and withdrawals default OFF.
- Alpaca EU Broker: sandbox adapter; credential gated; orders default OFF.
- Additional providers implement the same broker lifecycle without changing MARS-X OMS/ledger/reconciliation.

## Provider certification checklist
1. Store credentials only in deployment secrets.
2. Verify sandbox authentication.
3. Create a sandbox customer/account using provider-required KYC test fixtures.
4. Verify account/KYC state mapping.
5. Verify funding state events without real funds.
6. Submit a sandbox order only after the sandbox order gate is explicitly enabled.
7. Test partial fill, fill, cancel, reject and out-of-order webhook events.
8. Reconcile provider cash/positions against the internal ledger; never auto-correct mismatches.
9. Verify duplicate webhook/idempotency behavior.
10. Keep live execution and withdrawals disabled until contractual/regulatory approval and production certification.

## Hard safety boundary
A sandbox credential does not enable production. No production credential, customer money, withdrawal, custody or live order may be enabled merely because sandbox tests pass.
