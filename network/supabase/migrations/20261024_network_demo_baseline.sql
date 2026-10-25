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
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  requested_minor bigint NOT NULL CHECK (requested_minor BETWEEN 200 AND 100000000),
  currency text NOT NULL CHECK (currency='USD'),
  fee_bps integer NOT NULL DEFAULT 1000 CHECK (fee_bps=1000),
  fee_minor bigint GENERATED ALWAYS AS ((requested_minor*fee_bps+9999)/10000) STORED,
  net_minor bigint GENERATED ALWAYS AS (requested_minor-((requested_minor*fee_bps+9999)/10000)) STORED,
  gas_fee_minor bigint NOT NULL DEFAULT 0 CHECK (gas_fee_minor=0),
  gas_payer text NOT NULL DEFAULT 'MARS_X' CHECK (gas_payer='MARS_X'),
  status text NOT NULL DEFAULT 'demo_reserved'
    CHECK (status IN ('demo_reserved','demo_cancelled','demo_settled')),
  production_execution_allowed boolean NOT NULL DEFAULT false
    CHECK (production_execution_allowed=false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS network_demo_withdrawals_owner_idx
  ON public.network_demo_withdrawal_requests(user_id,created_at DESC);

-- Server-only atomic simulation: serializes each user's requests, returns the
-- original row on an exact retry, checks available DEMO USD, then reserves the
-- gross amount with an immutable ledger debit. It cannot execute a payout.
CREATE OR REPLACE FUNCTION public.network_demo_request_withdrawal(
  p_user_id uuid,
  p_requested_minor bigint,
  p_currency text,
  p_idempotency_key text
) RETURNS public.network_demo_withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.network_demo_withdrawal_requests;
  v_request public.network_demo_withdrawal_requests;
  v_available_minor bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_currency IS DISTINCT FROM 'USD' THEN
    RAISE EXCEPTION 'DEMO withdrawals support USD only';
  END IF;
  IF p_requested_minor NOT BETWEEN 200 AND 100000000 THEN
    RAISE EXCEPTION 'requested amount must be between 2.00 and 1000000.00 USD';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'idempotency key length must be 16..128';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));

  SELECT * INTO v_existing
    FROM public.network_demo_withdrawal_requests
   WHERE user_id=p_user_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.requested_minor<>p_requested_minor OR v_existing.currency<>p_currency THEN
      RAISE EXCEPTION 'idempotency key reused with different request';
    END IF;
    RETURN v_existing;
  END IF;

  SELECT COALESCE(sum(amount_minor),0) INTO v_available_minor
    FROM public.network_demo_ledger
   WHERE user_id=p_user_id AND currency=p_currency;
  IF v_available_minor<p_requested_minor THEN
    RAISE EXCEPTION 'insufficient DEMO balance';
  END IF;

  INSERT INTO public.network_demo_withdrawal_requests(
    user_id,idempotency_key,requested_minor,currency
  ) VALUES (
    p_user_id,p_idempotency_key,p_requested_minor,p_currency
  ) RETURNING * INTO v_request;

  INSERT INTO public.network_demo_ledger(
    user_id,external_event_id,amount_minor,currency,event_kind
  ) VALUES (
    p_user_id,'withdrawal-reserve:'||v_request.id::text,
    -p_requested_minor,p_currency,'demo_debit'
  );

  RETURN v_request;
END;
$$;

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
REVOKE ALL ON FUNCTION public.network_demo_request_withdrawal(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.network_demo_request_withdrawal(uuid,bigint,text,text) TO service_role;
COMMIT;
