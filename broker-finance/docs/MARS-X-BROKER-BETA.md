# MARS-X Broker Beta — zero-capital foundation

## Goal
Add a provider-neutral Broker module to the existing MARS-X app without enabling real-money brokerage, custody, deposits, withdrawals, or investment execution.

## Release mode
- Default provider: `PAPER`
- Real-money trading: OFF
- Customer custody: OFF
- Deposits/withdrawals: OFF
- MARS-X transaction fee collection: OFF
- Mainnet crypto: OFF
- Broker Beta must be clearly labelled simulation/paper trading.

## App architecture
MARS-X App Shell
- Pool — existing product
- Wallet — beta/read-only shell
- Broker — paper-trading beta
- Engine — analysis/decision-support

Shared identity is MARS-X ID. Financial domains must retain separate ledgers and provider records.

## Broker service boundaries
```
Broker UI
  -> Broker API
      -> Portfolio / Orders / Watchlist
      -> Fee Engine
      -> Provider Router
           -> PAPER adapter (enabled)
           -> Alpaca adapter (sandbox/disabled by default)
           -> lemon.markets adapter (sandbox/disabled by default)
           -> Upvest adapter (disabled by default)
           -> Concedus/regulatory-provider adapter (disabled by default)
           -> future providers
```

Provider-specific payloads must not leak into the mobile UI. The router exposes one MARS-X order/portfolio model so providers can be replaced without rewriting the app.

## Fee engine
Prepare configurable fees but do not collect them in Beta.

Initial placeholders for modelling only:
- equities/ETF: 10 bps (0.10%)
- crypto: 15 bps (0.15%)

Rules:
1. `fee_collection_enabled=false` by default.
2. No hidden spread or undisclosed markup.
3. Live fees require an executed provider agreement, legal/compliance approval for the target jurisdiction, and clear pre-trade customer disclosure.
4. Provider/exchange/network/regulatory costs must be represented separately from MARS-X revenue.
5. Never represent simulated fee revenue as actual revenue.

## Paper-trading MVP
- watchlist
- instrument search
- market/chart view
- simulated cash balance
- buy/sell ticket
- market/limit order simulation
- portfolio and P/L
- order history
- MARS-X Engine analysis panel
- explicit PAPER / SIMULATION status throughout the flow

No claim that a user owns real securities or crypto.

## Provider-selection policy
Prefer a partner that can legally serve the target EEA market and provides embedded/white-label brokerage or an appropriate regulatory umbrella. Selection is commercial and compliance-gated; no provider is treated as approved merely because an API exists.

Evaluate:
- onboarding/setup minimums
- recurring minimums
- supported EEA countries
- legal role of MARS-X
- KYC/AML allocation
- custody/execution responsibility
- ability to charge a disclosed MARS-X fee or receive revenue share
- market-data costs
- sandbox quality
- API reliability
- exit/migration terms

## Live-trading gate
Live mode cannot be enabled until ALL are true:
- legal entity and target jurisdiction confirmed
- written provider approval/contract
- regulatory role documented
- KYC/AML flow approved
- custody/execution provider confirmed
- fee/revenue-share terms approved
- customer disclosures and terms approved
- privacy/data-processing review complete
- market-data licensing confirmed
- production security review complete
- reconciliation and incident procedures tested
- Google Play requirements satisfied

Failure of any gate = remain in PAPER mode.

## Google Play distribution gate
Before Broker/Wallet functionality is included in a Google Play release, re-check the current Play Console account type and policy classification. Google Play's current policy says developers providing financial products/services — including stock trading, cryptocurrency software wallets and cryptocurrency exchanges — must register as an Organization. Do not infer that identity verification alone satisfies this requirement.

For the Pool closed-test release, keep financial-service modules out of the release unless Play Console confirms the account/app is eligible. Paper/simulation labeling does not by itself prove that Google classifies the app outside the financial-services requirement.

Required evidence before enabling a financial-service release:
- Play Console account type verified as appropriate for the offered functionality;
- all required organization/contact/device verification completed where applicable;
- Financial features declaration / App Content answers match the shipped binary;
- Data Safety and privacy disclosures match actual data flows;
- no live trading, custody, deposits, withdrawals or crypto transfer paths unless separately approved.

## Cost policy
Development should reuse the current repository, CI and backend wherever safe. Do not purchase paid market data, broker infrastructure, licences, or new hosting merely to make Broker Beta function. Paid commitments require an explicit later decision.

## Visual standard
Broker uses the shared MARS-X dark foundation with purple/magenta accents. It must also satisfy the independent MARS-X visual release gate, accessibility, security, legal and platform requirements.

## Future migration
When a partner is approved, implement a provider adapter behind the router. Do not replace the paper engine; retain it for demos, testing and education. Live and paper accounts must never share balances or transaction records.
