# MARS-X Learning Data Policy (technical contract)

MARS-X learning is opt-in only. Training events are accepted only after explicit analytics-training consent with a consent version and acceptance timestamp.

The learning event allowlist excludes user IDs, names, email addresses, wallet addresses, API credentials and raw account identifiers. Notional is intended to be bucketed before ingestion. Small cohorts are withheld until the configured minimum cohort is reached.

Users may use the product without enabling analytics training. Revoking consent stops future training ingestion. Model weights and proprietary strategy parameters are server-side and are not returned by public API endpoints.

This policy does not enable live trading, withdrawals or custody.
