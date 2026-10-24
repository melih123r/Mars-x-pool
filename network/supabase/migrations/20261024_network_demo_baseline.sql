-- MARS-X Network: DEMO-only Supabase schema. NOT a production earnings or payout system.
-- Additive migration: leaves existing MARS-X trading tables and legacy Pool functions unchanged.
-- No authenticated user may insert or update accounting records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.network_demo_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.network_demo_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,user_id)
);
CREATE INDEX IF NOT EXISTS network_demo_devices_owner_idx ON public.network_demo_devices(user_id);
CREATE TABLE IF NOT EXISTS public.network_demo_consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  consent_kind text NOT NULL CHECK (consent_kind IN ('demo_opt_in','demo_opt_out')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(device_id,user_id) REFERENCES public.network_demo_devices(id,user_id)
);
CREATE INDEX IF NOT EXISTS network_demo_consent_owner_idx ON public.network_demo_consent_events(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.network_demo_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_event_id text NOT NULL UNIQUE,
  amount_minor bigint NOT NULL,
  currency text NOT NULL CHECK (currency IN ('EUR','USD')),
  event_kind text NOT NULL CHECK (event_kind IN ('demo_credit','demo_debit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((event_kind='demo_credit' AND amount_minor>0) OR (event_kind='demo_debit' AND amount_minor<0))
);
CREATE INDEX IF NOT EXISTS network_demo_ledger_owner_idx ON public.network_demo_ledger(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.network_demo_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_minor bigint NOT NULL CHECK (requested_minor>0),
  currency text NOT NULL CHECK (currency IN ('EUR','USD')),
  status text NOT NULL DEFAULT 'demo_only' CHECK (status='demo_only'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS network_demo_withdrawals_owner_idx ON public.network_demo_withdrawal_requests(user_id);
ALTER TABLE public.network_demo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_demo_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_demo_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_demo_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_demo_withdrawal_requests ENABLE ROW LEVEL SECURITY;
-- Explicit read-only access to own rows. Server-side writes require separately reviewed backend authorization.
CREATE POLICY network_demo_profiles_own_read ON public.network_demo_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY network_demo_devices_own_read ON public.network_demo_devices FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY network_demo_consent_own_read ON public.network_demo_consent_events FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY network_demo_ledger_own_read ON public.network_demo_ledger FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY network_demo_withdrawals_own_read ON public.network_demo_withdrawal_requests FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
REVOKE ALL ON public.network_demo_profiles, public.network_demo_devices, public.network_demo_consent_events, public.network_demo_ledger, public.network_demo_withdrawal_requests FROM anon,authenticated;
GRANT SELECT ON public.network_demo_profiles, public.network_demo_devices, public.network_demo_consent_events, public.network_demo_ledger, public.network_demo_withdrawal_requests TO authenticated;
COMMIT;
