# MARS-X Engine — Core architecture and Black Swan Risk (2026-10-28)

## Scope and evidence

Target: `melih123r/Mars-x-pool`, branch `marsx-global-engine-v01`.
This document describes an **architecture**, not a claim that all components are deployed or validated. Source: owner's MARS-X model (French 14-page macro/visual-scan specification) and confirmed repository files. The source model's `GR` acronym for growth is distinguished from the newer **Global Regime Engine (GR)** label; economic growth remains a macro input rather than silently being removed.

| Module | Intended responsibility | Repository evidence / current maturity |
| --- | --- | --- |
| LQ (Liquidity) | Global M2, Fed/ECB, TGA, real rates | `macro-collector.js` has limited UST/ECB fetches; full LQ scoring is **not verified** |
| CR (Credit Rating) | CDS, ratings, HY/IG spreads, funding | Model specified; full live CR scoring **not verified** |
| GR (Global Regime) | Macro regimes and transitions | `regime.js` contains a basic price/volatility/liquidity regime classifier; complete macro regime engine **not verified** |
| IN (Intelligence) | Signal agreement, normalization, trust, confidence | `confidence.js`, `consensus.js`, `model-registry.js` exist; PDF-wide fusion **not verified** |
| PO (Portfolio) | NAV, concentration, attribution, allocations | `portfolio-analytics.js`, `risk-budget.js`, `risk-terminal.js` exist; broker reconciliation **not verified** |
| RK (Risk) | Spread/stale veto, risk budgets, VaR/drawdown | `risk.js`, `risk-analytics.js`, `risk-budget.js` contain actual risk code; no production trading approval |
| FX Engine | FX reference prices, carry, rates and cross FX | `adapters/public-fx.js` is reference-only; carry/funding engine **not verified** |
| TraderSpy Validation | External derivative signals and cross-checks | PR #251 is a **draft documentation-only** proposal, no verified live API |
| Forward-Test | Lock signals at T0 and compare to realized outcomes | `backtest.js`, `walk-forward.js` exist; production forward-test ledger **not verified** |
| Black Swan Risk | F × S × L × C systemic fragility | `black-swan-risk.js` implemented as **pure experimental analytic**, no automatic feeds or execution |

## Experimental Black Swan Risk

Four higher-is-worse inputs on the closed scale `[0,100]`:

- `fragility`: leverage, debt, concentration, counterparty concentration;
- `shockSensitivity`: exposure to rate, geopolitical and funding shocks;
- `liquidityStress`: spread, market depth, repo/funding pressure;
- `correlation`: contagion / joint downside sensitivity, **not** the raw signed Pearson coefficient.

The uncalibrated index is:

`BSR = 100 * (F/100) * (S/100) * (L/100) * (C/100)`

The code deliberately **does not** generate four factors from arbitrary market prices. Separate factor construction, point-in-time data, backtesting and regime calibration are required before use as a live alert. This is not the probability of an extreme event. Bands (`LOW` under 10, `ELEVATED` under 25, `HIGH` under 50, `EXTREME` otherwise) are **heuristics**, not empirically calibrated thresholds. The multiplicative result can be zero when any one input is zero, even while other risks remain extreme: always use the existing independent Crash Warning Engine / stress overlays, never BSR alone.

`OBSERVED` inputs require valid timestamps and fail closed on stale data or low trust. Insufficient data returns `score: null`, not a fabricated 0. Input `quality` influences a **separate trustFactor** and can veto observed evaluation; it does not falsely make the market safer by reducing the risk score.

## Portfolio and multi-horizon governance

- The reference NAV of **USD 1,000,000** is a **simulation**, not a real or managed account.
- Risk budget: maximum requested 3% before confidence/correlation adjustment; risk sizing remains paper-only.
- Coverage: stocks, indices, bonds/rates, FX, gold/commodities, crypto and derivatives, only where authorized data are available.
- Monitoring horizons: 3, 5, 15, 30, 45, 60 minutes; **1W** for long-range XAU/USD research. Neither an absent interval nor an absent feed may be represented as supported live data.
- Strategy modes: `MAX-FLOW` (higher qualified candidate throughput), `PRECISION` (stricter confidence and correlation veto), `SHADOW` (unexecuted baseline). These are target policies, **not** proof of live implementations.
- Before comparing predictions with outcomes: record source, timestamp, timeframe, signal/expected range, state of data quality, stale veto, validation window, instrument and cluster; **lock** the forecast and forbid retroactive rewriting.
- Report directional hit rate, calibration, MFE/MAE, drawdown, risk-adjusted return and data availability. Disclose unresolved predictions rather than counting them as wins.

## Gold Engine (XAU/USD) model weights from the French specification

- Real yields 25%; USD/DXY 20%; central bank demand 15%; geopolitics 15%; monetary/fiscal credibility 10%; liquidity 10%; positioning 5%.
- Gold price is not determined by CPI alone; real yields and the USD matter.
- The requested 1W / 5-year chart must separate **verified historical candles**, **as-of spot quote**, and **modelled forward paths** (bear/base/bull). Each scenario needs triggers, invalidation, data provenance and calibration status. **Do not imply the 2031 paths are live forecast evidence**.

## Integration topology and safety gates

`Feed → quality / freshness / permissions → LQ / CR / GR / IN / FX / Gold → RK + BSR (separate overlays) → PO scenario sizing → forecast lock → forward validation → Android READ_ONLY dashboard`.

No execution or custody is enabled by this specification. Broker/API secrets must stay server-side. No orders, leveraged positions, withdrawals, or APK/Play release operations are authorized by the new BSR module. Risk alarms may warn, but a production hard veto requires calibrated policy, independent review and tests.

## Next implementation gates

1. Verified point-in-time market/macro adapters and data licensing per factor.
2. Historical calibration for BSR risk bands and crash definition; leakage-safe walk-forward tests.
3. A read-only API with explicit `SIMULATION`/`OBSERVED`, factor timestamps, source and trust, protected against public misuse.
4. Android chart integration with source labels, weekly timeframe, scenario bands, stale warnings and accessibility QA.
5. Confirm PR #251 provider permission and move TraderSpy from documentation to tested, permissioned integration only when approved.
