import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.NETWORK_LEDGER_DATABASE_URL;

test('1,000 accounts persist 12,000 immutable 20/80 ledger entries idempotently', {
  skip: !databaseUrl,
  timeout: 90_000
}, async () => {
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const schema = 'network_scale_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`
  });

  try {
    for (const file of [
      '../../db/001_network_ledger.sql',
      '../../db/002_payout_reservation_audit.sql'
    ]) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }

    await pool.query(`
      INSERT INTO network_accounts(user_id,consent_version,consent_at)
      SELECT 'scale-user-' || user_no, 'network-v1', now()
      FROM generate_series(1,1000) AS users(user_no)
    `);

    await pool.query(`
      INSERT INTO network_revenue_receipts
        (receipt_id,partner_id,partner_reference,currency,settled_minor,
         platform_minor,users_minor)
      SELECT 'scale-receipt-' || user_no, 'approved-scale-fixture',
             'scale-partner-reference-' || user_no, 'EUR', 100, 20, 80
      FROM generate_series(1,1000) AS users(user_no)
    `);

    await pool.query(`
      INSERT INTO network_ledger_entries
        (entry_id,user_id,receipt_id,idempotency_key,currency,amount_minor,entry_type)
      SELECT 'scale-entry-' || user_no || '-' || entry_no,
             'scale-user-' || user_no,
             'scale-receipt-' || user_no,
             'scale-idempotency-' || user_no || '-' || entry_no,
             'EUR',
             CASE WHEN entry_no = 12 THEN 3 ELSE 7 END,
             'settled_credit'
      FROM generate_series(1,1000) AS users(user_no)
      CROSS JOIN generate_series(1,12) AS entries(entry_no)
    `);

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM network_accounts) AS accounts,
        (SELECT count(*)::int FROM network_revenue_receipts) AS receipts,
        (SELECT count(*)::int FROM network_ledger_entries) AS entries
    `);
    assert.deepEqual(counts.rows[0], {
      accounts: 1000,
      receipts: 1000,
      entries: 12000
    });

    const split = await pool.query(`
      SELECT sum(settled_minor)::bigint AS settled_minor,
             sum(platform_minor)::bigint AS platform_minor,
             sum(users_minor)::bigint AS users_minor
      FROM network_revenue_receipts
    `);
    assert.deepEqual(split.rows[0], {
      settled_minor: '100000',
      platform_minor: '20000',
      users_minor: '80000'
    });

    const balances = await pool.query(`
      SELECT user_id,sum(amount_minor)::bigint AS balance_minor,count(*)::int AS entries
      FROM network_ledger_entries
      GROUP BY user_id
    `);
    assert.equal(balances.rowCount, 1000);
    assert.ok(balances.rows.every(row =>
      row.balance_minor === '80' && row.entries === 12
    ));

    await assert.rejects(
      pool.query(`
        INSERT INTO network_ledger_entries
          (entry_id,user_id,receipt_id,idempotency_key,currency,amount_minor,entry_type)
        VALUES('duplicate-entry','scale-user-1','scale-receipt-1',
               'scale-idempotency-1-1','EUR',1,'settled_credit')
      `),
      /duplicate key|unique/i
    );

    await assert.rejects(
      pool.query(`
        UPDATE network_ledger_entries SET amount_minor=999
        WHERE entry_id='scale-entry-1-1'
      `),
      /network_immutable_record/
    );

    const index = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname=$1 AND indexname='network_ledger_user_currency_time'
    `, [schema]);
    assert.equal(index.rowCount, 1);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
