-- MARS-X Network DEMO multi-device boundary.
-- This migration does not enable partner traffic, real payouts, or production settlement.
-- Android clients can manage only their own profile, device metadata, and consent events.
-- Provider reports, verified earnings, withdrawals, and publisher reconciliation remain server-only.

create table if not exists public.network_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (char_length(locale) between 2 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.network_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  installation_id text not null check (char_length(installation_id) between 16 and 128),
  display_name text,
  platform text not null default 'android' check (platform = 'android'),
  app_version text,
  last_seen_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create index if not exists network_devices_user_idx
  on public.network_devices(user_id);
create index if not exists network_devices_active_idx
  on public.network_devices(user_id, opted_out_at, last_seen_at desc);

create table if not exists public.network_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id uuid not null references public.network_devices(id) on delete cascade,
  consent_version text not null check (char_length(consent_version) between 1 and 64),
  decision text not null check (decision in ('granted', 'revoked')),
  source text not null default 'android_ui' check (source in ('android_ui', 'support', 'account_deletion')),
  recorded_at timestamptz not null default now()
);

create index if not exists network_consent_user_recorded_idx
  on public.network_consent_events(user_id, recorded_at desc);
create index if not exists network_consent_device_recorded_idx
  on public.network_consent_events(device_id, recorded_at desc);

alter table public.network_profiles enable row level security;
alter table public.network_devices enable row level security;
alter table public.network_consent_events enable row level security;

revoke all on public.network_profiles from public, anon, authenticated;
revoke all on public.network_devices from public, anon, authenticated;
revoke all on public.network_consent_events from public, anon, authenticated;

grant select on public.network_profiles to authenticated;
grant insert (display_name, locale) on public.network_profiles to authenticated;
grant update (display_name, locale, updated_at) on public.network_profiles to authenticated;

grant select on public.network_devices to authenticated;
grant insert (installation_id, display_name, app_version) on public.network_devices to authenticated;
grant update (display_name, app_version, last_seen_at, opted_out_at, updated_at)
  on public.network_devices to authenticated;

grant select on public.network_consent_events to authenticated;
grant insert (device_id, consent_version, decision, source)
  on public.network_consent_events to authenticated;

create policy network_profiles_select_own
  on public.network_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy network_profiles_insert_own
  on public.network_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy network_profiles_update_own
  on public.network_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy network_devices_select_own
  on public.network_devices for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy network_devices_insert_own
  on public.network_devices for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy network_devices_update_own
  on public.network_devices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy network_consent_select_own
  on public.network_consent_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy network_consent_insert_own
  on public.network_consent_events for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.network_devices d
      where d.id = device_id
        and d.user_id = (select auth.uid())
    )
  );

