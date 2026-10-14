# MARS-X Alpaca Broker Sandbox setup

Scope: development and E2E testing only. Live execution, deposits, funding, custody and withdrawals are unavailable in this adapter. This work does not register a financial business, execute a live trade or open a production account.

## Registration status — 2026-10-06

The official Broker Dashboard registration page is https://broker-app.alpaca.markets/sign-up.

Registration could not be completed in the Cloud Browser: the Alpaca page aborts with `THREE.WebGLRenderer: Error creating WebGL context.` Both signup and the official dashboard entry rendered an empty page. One reload did not resolve the issue. No signup form was filled, terms accepted, account created, credential generated or deployment secret changed.

The Cloud Browser also refused its internal graphics-settings page because only HTTP/HTTPS destinations are allowed. There was no CAPTCHA or bot-block evidence. This restriction cannot be bypassed by alternate browser commands or page scripts.

Use only truthful project details if signup becomes available:

| Field | Prepared value |
| --- | --- |
| Project/product name | MARS-X FINANCE |
| Founder/contact | Abdil Melih Demirbaş |
| Project stage | Pre-revenue prototype / closed beta |
| Repository | https://github.com/melih123r/Mars-x-pool |
| Use case | Provider-neutral fintech prototype; Broker Sandbox development and synthetic account/KYC, portfolio, order, event, ledger and reconciliation tests. No real funds, production trading, custody or withdrawals. |
| Legal entity / registration number / regulatory licence | Not verified; do not invent one or claim a licensed/incorporated business. |

Password creation, verification, CAPTCHA and legally binding acceptance require the user's action/approval. Never put passwords, API keys, client secrets or bearer tokens in chat, source control, screenshots or CI logs.

## Credential configuration

Store credentials directly in a deployment secret store for the isolated engine/test environment. Do not reuse Trading API paper-account credentials as Broker credentials. Do not change the running Pool worker to enable tests. No new paid Railway service is required or authorised by this change.

US Broker Sandbox with legacy API key/secret:

```dotenv
ALPACA_BROKER_REGION=us
ALPACA_BROKER_AUTH_MODE=basic
ALPACA_BROKER_API_KEY=<deployment-secret>
ALPACA_BROKER_API_SECRET=<deployment-secret>
MARSX_ALPACA_BROKER_ALLOW_ORDERS=false
MARSX_ALPACA_SANDBOX_E2E_WRITES=false
```

US/EU OAuth client credentials:

```dotenv
ALPACA_BROKER_REGION=eu
ALPACA_BROKER_AUTH_MODE=oauth
ALPACA_BROKER_CLIENT_ID=<deployment-secret>
ALPACA_BROKER_CLIENT_SECRET=<deployment-secret>
MARSX_ALPACA_BROKER_ALLOW_ORDERS=false
MARSX_ALPACA_SANDBOX_E2E_WRITES=false
```

Use `us` for US-issued OAuth credentials. The previous EU OAuth default is preserved when only client credentials are configured. US Basic credentials select the US Sandbox by default. Explicit region/mode settings are preferable. The adapter does not automatically retry using another region or authentication flow.

Only these API/auth pairs are accepted; addresses are immutable and redirects are rejected:

| Region | Broker API | OAuth |
| --- | --- | --- |
| US | https://broker-api.sandbox.alpaca.markets | https://authx.sandbox.alpaca.markets |
| EU | https://broker-api.sandbox.eu.alpaca.markets | https://authx.sandbox.eu.alpaca.markets |

OAuth tokens are cached until shortly before expiry; concurrent reads share one token request. Credentials/tokens are private fields, omitted from status/JSON output. Request errors expose only a status/category, not provider response bodies.

## Running certification

```bash
npm run global-engine:test
npm run global-engine:alpaca-sandbox:certify
```

Without credentials the second command exits `2`, reports `CREDENTIALS_NOT_CONFIGURED`, sets later phases to `NOT_RUN`, and makes zero API requests. This is not a passing external E2E test.

With credentials the command remains read-only by default. To inspect one existing synthetic account, set `MARSX_ALPACA_SANDBOX_ACCOUNT_ID`. An already-active snapshot does not count as an observed KYC lifecycle.

An isolated full workflow needs a provider-valid synthetic fixture file, referenced by `MARSX_ALPACA_SANDBOX_FIXTURE_PATH`, and both explicit test gates:

```dotenv
MARSX_ALPACA_SANDBOX_E2E_WRITES=true
MARSX_ALPACA_BROKER_ALLOW_ORDERS=true
```

The fixture envelope has `synthetic: true`, an Alpaca-valid `payload` with test contact/identity/disclosures/agreements using an `example.com` or `example.test` email, optional provider-valid test `cip`, and an `order` object. Use the provider's documented fixtures; do not reuse a real person's identity or attest a real person's agreements. No identity/SSN fixture is fabricated by this repository's certification command.

The command limits its own test order to at most one share of AAPL or SPY, buy, day, market/limit, and a generated `marsx-sandbox-e2e-` client ID. It makes no funding request and needs pre-existing simulated buying power to obtain a fill. It polls briefly, attempts to cancel only its own remaining order, and flags any unconfirmed cleanup. Outside market hours, simulated orders may queue; cancellation without a confirmed fill leaves the ledger phase `NOT_RUN` and the run uncertified. Restore both write gates to `false` after the isolated test.

## Event, ledger and reconciliation contract

Alpaca uses authenticated SSE, not a public unsigned webhook. Account events use `/v1/events/accounts/status`; US trade events use `/v2/events/trades`. The v1 trade stream is deprecated. The internal callback is fed by the authenticated adapter stream. No public webhook endpoint is introduced. EU trade SSE requires separate certification and is blocked here until its exact contract is verified.

SSE reads have deadlines and bounded event counts/sizes. Invalid/truncated data or provider comments indicating dropped events/internal errors require replay. The event processor tracks only orders created by the test, checks account/order/symbol/side identity, deduplicates events/executions, and records only observed incremental fills. Duplicate/stale replay cannot create another ledger entry. A missing partial fill, trade correction/bust, unknown event or terminal-state conflict stops certification for review.

The test ledger is in memory and explicitly `SANDBOX_TRADE`; it does not credit customer balances or connect to Pool settlements. Reconciliation compares expected cash/positions with fresh provider snapshots, rejects non-finite/missing numbers, detects fractional-position drift, and never auto-corrects. Fees/corrections or unrelated activity may cause a mismatch and must be reviewed. A pass requires all phases to pass, including an observed KYC transition and provider-confirmed fill; cancellation, missing events or a cash/position mismatch cannot produce `certified: true`.

Local tests use dummy credentials and an in-memory provider fixture. They verify the contract and safety gates; they are not evidence of an Alpaca account, key, network connection or externally completed E2E workflow.

## Primary references

- https://docs.alpaca.markets/us/docs/integration-setup-with-alpaca
- https://docs.alpaca.markets/us/v1.4.2/docs/authentication
- https://docs.alpaca.markets/eu/docs/getting-started-with-broker-api
- https://docs.alpaca.markets/us/reference/subscribetotradev2sse
- https://docs.alpaca.markets/us/reference/subscribetoaccountstatussse
- https://docs.alpaca.markets/us/reference/get-v1-trading-accounts-account_id-account-portfolio-history
