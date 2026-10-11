# MARS-X Finance — exchange infrastructure open-source research

Research date: 2026-10-11.

## Candidate projects
- XChange: https://github.com/knowm/XChange — MIT, Java exchange adapters, REST and selected WebSocket feeds. Prefer backend-only read-only market data adapter. Do not place private credentials in the APK.
- CryptoLive: https://github.com/baruckis/CryptoLive — Apache-2.0 Android order book example. Reference WebSocket reconnect, state handling, and UI; check age of dependencies before reuse.
- exchange-core: https://github.com/exchange-core/exchange-core — high-throughput Java matching/risk engine; not required for a partner-backed broker client and should not be deployed for live trading without a separate business/legal/operational decision.
- Sans Finance: https://github.com/nichsedge/sansfinance — modern Android portfolio architecture reference; verify license and dependencies before code reuse.
- Mobile banking security example: https://github.com/dheveshcodes/Security-Measures-for-a-Mobile-Banking-Application — MIT; reference for Keystore, sessions, biometric authentication, and MASVS-aligned tests. Pinning requires planned rotation/failover.

## Proposed implementation
1. Backend market-data adapter for public tickers and depth snapshots, with provider attribution and timestamps.
2. WebSocket depth handling with sequence checks, resync, backoff, heartbeat and strict bounds on memory/queue size.
3. Android read-only order-book UI, bids/asks spread, volume and last-update indicator; no simulated data labelled as live.
4. Portfolio read-only data model, local watchlist and privacy-mask toggle.
5. Security review of existing SecureStore and token lifecycle; do not use sample security code without tests.

## Gates
- No real orders, swaps, withdrawals or account changes in this milestone.
- Check upstream license/NOTICE, transitive dependencies, Android 8 compatibility and maintenance.
- Unit tests: out-of-order sequence, missing snapshot, disconnect/reconnect, stale feed, negative/NaN quantities, malformed JSON.
- Preserve existing FinanceActivity, native chart fallback, app navigation and themes.
- Size target is a ceiling, not a requirement to pad the binary.
