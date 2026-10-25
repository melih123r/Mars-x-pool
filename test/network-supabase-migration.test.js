import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../network/supabase/migrations/20261024_network_demo_baseline.sql', import.meta.url),
  'utf8',
);

test('DEMO withdrawals enforce the reviewed economics and remain non-executable', () => {
  assert.match(migration, /requested_minor BETWEEN 200 AND 100000000/);
  assert.match(migration, /fee_bps integer NOT NULL DEFAULT 1000 CHECK \(fee_bps=1000\)/);
  assert.match(migration, /gas_fee_minor bigint NOT NULL DEFAULT 0 CHECK \(gas_fee_minor=0\)/);
  assert.match(migration, /gas_payer text NOT NULL DEFAULT 'MARS_X' CHECK \(gas_payer='MARS_X'\)/);
  assert.match(migration, /production_execution_allowed boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(migration, /fee_bps\s*=\s*500|DEFAULT\s+500\s+CHECK\s*\(fee_bps/);
});

test('withdrawal reservation is atomic, balance checked and idempotent', () => {
  assert.match(migration, /UNIQUE\(user_id,idempotency_key\)/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text,0\)\)/);
  assert.match(migration, /idempotency key reused with different request/);
  assert.match(migration, /v_available_minor<p_requested_minor/);
  assert.match(migration, /insufficient DEMO balance/);
  assert.match(migration, /'withdrawal-reserve:'\|\|v_request\.id::text/);
  assert.match(migration, /-p_requested_minor,p_currency,'demo_debit'/);
});

test('authenticated clients can only read their own rows', () => {
  for (const table of [
    'network_demo_profiles',
    'network_demo_devices',
    'network_demo_consent_events',
    'network_demo_ledger',
    'network_demo_withdrawal_requests',
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /REVOKE ALL ON public\.network_demo_profiles,[\s\S]*FROM anon,authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.network_demo_profiles,[\s\S]*TO authenticated/);
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.network_demo_request_withdrawal\(uuid,bigint,text,text\) FROM PUBLIC,anon,authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.network_demo_request_withdrawal\(uuid,bigint,text,text\) TO service_role/,
  );
});
