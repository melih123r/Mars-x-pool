# Provider verification matrix

No row in this file makes an asset LIVE. Runtime enablement requires real provider telemetry plus reconciliation.

| Asset | Candidate provider | Adapter status | Credential mode | Settlement status | Public LIVE |
|---|---|---|---|---|---|
| LTC | ViaBTC | read-only adapter prepared | Railway secret | unverified | NO |
| DOGE | ViaBTC merged mining | read-only adapter prepared | Railway secret | unverified | NO |
| VRSC | LuckPool candidate | provider-specific adapter required | TBD/read-only | unverified | NO |
| XMR | MoneroOcean candidate | provider-specific adapter required | public/read-only where supported | unverified | NO |
| ZEPH | provider selection pending | not integrated | TBD | unverified | NO |
| QUBIC | QLI candidate | provider-specific adapter required | TBD/read-only | unverified | NO |

## Hard gates

- Google Play client is controller-only; no handset cryptocurrency mining.
- Provider-confirmed settlement reference is required before spendable credit.
- Settlement references must be deduplicated durably.
- Reconciliation must match provider totals before credit release.
- Withdrawals, payouts and custody stay disabled.
- A generic REST adapter is not evidence that a provider is integrated.
- Provider-specific schemas/endpoints must be verified against the real provider before enabling an asset.
- Secrets belong only in server-side runtime secret storage; never in the Android client, repository, logs or chat.
