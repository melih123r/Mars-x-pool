PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce_hash TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  used_at_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_nonces_expiry_idx ON auth_nonces(expires_at_ms);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  google_subject_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  referral_locked_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  install_id TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id,expires_at_ms);

CREATE TABLE IF NOT EXISTS user_workers (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL UNIQUE REFERENCES workers(worker_id) ON DELETE CASCADE,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (user_id,worker_id)
);

CREATE TABLE IF NOT EXISTS referral_codes (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  invitee_user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  referrer_user_id TEXT NOT NULL REFERENCES users(user_id),
  code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (invitee_user_id <> referrer_user_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_user_id);

CREATE TABLE IF NOT EXISTS referral_balances (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id),
  amount_units INTEGER NOT NULL DEFAULT 0 CHECK (amount_units >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  worker_id TEXT NOT NULL,
  payout_id TEXT NOT NULL,
  gross_units INTEGER NOT NULL,
  platform_fee_units INTEGER NOT NULL,
  referral_reward_units INTEGER NOT NULL,
  marsx_net_fee_units INTEGER NOT NULL,
  referrer_user_id TEXT REFERENCES users(user_id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fee_events_user_idx ON fee_events(user_id,created_at DESC);
