# Competitor benchmark and product boundary

MARS-X combines the useful patterns of current remote-mining products without copying their branding, source code or misleading claims.

| Pattern | Reference products | MARS-X decision |
| --- | --- | --- |
| Simple onboarding | CT Pool, GoMining | Keep setup short, but never show mining or earnings without a verified worker and accounting source. |
| Remote rig control | NiceHash, Hive OS | Add signed worker commands only after a real worker agent and authorisation model exist. |
| Pool/account monitoring | F2Pool, ViaBTC, Miner Box | Prioritise worker status, heartbeat freshness, pool adapter data and alerts. |
| Profit and fee transparency | GoMining, ViaBTC | Show gross contribution, every fee, net result and assumptions; never guarantee ROI. |
| Payout history | NiceHash, ViaBTC | Real payouts require immutable ledger entries and network transaction identifiers. Beta uses `USDT_TEST` only. |

## Explicitly rejected patterns

- On-device Android mining or hidden background computation
- Fabricated hashrate, balance or earnings
- Forced daily taps that silently stop a paid service
- Hidden maintenance or withdrawal fees
- Confiscating dormant user balances as company revenue
- Multi-level recruitment presented as mining output
- Real-value payouts before KYC/AML, custody and payment controls exist
