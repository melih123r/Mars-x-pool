# MARS-X Finance + Network — release acceptance gates (2026-10-18)

Status: **NOT RELEASE READY**. This checklist is a specification, not proof of implementation or successful tests.

## P0 / must pass before demo APK delivery
- [ ] Consolidate chart branches (types, indicators, RSI14, MACD, EMA, SMA, Bollinger, paper order, horizontal levels) with reviewed diffs and conflict resolution.
- [ ] Candlestick, line and area rendering; 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 1w, 1mo. Verify timeframe aggregation with timezone/calendar boundaries and no lookahead.
- [ ] Volume, SMA, EMA, RSI, MACD and Bollinger indicators match independently calculated fixtures; handle warm-up periods and missing candles.
- [ ] Paper market/limit buy/sell: deterministic balance, reserved funds, fees, weighted average cost, realized/unrealized P&L; idempotent fills and cancellations. Test partial fills, insufficient funds, stale quotes, zero/negative prices, rounding and app restart.
- [ ] Pending/open/filled/cancelled orders; order overlays, buy/sell markers, SL/TP overlays; prevent double triggering and invalid stop/target combinations.
- [ ] Confirm 1000 catalog symbols have unique canonical identifiers and map to actual provider feeds; mark delayed/unavailable feeds explicitly. Never call static catalog live market data.
- [ ] Finance and Network reachable from one Android application ID; build signed test APK/AAB; clean install, upgrade, launch, back navigation and offline tests on supported Android versions.
- [ ] Disable real trades, withdrawals and swaps unless written partner authorization, jurisdiction checks, KYC/AML and end-to-end security tests are confirmed.

## P1 / before public release
- [ ] Search and filter by symbol, exchange and asset class; handle duplicate tickers across venues.
- [ ] Order book from genuine provider depth with sequence/gap handling, timestamps and reconnect logic; label simulated depth.
- [ ] Portfolio performance history, timestamped valuation and fee accounting.
- [ ] Price alerts with opt-in permissions, deduplication and background delivery.
- [ ] Five distinct accessible page themes, legible labels, minimum touch target sizes and smooth navigation.
- [ ] Telegram workers: authenticated intake, configured executors, deduplication, retry, queue persistence and actual end-to-end response test.

## Evidence required for each gate
Commit SHA / PR, test command, pass/fail logs, source of market data, screenshot or device recording, APK SHA256 and size, install/launch results, known issues. Do not report completion based on branch names or APK file size alone.
