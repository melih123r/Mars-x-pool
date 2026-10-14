# MARS-X Global Execution Engine v0.1

Experimental asset-agnostic execution and routing core, isolated from MARS-X Pool.

## Current capabilities
- Universal instrument/order/quote model
- Crypto: Coinbase + Kraken public read-only market data
- Equity/ETF: Alpaca read-only market data when environment credentials are present
- FX: public reference-rate adapter (indicative, not executable)
- Quote normalization and stale-data veto
- Median/outlier consensus filtering
- Spread-risk veto
- Venue health/failure/latency tracking
- Best effective-price routing
- Paper execution primitives
- Read-only HTTP API

## API
`GET /health`
`GET /quote?symbol=BTC-USD&assetClass=CRYPTO&side=BUY&amount=1000`
`GET /route?symbol=BTC-USD&assetClass=CRYPTO&side=BUY&amount=1000`

Run: `npm run global-engine:start`
Test: `npm run global-engine:test`

## Safety boundary
No custody, withdrawals, leverage or live order submission is enabled. Public FX is reference/indicative data only. Live adapters reject `placeOrder()`. Secrets belong in environment variables only.
