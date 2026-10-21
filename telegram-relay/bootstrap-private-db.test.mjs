import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { bootstrapPrivateDatabase } from './bootstrap-private-db.mjs';
import { PostgresTaskQueue } from './postgres-task-queue.mjs';
import { planLaneTasks } from './lane-planner.mjs';
import { runAllUnconfiguredLanesOnce } from './unconfigured-worker.mjs';

const approved = 'create_isolated_telegram_schema';
test('bootstrap requires explicit approval and an internal destination', async () => {
  await assert.rejects(bootstrapPrivateDatabase({}), /approval_required/);
  await assert.rejects(bootstrapPrivateDatabase({ approved, adminUrl: 'postgres://u:p@example.com/db' }), /private_database_required/);
  await assert.rejects(bootstrapPrivateDatabase({ approved, adminUrl: 'postgres://u:p@dpg-db25p4rtqb8s73c5mii0-a/marsx_pool_db', password: "bad'password" }), /random_32_byte_password_required/);
});

test('real PostgreSQL: restricted setup, concurrent duplicate intake and ten truthful outcomes', {
  skip: !process.env.MARSX_TEST_DATABASE_URL
}, async () => {
  const adminUrl = process.env.MARSX_TEST_DATABASE_URL;
  assert.ok(['127.0.0.1','localhost'].includes(new URL(adminUrl).hostname), 'disposable local CI database only');
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  let queue;
  try {
    await admin.query('CREATE TABLE public.existing_pool_data (id integer PRIMARY KEY)');
    await admin.query('INSERT INTO public.existing_pool_data VALUES (42)');
    // An unsafe PUBLIC grant must roll back both the new role and schema.
    await admin.query('GRANT SELECT ON public.existing_pool_data TO PUBLIC');
    const password = randomBytes(32).toString('hex');
    const input = { adminUrl, password, approved, allowLocalTest: true };
    await assert.rejects(bootstrapPrivateDatabase(input), /unrelated_database_permissions_detected/);
    assert.equal((await admin.query("SELECT to_regnamespace('marsx_telegram') AS ns")).rows[0].ns, null);
    await admin.query('REVOKE SELECT ON public.existing_pool_data FROM PUBLIC');
    assert.equal((await bootstrapPrivateDatabase(input)).created, true);
    assert.equal(
      (await admin.query("SELECT to_regclass('marsx_telegram.command_inbox') AS table_name")).rows[0].table_name,
      'marsx_telegram.command_inbox'
    );
    await assert.rejects(bootstrapPrivateDatabase(input), /existing_schema_or_role_requires_review/);
    const runtime = new URL(adminUrl);
    runtime.username = 'marsx_telegram_relay';
    runtime.password = password;
    queue = new PostgresTaskQueue({ connectionString: runtime.href, encryptionKeyHex: randomBytes(32).toString('hex') });
    await queue.storeCommandAtomic({
      updateId: 124, kind: 'chat', project: 'finance', message: 'recovery guard test'
    });
    await assert.rejects(
      queue.pool.query(
        `INSERT INTO marsx_telegram.command_audit_log
         (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,error_code,metadata)
         VALUES ('audit_recovery_guard_001','telegram-124-chat','lease_expired_bad_001','RETRIED',10,$1,'lease_expired',$2)`,
        ['d'.repeat(64), { attemptCount: 9 }]
      ),
      /telegram_recovery_audit_state_mismatch/
    );
    await queue.pool.query(
      `UPDATE marsx_telegram.command_inbox
          SET status='claimed',worker_id='expired_worker',
              lease_until=now()-interval '1 second',attempt_count=1
        WHERE command_id='telegram-124-chat'`
    );
    await queue.recoverExpired(10);
    const recoveryAudit = await queue.pool.query(
      `SELECT event_kind,error_code,metadata
         FROM marsx_telegram.command_audit_log
        WHERE command_id='telegram-124-chat' AND error_code='lease_expired'`
    );
    assert.deepEqual(recoveryAudit.rows, [{
      event_kind: 'RETRIED', error_code: 'lease_expired', metadata: { attemptCount: 1 }
    }]);
    await assert.rejects(queue.pool.query('SELECT * FROM public.existing_pool_data'), { code: '42501' });
    await assert.rejects(queue.pool.query('DELETE FROM marsx_telegram.intakes'), { code: '42501' });
    const message = 'MARS-X test';
    const results = await Promise.all(Array.from({ length: 6 }, () => queue.enqueueAtomic({ updateId: 123, tasks: planLaneTasks(123, message) })));
    assert.equal(results.filter(r => !r.duplicate).length, 1);
    assert.equal((await queue.pool.query('SELECT count(*)::int AS n FROM marsx_telegram.tasks')).rows[0].n, 10);
    const statuses = await runAllUnconfiguredLanesOnce(queue);
    assert.equal(statuses.length, 10);
    assert.ok(statuses.every(r => r.outcome === 'not_configured'));
    assert.equal((await queue.pool.query('SELECT count(*)::int AS n FROM marsx_telegram.outbox')).rows[0].n, 1);
    assert.deepEqual((await admin.query('SELECT * FROM public.existing_pool_data')).rows, [{ id: 42 }]);
  } finally {
    await queue?.close();
    await admin.end();
  }
});
