# MARS-X Finance — Open-source component shortlist

Reviewed 2026-10-11. The Android app currently uses Java 17 and minSdk 26.

| Area | Source | License / compatibility | Decision |
| --- | --- | --- | --- |
| Indicators/backtesting | https://github.com/ta4j/ta4j | MIT; current ta4j requires Java 25+ | Do NOT add latest version to Android Java 17 build. Evaluate compatible release or isolate indicator calculations in backend. |
| Market tracking architecture | https://github.com/pranayairan/CoinBit | Apache-2.0; Kotlin, Room-based app | Architecture/reference only. Avoid wholesale source copy or outdated dependencies. |
| Watchlists and favorites | https://github.com/Patchett/CryptoBuddy | Check license and maintenance before reuse | Reference UI behavior; no code copying pending verification. |
| Encrypted data storage | https://github.com/TomWayne98/Krypt | Apache-2.0; Kotlin Multiplatform/Tink/Keystore | Evaluate dependency cost and compatibility with Java Android project. Existing SecureStore should be audited first. |
| Chart engine | https://github.com/tradingview/lightweight-charts | Apache-2.0; JavaScript/WebView compatibility testing required | See finance-open-source-chart-integration.md. |

## Implementation order

1. Stabilize existing API 26 installation and emulator smoke tests; keep debug APK and AAB builds reproducible.
2. Add market-data quality gates (timestamp, source, symbol, stale/error states, request sequencing).
3. Add indicators incrementally (SMA/EMA then RSI/MACD/ATR) with deterministic fixtures and unit tests.
4. Implement watchlists, portfolio read-only views, and search with local cache and explicit empty/loading/error states.
5. Audit SecureStore, authentication, logging, and secrets. Never embed private API keys in an APK.
6. Add offline demo and paper order previews with clear labels; production trades/withdrawals stay disabled.

## Acceptance criteria
- License and NOTICE attribution verified before adding any third-party code.
- No regression to current navigation, themes, chart view or Android 8 support.
- Java 17 compatible dependencies; no unnecessary native binaries.
- API outage never creates fake live market data or balances.
- No increase in permissions without a concrete need.
- APK size remains an optimization metric, not a target to pad to 300 MB.
