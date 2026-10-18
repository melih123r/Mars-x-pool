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


test('stream cursors advance monotonically and reject stale provider data', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE');
    for (const name of [
      '001_readonly_broker_ledger.sql',
      '002_ingest_idempotency.sql',
      '003_atomic_ingest_api.sql',
      '004_monotonic_stream_cursor.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_finance.provider_accounts
       (provider_account_id,provider,account_ref_hash,access_mode,kyc_status,aml_status)
       VALUES ('acct_cursor_0001','demo_exchange',$1,'READ_ONLY','VERIFIED','CLEAR')`,
      ['d'.repeat(64)]
    );
    const args = [
      'acct_cursor_0001', 'QUOTE', 10,
      'source-cursor-event-0001', 'e'.repeat(64)
    ];
    const first = await client.query(
      'SELECT * FROM marsx_finance.advance_stream_cursor($1,$2,$3,$4,$5)',
      args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_finance.advance_stream_cursor($1,$2,$3,$4,$5)',
      args
    );
    assert.equal(first.rows[0].advanced, true);
    assert.equal(retry.rows[0].advanced, false);
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_finance.advance_stream_cursor($1,$2,$3,$4,$5)',
        [args[0], args[1], 9, 'source-cursor-event-0000', 'f'.repeat(64)]
      ),
      /finance_stream_cursor_regression/
    );
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE').catch(() => {});
    await client.end();
  }
});


test('migration checksums are durable and reject altered replays', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE');
    for (const name of [
      '001_readonly_broker_ledger.sql',
      '002_ingest_idempotency.sql',
      '003_atomic_ingest_api.sql',
      '004_monotonic_stream_cursor.sql',
      '005_migration_checksum_registry.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_finance.provider_accounts
       (provider_account_id,provider,account_ref_hash,access_mode,kyc_status,aml_status)
       VALUES ('acct_checksum_001','demo_broker',$1,'READ_ONLY','VERIFIED','CLEAR')`,
      ['f'.repeat(64)]
    );
    await client.query(
      `INSERT INTO marsx_finance.quotes
       (quote_id,provider_account_id,idempotency_key,symbol,last_price,source_time,expires_at)
       VALUES ('quote_checksum_001','acct_checksum_001','quote-key-checksum-001','ETH/EUR',20,now(),now()+interval '1 minute')`
    );

    const args = [4, '004_monotonic_stream_cursor.sql', '1'.repeat(64)];
    const first = await client.query(
      'SELECT * FROM marsx_finance.register_schema_migration($1,$2,$3)', args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_finance.register_schema_migration($1,$2,$3)', args
    );
    assert.equal(first.rows[0].inserted, true);
    assert.equal(retry.rows[0].inserted, false);
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_finance.register_schema_migration($1,$2,$3)',
        [args[0], args[1], '2'.repeat(64)]
      ),
      /finance_migration_checksum_conflict/
    );
    const preserved = await client.query('SELECT count(*)::integer AS count FROM marsx_finance.quotes');
    assert.equal(preserved.rows[0].count, 1);
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE').catch(() => {});
    await client.end();
  }
});


test('ordered ingest advances cursor and stores the event atomically', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE');
    for (const name of [
      '001_readonly_broker_ledger.sql',
      '002_ingest_idempotency.sql',
      '003_atomic_ingest_api.sql',
      '004_monotonic_stream_cursor.sql',
      '005_migration_checksum_registry.sql',
      '006_ordered_ingest_api.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }
    await client.query(
      `INSERT INTO marsx_finance.provider_accounts
       (provider_account_id,provider,account_ref_hash,access_mode,kyc_status,aml_status)
       VALUES ('acct_ordered_0001','demo_exchange',$1,'READ_ONLY','VERIFIED','CLEAR')`,
      ['3'.repeat(64)]
    );
    const args = [
      'ingest-ordered-0001', 'acct_ordered_0001', 'QUOTE', 12,
      'source-ordered-event-0001', '4'.repeat(64), new Date().toISOString()
    ];
    const first = await client.query(
      'SELECT * FROM marsx_finance.record_ordered_ingest_event($1,$2,$3,$4,$5,$6,$7)', args
    );
    const retry = await client.query(
      'SELECT * FROM marsx_finance.record_ordered_ingest_event($1,$2,$3,$4,$5,$6,$7)', args
    );
    assert.deepEqual(first.rows[0], {
      ingest_event_id: args[0], inserted: true, cursor_advanced: true
    });
    assert.deepEqual(retry.rows[0], {
      ingest_event_id: args[0], inserted: false, cursor_advanced: false
    });
    await assert.rejects(
      client.query(
        'SELECT * FROM marsx_finance.record_ordered_ingest_event($1,$2,$3,$4,$5,$6,$7)',
        ['ingest-ordered-0002', args[1], args[2], 11, 'source-ordered-event-0002', '5'.repeat(64), new Date().toISOString()]
      ),
      /finance_stream_cursor_regression/
    );
    const counts = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM marsx_finance.ingest_events) AS events,
         (SELECT last_sequence FROM marsx_finance.stream_cursors
           WHERE provider_account_id='acct_ordered_0001' AND stream_kind='QUOTE') AS sequence`
    );
    assert.deepEqual(counts.rows[0], { events: 1, sequence: '12' });
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE').catch(() => {});
    await client.end();
  }
});


test('migration runner records checksums and rolls back failed DDL atomically', { skip: !databaseUrl }, async () => {
  let applyFinanceMigration;
  await assert.doesNotReject(async () => {
    ({ applyFinanceMigration } = await import('./migration-runner.mjs'));
  });
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE');
    for (const name of [
      '001_readonly_broker_ledger.sql',
      '002_ingest_idempotency.sql',
      '003_atomic_ingest_api.sql',
      '004_monotonic_stream_cursor.sql',
      '005_migration_checksum_registry.sql'
    ]) {
      await client.query(await readFile(new URL(`./sql/${name}`, import.meta.url), 'utf8'));
    }

    const migration = {
      version: 6,
      name: '006_runner_probe.sql',
      sql: 'CREATE TABLE marsx_finance.runner_probe (probe_id integer PRIMARY KEY)'
    };
    assert.deepEqual(await applyFinanceMigration(client, migration), {
      version: 6, name: migration.name, applied: true
    });
    assert.deepEqual(await applyFinanceMigration(client, migration), {
      version: 6, name: migration.name, applied: false
    });
    await assert.rejects(
      applyFinanceMigration(client, { ...migration, sql: migration.sql + ' /* changed */' }),
      /finance_migration_checksum_conflict/
    );
    await assert.rejects(
      applyFinanceMigration(client, {
        version: 7,
        name: '007_broken_probe.sql',
        sql: 'CREATE TABLE marsx_finance.broken_probe ('
      })
    );
    const state = await client.query(
      `SELECT
         to_regclass('marsx_finance.runner_probe') IS NOT NULL AS probe_exists,
         (SELECT count(*)::integer FROM marsx_finance.schema_migrations WHERE migration_version=7) AS broken_registry_rows`
    );
    assert.deepEqual(state.rows[0], { probe_exists: true, broken_registry_rows: 0 });
  } finally {
    await client.query('DROP SCHEMA IF EXISTS marsx_finance CASCADE').catch(() => {});
    await client.end();
  }
});
