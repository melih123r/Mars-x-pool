# MARS-X Finance — Unified implementation backlog (2026-10-11)

## Verified code additions
- Chart SMA8/EMA20 overlays (3c71d9f)
- Selectable indicator tool (da50778)
- Touch crosshair and OHLC inspection (06c77fb)

## Delivery gates (not yet completed)
1. Compile debug APK; Android lint and instrumentation smoke test; record size and checksum.
2. Chart interaction: pinch zoom, pan, crosshair timestamp, full-screen, drawing undo/redo, persistent tool settings.
3. Chart engine evaluation: benchmark native Canvas against TradingView Lightweight Charts Android 5.2.0 in isolated branch; retain attribution and NOTICE if integrated.
4. Indicators: RSI/MACD separate panes, Bollinger, VWAP/anchored VWAP, volume profile, ATR; deterministic fixtures.
5. Multi-exchange data hub: source normalization, currency/pair mapping, timestamp alignment, stale checks, reconnection, sequence gap recovery; show source/latency.
6. Comparison: normalized overlay, relative strength, correlation, synthetic symbols with safe formula parser.
7. Market microstructure: order-book depth, spread and execution-cost simulations; label model estimates. Footprint/heatmap only with verified historical depth/trade data.
8. Trading lab: replay, paper orders, risk/reward tool, portfolio stress, journal, alert rules.
9. Workspaces: saved drawings, indicator presets, multi-chart layouts, accessible high contrast.
10. Security/compliance: keep live order/swap/withdrawal disabled pending partner authorization, KYC/AML and E2E sign-off.

## Definition of done
Feature implemented, tests pass, real Android build produced, source provenance and failure states shown, no demo values presented as live, APK artifact independently downloadable.

## Reference
https://tradingview.github.io/lightweight-charts/docs/android
https://tradingview.github.io/lightweight-charts/docs/plugins/intro
