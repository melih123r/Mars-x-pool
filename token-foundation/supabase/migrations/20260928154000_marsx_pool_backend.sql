create schema if not exists marsx_pool;

revoke all on schema marsx_pool from public, anon, authenticated;

create table if not exists marsx_pool.workers (
  worker_id text primary key,
  data text not null,
  last_seen text not null,
  last_activity_ms bigint not null,
  dormant_at text
);

create index if not exists workers_last_seen_idx
  on marsx_pool.workers(last_seen);
create index if not exists workers_activity_idx
  on marsx_pool.workers(last_activity_ms);

create table if not exists marsx_pool.license_devices (
  license_id text not null,
  install_id text not null,
  bound_at text not null,
  primary key (license_id, install_id)
);

create table if not exists marsx_pool.balances (
  worker_id text primary key references marsx_pool.workers(worker_id) on delete cascade,
  amount_units bigint not null default 0 check (amount_units >= 0)
);

create table if not exists marsx_pool.dormant_balances (
  worker_id text primary key references marsx_pool.workers(worker_id) on delete cascade,
  amount_units bigint not null default 0 check (amount_units >= 0)
);

create table if not exists marsx_pool.payouts (
  id text primary key,
  worker_id text not null references marsx_pool.workers(worker_id) on delete cascade,
  status text not null,
  created_at text not null,
  updated_at text not null,
  refunded smallint not null default 0 check (refunded in (0, 1)),
  data text not null
);

create index if not exists payouts_worker_created_idx
  on marsx_pool.payouts(worker_id, created_at desc);

create table if not exists marsx_pool.payout_idempotency (
  worker_id text not null references marsx_pool.workers(worker_id) on delete cascade,
  idempotency_key text not null,
  payout_id text not null references marsx_pool.payouts(id) on delete cascade,
  primary key (worker_id, idempotency_key)
);

create table if not exists marsx_pool.ledger (
  id bigint generated always as identity primary key,
  worker_id text not null references marsx_pool.workers(worker_id) on delete cascade,
  event_type text not null,
  payout_id text,
  amount_units bigint not null,
  created_at text not null,
  data text not null
);

create index if not exists ledger_worker_created_idx
  on marsx_pool.ledger(worker_id, created_at desc);

create table if not exists marsx_pool.auth_nonces (
  nonce_hash text primary key,
  install_id text not null,
  expires_at_ms bigint not null,
  used_at_ms bigint,
  created_at text not null
);

create index if not exists auth_nonces_expiry_idx
  on marsx_pool.auth_nonces(expires_at_ms);

create table if not exists marsx_pool.users (
  user_id text primary key,
  google_subject_hash text not null unique,
  email text,
  display_name text,
  created_at text not null,
  updated_at text not null,
  referral_locked_at text,
  deleted_at text
);

create table if not exists marsx_pool.user_sessions (
  session_hash text primary key,
  user_id text not null references marsx_pool.users(user_id) on delete cascade,
  install_id text not null,
  expires_at_ms bigint not null,
  created_at text not null,
  revoked_at text
);

create index if not exists user_sessions_user_idx
  on marsx_pool.user_sessions(user_id, expires_at_ms);

create table if not exists marsx_pool.user_workers (
  user_id text not null references marsx_pool.users(user_id) on delete cascade,
  worker_id text not null unique references marsx_pool.workers(worker_id) on delete cascade,
  linked_at text not null,
  primary key (user_id, worker_id)
);

create table if not exists marsx_pool.referral_codes (
  user_id text primary key references marsx_pool.users(user_id) on delete cascade,
  code text not null unique,
  created_at text not null
);

create table if not exists marsx_pool.referrals (
  invitee_user_id text primary key references marsx_pool.users(user_id) on delete cascade,
  referrer_user_id text not null references marsx_pool.users(user_id),
  code text not null,
  created_at text not null,
  check (invitee_user_id <> referrer_user_id)
);

create index if not exists referrals_referrer_idx
  on marsx_pool.referrals(referrer_user_id);

create table if not exists marsx_pool.referral_balances (
  user_id text primary key references marsx_pool.users(user_id),
  amount_units bigint not null default 0 check (amount_units >= 0),
  updated_at text not null
);

create table if not exists marsx_pool.fee_events (
  event_id text primary key,
  user_id text not null references marsx_pool.users(user_id),
  worker_id text not null,
  payout_id text not null,
  gross_units bigint not null,
  platform_fee_units bigint not null,
  referral_reward_units bigint not null,
  marsx_net_fee_units bigint not null,
  referrer_user_id text references marsx_pool.users(user_id),
  created_at text not null
);

create index if not exists fee_events_user_idx
  on marsx_pool.fee_events(user_id, created_at desc);

alter table marsx_pool.workers enable row level security;
alter table marsx_pool.license_devices enable row level security;
alter table marsx_pool.balances enable row level security;
alter table marsx_pool.dormant_balances enable row level security;
alter table marsx_pool.payouts enable row level security;
alter table marsx_pool.payout_idempotency enable row level security;
alter table marsx_pool.ledger enable row level security;
alter table marsx_pool.auth_nonces enable row level security;
alter table marsx_pool.users enable row level security;
alter table marsx_pool.user_sessions enable row level security;
alter table marsx_pool.user_workers enable row level security;
alter table marsx_pool.referral_codes enable row level security;
alter table marsx_pool.referrals enable row level security;
alter table marsx_pool.referral_balances enable row level security;
alter table marsx_pool.fee_events enable row level security;

revoke all on all tables in schema marsx_pool from public, anon, authenticated;
revoke all on all sequences in schema marsx_pool from public, anon, authenticated;

alter default privileges in schema marsx_pool
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema marsx_pool
  revoke all on sequences from public, anon, authenticated;
