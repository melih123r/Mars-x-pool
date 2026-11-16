-- Cover Network partner foreign keys and the authenticated read paths used by RLS.
-- Keep these indexes isolated from the existing Finance and Global Engine schemas.
create index if not exists devices_publisher_node_id_idx
  on public.devices (publisher_node_id)
  where publisher_node_id is not null;

create index if not exists consent_events_user_created_idx
  on public.consent_events (user_id, created_at desc);
create index if not exists consent_events_device_id_idx
  on public.consent_events (device_id);

create index if not exists traffic_reports_device_period_idx
  on public.traffic_reports (device_id, period_start desc);

create index if not exists earnings_ledger_user_created_idx
  on public.earnings_ledger (user_id, created_at desc);
create index if not exists earnings_ledger_device_id_idx
  on public.earnings_ledger (device_id);
create index if not exists earnings_ledger_traffic_report_id_idx
  on public.earnings_ledger (traffic_report_id)
  where traffic_report_id is not null;

create index if not exists withdrawal_requests_user_created_idx
  on public.withdrawal_requests (user_id, created_at desc);
