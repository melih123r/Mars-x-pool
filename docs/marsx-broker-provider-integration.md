# MARS-X Broker Provider Integration

MARS-X is provider-neutral. Production execution, custody and withdrawals remain disabled until a regulated provider is contracted and its credentials/certification are complete.

## Adapter readiness
- lemon.markets: sandbox contract adapter; credential gated; orders and withdrawals default OFF.
- Alpaca Broker: US Sandbox Basic auth and US/EU Sandbox OAuth; credential gated; orders default OFF; only matching official Sandbox hosts are accepted.
- Additional providers implement the same broker lifecycle without changing MARS-X OMS/ledger/reconciliation.

## Provider comparison snapshot

| Provider | Best use in MARS-X | Current code status | Keep blocked until |
| --- | --- | --- | --- |
| lemon.markets | EU-first brokerage onboarding for equities/ETFs | Adapter present; SCA-aware order/withdrawal methods; default OFF | Production contract, KYC/SCA verification, explicit order and withdrawal gates |
| Alpaca Broker | Sandbox lifecycle and US/EU broker proof-of-concept | Sandbox adapter, account/KYC/order/event/reconciliation tests | Broker agreement, valid sandbox credentials, region certification |
| Upvest | Strong EU/UK embedded investment infrastructure candidate | Scorecard candidate; no live adapter yet | Commercial onboarding, operating model choice, licensed-provider contract |
| DriveWealth | Global embedded US equities/fractional investing candidate | Scorecard candidate; no live adapter yet | Partner approval, API docs/credentials, country coverage review |
| IBKR | Broad-market pro/paper trading research path | Scorecard candidate; no embedded mobile onboarding adapter | Gateway/session design, user account dependency, compliance review |

Provider references used for this snapshot:
- Alpaca presents Trading API and Broker API products for building financial apps and embedded investing.
- Upvest describes an Investment API covering brokerage, settlement and custody, with sandbox/testing and API documentation.
- IBKR documents Web/Client Portal API access for trading, portfolio information, market data and paper trading.

MARS-X selection rule: prefer a regulated embedded brokerage provider with sandbox lifecycle, KYC/SCA support, webhook/reconciliation coverage and backend-only credentials. Do not use a provider merely because it has a public trading API.

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

## Alpaca Sandbox certification
See [Alpaca Sandbox setup and certification](marsx-alpaca-sandbox-setup.md) for credential names, safety gates, authenticated SSE delivery, and the redacted certification command.

The local contract suite uses an in-memory provider fixture and does not prove an external Alpaca connection. Provider certification remains blocked until this project has its own valid Sandbox credentials and the external workflow passes. A cancelled/rejected order cannot stand in for a provider-confirmed fill or a completed ledger test.
