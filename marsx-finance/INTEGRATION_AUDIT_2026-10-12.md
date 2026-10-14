# MARS-X Finance — Integration audit (2026-10-12)

## Verified project state
- Unified Android module: `marsx-finance/exchange-ui`, applicationId `com.marsx.finance`, Android 8+.
- Native Compose Canvas OHLC chart; public BTC/USDT ticker, depth, kline; paper-only trading.
- No real trading, customer custody, swaps or withdrawals enabled.
- Older standalone Finance module remains in repository as reference; single APK CI builds exchange-ui.
- A successful unified APK existed on run 38255577750; subsequent changes require fresh CI and device verification.

## Ready-made components evaluated
1. Binance official market-data-only API (public REST `data-api.binance.vision`, WebSocket `data-stream.binance.vision`): usable without API key for ticker/depth/klines; already integrated. Docs: https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md
2. TradingView Lightweight Charts Android v5.2.x: Apache-2.0, minSdk 23, requires Android System WebView ES2020; integration requires Android SDK/Gradle compatibility check and attribution. Current native chart stays until a passing replacement is verified. Docs: https://tradingview.github.io/lightweight-charts/docs/android
3. ChangeNOW: partner email says project verification completed on 2026-10-06, but eligibility for individual developer, commission payouts, production transaction access, licensing/compliance, and actual fees are NOT confirmed. Do not turn on live swaps.
4. Replit/Lovable: GitHub OAuth access emails confirm authorizations only, not completed deliverables or integrated code.

## Prioritized backlog
P0: latest unified APK CI success; install and smoke-test on Android; crash logs and connectivity errors.
P0: data freshness timestamp, stale-market warning and paper-trade veto; offline handling.
P0: paper-trade ledger with persisted transaction history, reset, and valuation tests.
P1: multi-symbol selector and per-symbol chart/orderbook/WebSocket lifecycle.
P1: accessible order entry, precision/rounding, balance constraints, portfolio P&L.
P1: chart zoom/pan/crosshair/indicators; evaluate TradingView wrapper after dependency compatibility tests.
P2: partner integration behind explicit feature flags and authorization; secure server-side credentials, never in APK.
P2: localization, onboarding, privacy/legal screens, release signing, Play policy review.

## Acceptance gates
- No simulated feature represented as real; no fabricated price/order-book data.
- Never copy proprietary broker UIs/code; integrate only licensed components and keep notices.
- Each feature must have code commit, CI success, and Android device smoke test before calling it done.
- No financial live execution before explicit partner permissions and jurisdiction-specific compliance.

## Follow-up audit — 2026-10-12
- Alpaca support reply dated Oct 11, ticket 371580: apply using https://alpaca.markets/broker-contact-form for sales team follow-up. This is NOT approval or production access.
- ChangeNOW correspondence: prior verification confirmation exists; no new definitive production authorization or partner fee agreement confirmed in the searched messages.
- TradingView Android wrapper latest GitHub tag v5.2.1 (Oct 8); official installation documentation currently illustrates Maven coordinate `com.tradingview:lightweightcharts:5.2.0`. Do not pin v5.2.1 until Maven artifact is confirmed. License Apache-2.0 and TradingView attribution notice/link required.
- Binance official docs https://github.com/binance/binance-spot-api-docs provide supported REST/WS specifications and connectors; continue market-data-only integration without credentials.
- Android CI on commit 49db6e4 was still in progress at check time. Do not advertise the latest APK as tested.

### Integration acceptance plan
1. Validate Android wrapper Maven dependency resolution and compileSdk against existing Kotlin/AGP versions in a separate branch; retain native Canvas fallback.
2. Adapt Binance market-data parser using official documented endpoints and instrument precision; unit-test malformed/stale data.
3. Submit Alpaca broker-contact form only with accurate entity/representative information; do not claim existing regulatory authorization.
4. Obtain written ChangeNOW production scope, regional restrictions, KYC responsibilities, fee schedule and compliance approval before live transactions.
