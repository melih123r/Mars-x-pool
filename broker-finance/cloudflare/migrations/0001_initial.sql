PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_activity_ms INTEGER NOT NULL,
  dormant_at TEXT
);

CREATE INDEX IF NOT EXISTS workers_last_seen_idx ON workers(last_seen);
CREATE INDEX IF NOT EXISTS workers_activity_idx ON workers(last_activity_ms);

CREATE TABLE IF NOT EXISTS license_devices (
  license_id TEXT NOT NULL,
  install_id TEXT NOT NULL,
  bound_at TEXT NOT NULL,
  PRIMARY KEY (license_id, install_id)
);

CREATE TABLE IF NOT EXISTS balances (
  worker_id TEXT PRIMARY KEY REFERENCES workers(worker_id) ON DELETE CASCADE,
  amount_units INTEGER NOT NULL DEFAULT 0 CHECK (amount_units >= 0)
);

CREATE TABLE IF NOT EXISTS dormant_balances (
  worker_id TEXT PRIMARY KEY REFERENCES workers(worker_id) ON DELETE CASCADE,
  amount_units INTEGER NOT NULL DEFAULT 0 CHECK (amount_units >= 0)
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  refunded INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS payouts_worker_created_idx ON payouts(worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payout_idempotency (
  worker_id TEXT NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id TEXT NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payout_id TEXT,
  amount_units INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ledger_worker_created_idx ON ledger(worker_id, created_at DESC);
