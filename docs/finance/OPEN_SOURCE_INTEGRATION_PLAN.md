# MARS-X Finance: approved open-source integration candidates

Status: research and dependency selection only. No third-party source files have been copied or compiled. Keep Finance isolated from the Pool Beta application.

## Android charts
- Upstream: https://github.com/tradingview/lightweight-charts-android
- Maven: com.tradingview:lightweightcharts:5.2.0
- License: Apache-2.0 with required TradingView attribution and NOTICE link.
- Minimum SDK 23; ES2020-capable WebView required.
- Integration target: standalone Finance Android module, not Pool app.

## Live order book reference
- Upstream: https://github.com/baruckis/CryptoLive
- License: Apache-2.0; verify dependencies individually.
- Reimplement snapshot + delta sequencing, gap detection, reconnect, stale-data veto using Kotlin Flow; do not copy obsolete API endpoints blindly.

## UI architecture reference
- Upstream: https://github.com/sisovin/cryptoapp
- Compose, MVVM, Room, StateFlow architecture. Confirm LICENSE file before copying any implementation.

## Explicit exclusions
- openware/baseapp: README states non-commercial-only license without a separate commercial license.
- Never copy proprietary Binance, Bybit or OKX code.
- Never embed API keys, custody secrets, production order routing or signing keys in the APK.

## Acceptance gates
1. Confirm Finance module structure and license files.
2. Add isolated Android chart dependency and attribution.
3. Unit-test snapshot/delta book reconciliation and reconnect behavior.
4. Connect public market-data read-only APIs; simulate order placement only.
5. Run Gradle build, instrumentation tests, and inspect signed APK before claiming completion.
