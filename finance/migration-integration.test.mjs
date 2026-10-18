import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const databaseUrl = process.env.MARSX_FINANCE_TEST_DATABASE_URL;

test('v1 data survives upgrade and ingest retries are atomic', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE');
    const v1 = await readFile(new URL('./sql/001_readonly_broker_ledger.sql', import.meta.url), 'utf8');
    await client.query(v1);
    await client.query(
      `INSERT INTO marsx_finance.provider_accounts
       (provider_account_id,provider,account_ref_hash,access_mode,kyc_status,aml_status)
       VALUES ('acct_upgrade_001','demo_broker',$1,'READ_ONLY','VERIFIED','CLEAR')`,
      ['a'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_finance.quotes
       (quote_id,provider_account_id,idempotency_key,symbol,bid,ask,source_time,expires_at)
       VALUES ('quote_upgrade_001','acct_upgrade_001','quote-key-upgrade-0001','BTC/EUR',10,11,now(),now()+interval '1 minute')`
    );

    const v2 = await readFile(new URL('./sql/002_ingest_idempotency.sql', import.meta.url), 'utf8');
    await client.query(v2);
    const preserved = await client.query('SELECT count(*)::integer AS count FROM marsx_finance.quotes');
    assert.equal(preserved.rows[0].count, 1);

    const v3 = await readFile(new URL('./sql/003_atomic_ingest_api.sql', import.meta.url), 'utf8');
    await client.query(v3);
    const args = [
      'ingest-upgrade-0001', 'acct_upgrade_001', 'QUOTE',
      'source-event-upgrade-0001', 'b'.repeat(64), new Date().toISOString()
    ];
    const first = await client.query(
      'SELECT * FROM marsx_finance.record_ingest_event($1,$2,$3,$4,$5,$6)',
      args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_finance.record_ingest_event($1,$2,$3,$4,$5,$6)',
      args
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_finance.record_ingest_event($1,$2,$3,$4,$5,$6)',
        [...args.slice(0, 4), 'c'.repeat(64), args[5]]
      ),
      /finance_ingest_idempotency_conflict/
    );
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE').catch(() => {});
    await client.end();
  }
});
