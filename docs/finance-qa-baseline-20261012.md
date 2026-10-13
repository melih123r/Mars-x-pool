# MARS-X Finance — Baseline & competitive QA (2026-10-12)

## Saved decisions
- No arbitrary limit on functional modules, chart count or source lines.
- APK target: under 1 GB; 200–300 MB is acceptable only when justified by real features, never artificial padding.
- Build the core before adding superficial features: reliable market feeds, smooth charts, 4 GB RAM stability, security and accessibility.
- Never represent a public exchange order book as MARS-X's own executable liquidity.
- Trading, swaps, withdrawals and custody remain disabled until provider authorization, jurisdictional checks and end-to-end security testing pass.
- No bypass of KYC, API quotas, licensing or secrets management.
- Each QA report must contain exact HEAD SHA, workflow run IDs, PASS/FAIL/BLOCKED, verified APK artifact URL, actual size and device evidence. Never infer success from an old SHA.

## Competitor comparison (official developer docs)
| Platform | Confirmed capability | MARS-X gap / action |
|---|---|---|
| Binance Spot | diff-depth streams, snapshots, update IDs | implement backend-owned snapshot+stream reconciliation, gap resync, stale veto |
| Coinbase Exchange | level2 feed, heartbeat, real-time book | reconnect and heartbeat, no fake 'live' state; use central server relay |
| Kraken WS v2 | L2 book, depth subscription, CRC32 checksum | implement provider-specific checksum validation and resnapshot |
| Coinbase Advanced | real-time depth, interactive charts, advanced order types | improve visual interaction; keep limit/stop orders in simulation until execution partner |

Official references:
- https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md
- https://help.coinbase.com/en/developer-platform/websocket-feeds/exchange
- https://docs.kraken.com/api/docs/websocket-v2/book/
- https://help.coinbase.com/en/getting-started/other/coinbase-vs-coinbase-advanced

## Next QA gates
1. Inventory PR #20, #32, #33, #34, #37, #55, #56 with exact head SHAs and merge conflicts; report individually.
2. Android SDK 26 compatibility, Android 16 cold-start, ANR, memory and scroll/render frame times on physical 4 GB RAM.
3. Compare screenshots at matching dimensions against approved Reference +1; label unmeasured as BLOCKED.
4. Backend-controlled market-data relay: rate limits, data licensing, geo-policy, stale timestamps, reconnect jitter and provider fallback.
5. Signing continuity, unsigned-vs-signed AAB distinction, reproducible build, secret scans and dependency audit.
6. Separate demo order engine from any real execution; ensure non-executable states are visible and enforced server-side.

## Historical status disclaimer
Prior QA reported passing CI and a debug APK, but none of those historical observations prove that a newer HEAD has passed. The authoritative status must be retrieved per-run.
