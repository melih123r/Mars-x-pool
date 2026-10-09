# MARS-X ChangeNOW — Engine Product Design

Status: DEVELOPMENT / READ-ONLY
Scope: Engine only. No Pool, VRSC, custody, payout or live transaction execution.

## Product surface
A dark Mars-themed conversion terminal powered by the MARS-X Engine. The UI must never imply that MARS-X is holding customer assets or that an exchange is executable while executionReady=false.

### Header
- MARS-X mark + "Convert"
- provider badge: ChangeNOW
- mode badge: READ ONLY
- connection state from /changenow/health

### Conversion card
- From asset + network selector
- Amount
- To asset + network selector
- Swap direction control (presentation only)
- Estimated receive amount
- Rate
- Minimum amount
- Network/provider fee when returned
- Quote freshness / expiry
- Primary CTA:
  - development: "Preview quote"
  - production-disabled: "Trading unavailable"
  - never show "Swap" while executionReady=false

### Market context
- MARS-X chart directly below quote card
- Timeframes: 1m / 5m / 15m / 1h / 4h / 1D / 1W
- Price/quote marker must distinguish market/reference price from executable ChangeNOW estimate
- stale-data badge when quality gate fails

### Safety states
- API credential missing: "Provider connection pending"
- unsupported pair/network: actionable validation message
- below minimum: show required minimum
- rate limited: retry message without exposing provider response secrets
- provider unavailable: keep Engine alive; disable quote CTA
- expired quote: visually invalidate estimate
- all provider errors sanitized

## Data contract
Read-only endpoints:
- GET /changenow/health
- GET /changenow/currencies
- GET /changenow/min-amount
- GET /changenow/quote

Required UI model:
- provider
- mode
- configured
- executionReady
- fromCurrency/fromNetwork
- toCurrency/toNetwork
- fromAmount
- estimatedAmount
- rate
- minAmount/maxAmount
- fee/networkFee when supplied
- validUntil / expired
- quality/freshness

## Execution gate
Live transaction creation remains absent from the public API. Enabling it later requires a separate approved execution adapter, production partner credential, compliance/security review, idempotency, webhook verification, ledger/reconciliation and explicit rollout approval.

## Visual language
- near-black/navy canvas
- warm Mars amber/orange as primary accent
- green only for healthy/verified states
- red only for errors/blocked execution
- glass-like cards, compact numeric typography, high contrast
- no fake balances, earnings, prices, fills or transaction IDs

## Acceptance criteria
1. UI can be rendered completely with execution disabled.
2. Missing API credential never crashes the Engine.
3. Quote/minimum/currency errors are sanitized.
4. No secret appears in logs or client responses.
5. No POST transaction endpoint exists in read-only release.
6. Quote expiry/staleness is visible.
7. Network selection is explicit for multi-network assets.
8. Engine remains provider-neutral; ChangeNOW is one adapter, not core business logic.
