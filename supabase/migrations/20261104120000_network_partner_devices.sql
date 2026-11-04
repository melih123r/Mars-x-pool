-- Network partner boundary. Apply only after reviewing the existing Supabase project.
-- The Android client never receives a TraffMonetizer publisher token.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  demo_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  partner_device_id text,
  platform text not null default 'android',
  app_version text,
  consent_state text not null default 'none'
    check (consent_state in ('none','demo','live_requested','revoked')),
  live_enabled boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id),
  unique (partner_device_id)
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  consent text not null check (consent in ('demo','live_requested','revoked')),
  policy_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.traffic_reports (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete restrict,
  partner_name text not null default 'traffmonetizer',
  partner_report_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  eligible_bytes bigint not null check (eligible_bytes >= 0),
  settled_minor bigint not null default 0 check (settled_minor >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','reversed')),
  received_at timestamptz not null default now(),
  unique (partner_name, partner_report_id)
);

create table if not exists public.earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  traffic_report_id uuid references public.traffic_reports(id) on delete restrict,
  entry_type text not null check (entry_type in ('settled_credit','platform_fee','payout_reservation','payout_release','payout_settlement','reversal')),
  gross_minor bigint not null default 0 check (gross_minor >= 0),
  user_minor bigint not null default 0 check (user_minor >= 0),
  platform_minor bigint not null default 0 check (platform_minor >= 0),
  gas_minor bigint not null default 0 check (gas_minor >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 200),
  commission_minor bigint not null check (commission_minor = (amount_minor * 10) / 100),
  gas_minor bigint not null default 0 check (gas_minor >= 0),
  destination text,
  status text not null default 'demo_blocked'
    check (status in ('demo_blocked','pending_partner','approved','rejected','settled')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.publisher_reconciliation (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null default 'traffmonetizer',
  partner_period text not null,
  partner_gross_minor bigint not null check (partner_gross_minor >= 0),
  allocated_user_minor bigint not null check (allocated_user_minor >= 0),
  platform_minor bigint not null check (platform_minor >= 0),
  variance_minor bigint not null,
  status text not null default 'pending' check (status in ('pending','matched','variance','closed')),
  created_at timestamptz not null default now(),
  unique (partner_name, partner_period)
);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.consent_events enable row level security;
alter table public.traffic_reports enable row level security;
alter table public.earnings_ledger enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.publisher_reconciliation enable row level security;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists devices_self_select on public.devices;
drop policy if exists devices_self_insert on public.devices;
drop policy if exists devices_self_update on public.devices;
drop policy if exists consent_self_select on public.consent_events;
drop policy if exists consent_self_insert on public.consent_events;
drop policy if exists traffic_self_select on public.traffic_reports;
drop policy if exists ledger_self_select on public.earnings_ledger;
drop policy if exists withdrawal_self_select on public.withdrawal_requests;
drop policy if exists withdrawal_self_insert on public.withdrawal_requests;
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid());
create policy devices_self_select on public.devices for select using (user_id = auth.uid());
create policy devices_self_insert on public.devices for insert with check (user_id = auth.uid());
create policy devices_self_update on public.devices for update using (user_id = auth.uid()) with check (user_id = auth.uid() and live_enabled = false);
create policy consent_self_select on public.consent_events for select using (user_id = auth.uid());
create policy consent_self_insert on public.consent_events for insert with check (user_id = auth.uid());
create policy traffic_self_select on public.traffic_reports for select using (exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid()));
create policy ledger_self_select on public.earnings_ledger for select using (user_id = auth.uid());
create policy withdrawal_self_select on public.withdrawal_requests for select using (user_id = auth.uid());
create policy withdrawal_self_insert on public.withdrawal_requests for insert with check (user_id = auth.uid() and status = 'demo_blocked');

-- No client policies are created for publisher_reconciliation, ledger writes or provider reports.
