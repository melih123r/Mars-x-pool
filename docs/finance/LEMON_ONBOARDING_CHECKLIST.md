# lemon.markets onboarding checklist for MARS-X Finance

Status: technical preparation only. The Brokerage API is invite-only and MARS-X has not been issued production approval or credentials.

## Publicly documented API contracts

- Authorization: Bearer API key, server-side only.
- Data protection tracing headers:
  - `LMG-Data-Privacy-Access-Principal`
  - `LMG-Data-Privacy-Access-Justification`
- Partner authentication check:
  - `GET /company`
- Development hosts used by the adapter:
  - `https://sandbox.api.lemon.markets/v1`
  - `https://dev-brokerage.lemon.markets/v1`
- Identity verification:
  - `POST /accounts/{account_id}/identity_verification`
- SCA authenticator enrollment:
  - `POST /accounts/{account_id}/authenticators`
- SCA authenticator listing:
  - `GET /accounts/{account_id}/authenticators`
- Product discovery:
  - `GET /instruments`
  - `GET /product_contracts`

Official docs:
- https://developer.lemon.markets/
- https://developer.lemon.markets/docs/authorization
- https://developer.lemon.markets/docs/create-account
- https://developer.lemon.markets/docs/strong-customer-authentication
- https://developer.lemon.markets/reference/start_identity_verification-1
- https://developer.lemon.markets/reference/create_authenticator-1
- https://developer.lemon.markets/reference/list_authenticators-1
- https://developer.lemon.markets/reference/list_product_contracts

## MARS-X implementation gates

### Completed in code
- [x] Backend-only Bearer credential handling
- [x] Data privacy tracing headers
- [x] Official development-host allowlist
- [x] HTTPS-only Lemon base URL validation
- [x] Account/KYC adapter primitives
- [x] Experience profile adapter primitive
- [x] Securities-account adapter primitive
- [x] SCA authenticator enrollment helper
- [x] SCA authenticator list helper
- [x] Instrument discovery helper
- [x] Product-contract discovery helper
- [x] Order submission disabled by default
- [x] Withdrawal submission disabled by default
- [x] No Lemon secret in Android
- [x] Public integration-readiness endpoint exposes status only
- [x] Unsafe KYC redirect schemes rejected
- [x] Android KYC return deep link (`marsx://brokerage/success|failure`) registered
- [x] KYC redirect is treated as non-authoritative; backend state must still be refreshed
- [x] Webhook signature verification helper
- [x] Webhook verify → queue → acknowledge intake pipeline helper
- [x] Duplicate event rejection and per-entity partition key generation
- [x] Redis Stream durable-queue adapter with atomic dedupe + enqueue

### Still required from lemon.markets / commercial onboarding
- [ ] Partner acceptance / operating-model confirmation
- [ ] Sandbox API credential
- [ ] Exact legal entity and tied-agent / distribution requirements for France
- [ ] Contractual SCA responsibilities
- [ ] KYC / AML responsibility matrix
- [ ] Production host and production credential details
- [ ] Webhook event catalogue and signing / verification requirements
- [ ] Provision Redis with persistence and confirm durability in deployment
- [ ] Dead-letter processing and worker retry policy
- [ ] Commercial pricing / revenue-share terms
- [ ] Production certification and go-live approval

### Before any real customer order
- [ ] End-to-end sandbox account creation
- [ ] Legal-document presentation and acceptance flow
- [ ] Identity verification completion
- [ ] Knowledge / experience profile completion
- [ ] SCA enrollment and challenge verification
- [ ] Securities account provisioning
- [ ] Instrument eligibility verified under product contract
- [ ] Reconciliation and webhook tests
- [ ] Error / retry / idempotency tests
- [ ] Android device smoke test
- [ ] Compliance sign-off
- [ ] Explicit production feature-flag review

## Non-negotiable safety state

Until every production gate is independently verified:
- live trading = OFF
- withdrawals = OFF
- custody claims = OFF
- KYC bypass = prohibited
- production credential assumptions = prohibited
- API secrets in Android = prohibited
