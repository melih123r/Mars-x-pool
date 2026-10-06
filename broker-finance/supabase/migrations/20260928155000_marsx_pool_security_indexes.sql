create index if not exists fee_events_referrer_user_idx
  on marsx_pool.fee_events(referrer_user_id);
create index if not exists payout_idempotency_payout_idx
  on marsx_pool.payout_idempotency(payout_id);

create policy deny_client_access on marsx_pool.workers
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.license_devices
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.balances
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.dormant_balances
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.payouts
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.payout_idempotency
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.ledger
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.auth_nonces
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.users
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.user_sessions
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.user_workers
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.referral_codes
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.referrals
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.referral_balances
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on marsx_pool.fee_events
  for all to anon, authenticated using (false) with check (false);
