CREATE TABLE IF NOT EXISTS license_devices (
  license_id TEXT NOT NULL,
  install_id TEXT NOT NULL,
  bound_at TEXT NOT NULL,
  PRIMARY KEY (license_id, install_id)
);

CREATE INDEX IF NOT EXISTS idx_license_devices_license
  ON license_devices (license_id);

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  install_id TEXT NOT NULL,
  label TEXT NOT NULL,
  platform TEXT NOT NULL,
  cpu_percent REAL,
  hashrate REAL,
  registered_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  last_activity_ms INTEGER NOT NULL,
  dormant_at TEXT,
  reactivated_at TEXT,
  session_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workers_license
  ON workers (license_id);

CREATE INDEX IF NOT EXISTS idx_workers_last_activity
  ON workers (last_activity_ms);

CREATE TABLE IF NOT EXISTS balances (
  worker_id TEXT PRIMARY KEY,
  units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dormant_balances (
  worker_id TEXT PRIMARY KEY,
  units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  moved_at TEXT NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount_units INTEGER NOT NULL CHECK (amount_units > 0),
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  sandbox INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (worker_id, idempotency_key),
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payouts_worker
  ON payouts (worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_units INTEGER NOT NULL,
  balance_units INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ledger_worker
  ON ledger (worker_id, created_at DESC);
