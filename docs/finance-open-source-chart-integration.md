# MARS-X Finance: open-source chart integration plan

## Decision
Adopt TradingView Lightweight Charts (Apache-2.0) as an optional, offline-bundled advanced chart view, while retaining the existing native ChartView fallback until Android 8 emulator and physical-device tests pass.

- Source: https://github.com/tradingview/lightweight-charts
- Android wrapper: https://github.com/tradingview/lightweight-charts-android
- Android docs: https://tradingview.github.io/lightweight-charts/docs/android
- Alternate Android charts: https://github.com/PhilJay/MPAndroidChart

## Compatibility and legal requirements
- Project minSdk 26; upstream wrapper minSdk 23.
- Lightweight Charts 5.x requires an ES2020-capable Android System WebView/Chrome provider; test the installed WebView on Android 8 before enabling.
- Bundle assets locally; do not load executable JavaScript from third-party CDNs in a finance app.
- Preserve upstream LICENSE and NOTICE and display visible TradingView attribution with a link to https://www.tradingview.com/.
- Do not copy proprietary TradingView Advanced Charts, exchange app designs, brand marks or closed-source order-book implementations.

## Integration steps
1. Build a small native ChartEngine interface supporting candle snapshots, theme, timeframe, stale-data indicator and lifecycle teardown.
2. Keep existing ChartView as default/fallback. Add optional LightweightChartsWebView implementation using only local trusted assets.
3. Validate OHLCV values, timestamps, symbol, interval and ascending order before sending candles to the renderer. Do not show fabricated prices.
4. Render a clear no-data/stale-data state; avoid showing old values as live.
5. On pause/destroy stop streams and release WebView resources; do not expose Android JavaScript interfaces to untrusted pages.
6. Add chart interactions: crosshair, zoom, pan, volume, SMA/EMA overlays. Introduce RSI/MACD and drawing tools in separate, tested milestones.
7. Add Android API 26 smoke coverage, screenshot comparison, accessibility labels, orientation and background/resume tests.
8. Keep swaps, withdrawals and live order submission disabled until production partner authorization and security reviews pass.

## Size
Do not inflate the APK to 300 MB. Size is a ceiling/budget, not a feature. Track release APK, AAB, installed size and startup performance in CI.

## Acceptance criteria
- Chart renders on API 26 with bundled assets and no network access (using a static test fixture explicitly marked as test data).
- Live feed errors produce a visible error state; no fake live prices.
- Switching symbol/timeframe cannot show stale response from a previous selection.
- User can open/close chart repeatedly without leaking activity/WebView.
- LICENSE/NOTICE/TradingView attribution are included in distribution.
