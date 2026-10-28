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


## Macro architecture and Black Swan Risk (experimental)

See [MARS-X Global Engine Architecture](../docs/MARS-X-GLOBAL-ENGINE-ARCHITECTURE.md) for the LQ, CR, GR, IN, PO, RK, FX, TraderSpy, Forward-Test and Gold Engine responsibility map, including what has **not** been verified.

The independent `black-swan-risk.js` calculates an **uncalibrated** systemic fragility index from four explicit 0–100 factors: fragility, shock sensitivity, liquidity stress and contagion correlation. Example:

```js
import { blackSwanRisk } from "./black-swan-risk.js";
const result = blackSwanRisk({
  fragility: 70, shockSensitivity: 80, liquidityStress: 60, correlation: 90,
  mode: "SIMULATION"
});
// result.score === 30.24 — NOT a 30.24% probability of a crash
```

For real observations use `mode: "OBSERVED"` with a timestamp (`asOf`) and independently verified factor inputs. Missing, stale or low-trust observations fail closed. This module does not modify execution, live trading, API routes, Android screens or real-time market feeds. Full macro factor adapters and historical calibration are still needed.