create table if not exists marsx_pool.network_partner_reports (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 2 and 64),
  external_report_id text not null check (char_length(external_report_id) between 1 and 256),
  device_id uuid references public.network_devices(id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  bytes_reported bigint not null default 0 check (bytes_reported >= 0),
  gross_units bigint not null default 0 check (gross_units >= 0),
  currency text not null default 'USD_TEST' check (currency = 'USD_TEST'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  verified_at timestamptz,
  check (period_end > period_start),
  check (
    (verification_status = 'verified' and verified_at is not null)
    or (verification_status <> 'verified')
  ),
  unique (provider, external_report_id)
);

create index if not exists network_partner_reports_device_period_idx
  on marsx_pool.network_partner_reports(device_id, period_start desc);
create index if not exists network_partner_reports_status_idx
  on marsx_pool.network_partner_reports(verification_status, received_at);

create table if not exists marsx_pool.network_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references marsx_pool.network_partner_reports(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.network_devices(id) on delete set null,
  entry_type text not null default 'verified_credit'
    check (entry_type = 'verified_credit'),
  gross_units bigint not null check (gross_units >= 0),
  platform_fee_bps integer not null default 1000 check (platform_fee_bps = 1000),
  platform_fee_units bigint not null check (platform_fee_units >= 0),
  user_net_units bigint not null check (user_net_units >= 0),
  gas_units bigint not null default 0 check (gas_units >= 0),
  gas_payer text not null default 'marsx' check (gas_payer = 'marsx'),
  currency text not null default 'USD_TEST' check (currency = 'USD_TEST'),
  environment text not null default 'demo' check (environment = 'demo'),
  created_at timestamptz not null default now(),
  check (platform_fee_units = gross_units / 10),
  check (user_net_units + platform_fee_units = gross_units)
);

create index if not exists network_earnings_user_created_idx
  on marsx_pool.network_earnings_ledger(user_id, created_at desc);
create index if not exists network_earnings_device_created_idx
  on marsx_pool.network_earnings_ledger(device_id, created_at desc);

create table if not exists marsx_pool.network_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  requested_units bigint not null check (requested_units >= 2000000),
  platform_fee_bps integer not null default 1000 check (platform_fee_bps = 1000),
  gas_payer text not null default 'marsx' check (gas_payer = 'marsx'),
  currency text not null default 'USD_TEST' check (currency = 'USD_TEST'),
  environment text not null default 'demo' check (environment = 'demo'),
  status text not null default 'demo_pending'
    check (status in ('demo_pending', 'demo_approved', 'demo_rejected', 'demo_cancelled')),
  destination_reference text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists network_withdrawals_user_created_idx
  on marsx_pool.network_withdrawal_requests(user_id, created_at desc);
create index if not exists network_withdrawals_status_idx
  on marsx_pool.network_withdrawal_requests(status, created_at);

create table if not exists marsx_pool.network_publisher_reconciliations (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 2 and 64),
  period_start timestamptz not null,
  period_end timestamptz not null,
  provider_gross_units bigint not null check (provider_gross_units >= 0),
  ledger_gross_units bigint not null check (ledger_gross_units >= 0),
  difference_units bigint generated always as (provider_gross_units - ledger_gross_units) stored,
  currency text not null default 'USD_TEST' check (currency = 'USD_TEST'),
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'mismatch', 'rejected')),
  evidence_sha256 text check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  check (period_end > period_start),
  unique (provider, period_start, period_end)
);

alter table marsx_pool.network_partner_reports enable row level security;
alter table marsx_pool.network_earnings_ledger enable row level security;
alter table marsx_pool.network_withdrawal_requests enable row level security;
alter table marsx_pool.network_publisher_reconciliations enable row level security;

revoke all on marsx_pool.network_partner_reports from public, anon, authenticated;
revoke all on marsx_pool.network_earnings_ledger from public, anon, authenticated;
revoke all on marsx_pool.network_withdrawal_requests from public, anon, authenticated;
revoke all on marsx_pool.network_publisher_reconciliations from public, anon, authenticated;

create policy deny_client_access
  on marsx_pool.network_partner_reports for all
  to anon, authenticated
  using (false) with check (false);
create policy deny_client_access
  on marsx_pool.network_earnings_ledger for all
  to anon, authenticated
  using (false) with check (false);
create policy deny_client_access
  on marsx_pool.network_withdrawal_requests for all
  to anon, authenticated
  using (false) with check (false);
create policy deny_client_access
  on marsx_pool.network_publisher_reconciliations for all
  to anon, authenticated
  using (false) with check (false);

comment on table public.network_devices is
  'Random per-installation identifiers and opt-out state; never store hardware identifiers or partner secrets.';
comment on table public.network_consent_events is
  'Append-only user consent history. A consent row does not enable live partner traffic.';
comment on table marsx_pool.network_partner_reports is
  'Server-only deduplicated provider reports. Raw payloads must not contain publisher secrets.';
comment on table marsx_pool.network_earnings_ledger is
  'Server-only immutable DEMO ledger. Entries require separately verified provider reports.';
comment on table marsx_pool.network_withdrawal_requests is
  'Server-only DEMO requests; no real transfer or payout is executed by this schema.';
