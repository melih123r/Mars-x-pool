import pg from 'pg';
import { encryptMessage, decryptMessage, loadEncryptionKey } from './message-crypto.mjs';
import { planFiveLaneTasks } from './lane-planner.mjs';

// Production adapter: requires an already-migrated PostgreSQL schema and dedicated role.
// Does not execute agents. Atomic intake protects against partial five-lane writes.
export class PostgresTaskQueue {
  durable = true;
  constructor({ connectionString, encryptionKeyHex, pool } = {}) {
    if (!pool && (!connectionString || typeof connectionString !== 'string')) throw new Error('database_url_required');
    this.key = loadEncryptionKey(encryptionKeyHex);
    this.pool = pool || new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, ssl: connectionString?.includes('render.com') ? { rejectUnauthorized: true } : undefined });
  }
  async enqueueAtomic({ updateId, tasks }) {
    if (!Number.isSafeInteger(updateId) || updateId < 0 || !Array.isArray(tasks) || tasks.length !== 5) throw new Error('invalid_intake');
    const expected = planFiveLaneTasks(updateId, tasks[0]?.message);
    if (!expected.every((task, i) => task.taskId === tasks[i]?.taskId && task.lane === tasks[i]?.lane && task.message === tasks[i]?.message))
      throw new Error('task_plan_mismatch');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        'INSERT INTO marsx_telegram.intakes(update_id,payload_ciphertext,encryption_key_version) VALUES ($1,$2,1) ON CONFLICT (update_id) DO NOTHING RETURNING update_id',
        [updateId, encryptMessage(tasks[0].message, this.key, updateId)]
      );
      if (inserted.rowCount === 1) {
        for (let i = 0; i < tasks.length; i++) {
          await client.query(
            'INSERT INTO marsx_telegram.tasks(task_id,update_id,lane,status) VALUES ($1,$2,$3,$4)',
            [tasks[i].taskId, updateId, i + 1, 'queued']
          );
        }
      }
      const count = await client.query('SELECT count(*)::integer AS count FROM marsx_telegram.tasks WHERE update_id=$1', [updateId]);
      if (count.rows[0].count !== 5) throw new Error('incomplete_task_set');
      await client.query('COMMIT');
      return { committed: true, taskCount: 5, duplicate: inserted.rowCount === 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async claimAtomic(taskId, workerId, leaseSeconds = 60) {
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-[1-5]$/.test(taskId)) throw new Error('invalid_task_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new Error('invalid_lease');
    const result = await this.pool.query(
      `UPDATE marsx_telegram.tasks SET status='claimed', worker_id=$2,
         lease_until=now()+($3::integer * interval '1 second'),
         attempt_count=attempt_count+1, updated_at=now()
       WHERE task_id=$1 AND status='queued' AND attempt_count < 20
       RETURNING task_id,update_id,lane,status,worker_id,lease_until`,
      [taskId, workerId, leaseSeconds]
    );
    return result.rows[0] || null;
  }
  async ackAtomic(taskId, workerId, outcome) {
    if (!['succeeded','failed'].includes(outcome)) throw new Error('invalid_outcome');
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-[1-5]$/.test(taskId)) throw new Error('invalid_task_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    const result = await this.pool.query(
      `UPDATE marsx_telegram.tasks SET status=$3, lease_until=NULL, updated_at=now()
       WHERE task_id=$1 AND worker_id=$2 AND status IN ('claimed','running')
         AND lease_until > now() RETURNING task_id,update_id,lane,status`,
      [taskId, workerId, outcome]
    );
    return result.rows[0] || null;
  }
  async recoverExpired(limit = 50) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_limit');
    const result = await this.pool.query(
      `WITH expired AS (
         SELECT task_id FROM marsx_telegram.tasks
         WHERE status IN ('claimed','running') AND lease_until <= now()
         ORDER BY lease_until FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE marsx_telegram.tasks t
       SET status=CASE WHEN attempt_count >= 20 THEN 'failed' ELSE 'queued' END,
           worker_id=NULL, lease_until=NULL, updated_at=now()
       FROM expired e WHERE t.task_id=e.task_id
       RETURNING t.task_id,t.status`,
      [limit]
    );
    return result.rows;
  }
  async getEncryptedMessage(updateId) {
    if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('invalid_update_id');
    const result = await this.pool.query(
      'SELECT payload_ciphertext,encryption_key_version FROM marsx_telegram.intakes WHERE update_id=$1',
      [updateId]
    );
    if (!result.rows[0]) return null;
    if (result.rows[0].encryption_key_version !== 1) throw new Error('unsupported_key_version');
    return decryptMessage(result.rows[0].payload_ciphertext, this.key, updateId);
  }
  async close() { await this.pool.end(); }
}
