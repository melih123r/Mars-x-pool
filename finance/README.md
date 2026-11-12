# MARS-X Finance storage boundary

This directory contains an isolated PostgreSQL schema for read-only provider data and paper/test order records.

- provider_accounts stores only a provider name, a one-way account reference hash, access mode, and KYC/AML state.
- portfolio_snapshots and quotes have bounded JSON payloads and per-account idempotency keys.
- test_orders is constrained by PostgreSQL to TEST_ONLY and is_executable = false.
- audit_log is append-only through a mutation-rejection trigger.

The migration intentionally uses the separate marsx_finance schema and never modifies Pool or Telegram tables. It contains no brokerage execution, transfer, swap, wallet-signing, credential storage, or production-order path. Apply it only after review by an authorized database operator.
