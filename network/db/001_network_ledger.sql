-- MARS-X Network pilot ledger schema (minimum 1,000 users).
-- Apply manually to an approved PostgreSQL database after review.
-- All balances are FIAT MINOR UNITS (EUR/USD cents), never on-chain USDC.
-- No private keys, conversion, payment execution or network traffic here.
BEGIN;
CREATE TABLE IF NOT EXISTS network_accounts (
  user_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version TEXT,
  consent_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (consent_at IS NULL OR consent_version IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS network_revenue_receipts (
  receipt_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  partner_reference TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD')),
  settled_minor BIGINT NOT NULL CHECK (settled_minor >= 0),
  platform_minor BIGINT NOT NULL CHECK (platform_minor >= 0),
  users_minor BIGINT NOT NULL CHECK (users_minor >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (platform_minor + users_minor = settled_minor),
  CHECK (platform_minor = settled_minor / 5),
  UNIQUE(partner_id,partner_reference)
);
CREATE TABLE IF NOT EXISTS network_ledger_entries (
  entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES network_accounts(user_id),
  receipt_id TEXT REFERENCES network_revenue_receipts(receipt_id),
  idempotency_key TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD')),
  -- Signed: positive for credits, negative for reservation/debits.
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN
    ('settled_credit','payout_reservation','payout_release','payout_settlement','correction')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS network_ledger_user_currency_time
 ON network_ledger_entries(user_id,currency,created_at);
CREATE TABLE IF NOT EXISTS network_payout_requests (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES network_accounts(user_id),
  idempotency_key TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  asset TEXT NOT NULL DEFAULT 'USDC' CHECK (asset = 'USDC'),
  chain TEXT NOT NULL CHECK (chain IN ('solana','base','polygon')),
  destination_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'blocked_partner_approval'
    CHECK (status IN ('blocked_partner_approval','reserved','submitted','settled','failed','cancelled')),
  provider_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS network_payout_user_time
 ON network_payout_requests(user_id,created_at);
COMMIT;
