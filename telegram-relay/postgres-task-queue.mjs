import pg from 'pg';
import { randomUUID } from 'node:crypto';
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
    if (typeof tasks[0]?.message !== 'string' || !tasks[0].message.trim() || tasks[0].message.length > 4000) throw new Error('invalid_message');
    const expected = planFiveLaneTasks(updateId, tasks[0].message);
    if (!expected.every((task, i) => task.taskId === tasks[i]?.taskId && task.lane === tasks[i]?.lane && task.updateId === tasks[i]?.updateId && task.message === tasks[i]?.message))
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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE marsx_telegram.tasks SET status=$3, lease_until=NULL, updated_at=now()
         WHERE task_id=$1 AND worker_id=$2 AND status IN ('claimed','running')
           AND lease_until > now() RETURNING task_id,update_id,lane,status`,
        [taskId, workerId, outcome]
      );
      if (result.rows[0]) {
        const updateId = result.rows[0].update_id;
        // Serialize completion checks for this intake across concurrent lane workers.
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [updateId]);
        const statuses = await client.query(
          'SELECT status FROM marsx_telegram.tasks WHERE update_id=$1',
          [updateId]
        );
        if (statuses.rows.length === 5 && statuses.rows.every(row =>
          ['succeeded','failed','not_configured'].includes(row.status))) {
          const kind = statuses.rows.every(row => row.status === 'succeeded') ? 'completed' : 'failed';
          await client.query(
            'INSERT INTO marsx_telegram.outbox(update_id,event_kind) VALUES ($1,$2) ON CONFLICT (update_id,event_kind) DO NOTHING',
            [updateId, kind]
          );
        }
      }
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async claimNextTask(workerId, lane, leaseSeconds = 90) {
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    if (!Number.isInteger(lane) || lane < 1 || lane > 5) throw new Error('invalid_lane');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 300) throw new Error('invalid_lease');
    const result = await this.pool.query(
      `WITH available AS (
         SELECT task_id FROM marsx_telegram.tasks
         WHERE lane=$2 AND status='queued' AND attempt_count < 20
         ORDER BY updated_at,task_id FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE marsx_telegram.tasks t
       SET status='claimed',worker_id=$1,
           lease_until=now()+($3::integer * interval '1 second'),
           attempt_count=t.attempt_count+1,updated_at=now()
       FROM available a WHERE t.task_id=a.task_id
       RETURNING t.task_id,t.update_id,t.lane,t.status,t.worker_id,t.lease_until`,
      [workerId, lane, leaseSeconds]
    );
    return result.rows[0] || null;
  }
  async markTaskNotConfigured(taskId, workerId) {
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-[1-5]$/.test(taskId)) throw new Error('invalid_task_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE marsx_telegram.tasks SET status='not_configured',lease_until=NULL,updated_at=now()
         WHERE task_id=$1 AND worker_id=$2 AND status='claimed' AND lease_until > now()
         RETURNING task_id,update_id,lane,status`,
        [taskId, workerId]
      );
      if (result.rows[0]) {
        const updateId = result.rows[0].update_id;
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [updateId]);
        const statuses = await client.query('SELECT status FROM marsx_telegram.tasks WHERE update_id=$1', [updateId]);
        if (statuses.rows.length === 5 && statuses.rows.every(row =>
          ['succeeded','failed','not_configured'].includes(row.status))) {
          const kind = statuses.rows.every(row => row.status === 'succeeded') ? 'completed' : 'failed';
          await client.query(
            'INSERT INTO marsx_telegram.outbox(update_id,event_kind) VALUES ($1,$2) ON CONFLICT (update_id,event_kind) DO NOTHING',
            [updateId, kind]
          );
        }
      }
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async recoverExpired(limit = 50) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_limit');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `WITH expired AS (
           SELECT task_id FROM marsx_telegram.tasks
           WHERE status IN ('claimed','running') AND lease_until <= now()
           ORDER BY lease_until FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE marsx_telegram.tasks t
         SET status=CASE WHEN attempt_count >= 20 THEN 'failed' ELSE 'queued' END,
             worker_id=NULL, lease_until=NULL, updated_at=now()
         FROM expired e WHERE t.task_id=e.task_id
         RETURNING t.task_id,t.update_id,t.status`,
        [limit]
      );
      // A crashed worker may have exhausted its retries. Reconcile every affected
      // intake so an otherwise completed five-lane job still produces a report.
      const updateIds = [...new Set(result.rows.filter(row => row.status === 'failed').map(row => row.update_id))];
      for (const updateId of updateIds) {
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [updateId]);
        const statuses = await client.query('SELECT status FROM marsx_telegram.tasks WHERE update_id=$1', [updateId]);
        if (statuses.rows.length === 5 && statuses.rows.every(row =>
          ['succeeded','failed','not_configured'].includes(row.status))) {
          await client.query(
            `INSERT INTO marsx_telegram.outbox(update_id,event_kind)
             VALUES ($1,'failed') ON CONFLICT (update_id,event_kind) DO NOTHING`,
            [updateId]
          );
        }
      }
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
  async getUpdateStatus(updateId) {
    if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('invalid_update_id');
    const result = await this.pool.query(
      'SELECT lane,status FROM marsx_telegram.tasks WHERE update_id=$1 ORDER BY lane',
      [updateId]
    );
    return result.rows;
  }
  async recordCompletionEvent(updateId) {
    if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('invalid_update_id');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rows = await client.query(
        'SELECT lane,status FROM marsx_telegram.tasks WHERE update_id=$1 ORDER BY lane FOR UPDATE',
        [updateId]
      );
      const done = rows.rows.length === 5 && rows.rows.every(row =>
        ['succeeded','failed','not_configured'].includes(row.status));
      if (!done) {
        await client.query('COMMIT');
        return { ready: false };
      }
      const kind = rows.rows.some(row => row.status !== 'succeeded') ? 'failed' : 'completed';
      const result = await client.query(
        'INSERT INTO marsx_telegram.outbox(update_id,event_kind) VALUES ($1,$2) ON CONFLICT (update_id,event_kind) DO NOTHING RETURNING event_id',
        [updateId, kind]
      );
      await client.query('COMMIT');
      return { ready: true, eventKind: kind, newlyRecorded: result.rowCount === 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async fetchPendingOutbox(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_limit');
    const result = await this.pool.query(
      `SELECT o.event_id,o.update_id,o.event_kind,t.lane,t.status
       FROM marsx_telegram.outbox o
       JOIN marsx_telegram.tasks t ON t.update_id=o.update_id
       WHERE o.delivered_at IS NULL AND o.event_id IN
         (SELECT event_id FROM marsx_telegram.outbox WHERE delivered_at IS NULL ORDER BY event_id LIMIT $1)
       ORDER BY o.event_id,t.lane`,
      [limit]
    );
    const events = new Map();
    for (const row of result.rows) {
      if (!events.has(row.event_id)) events.set(row.event_id, { event_id: row.event_id, update_id: Number(row.update_id), event_kind: row.event_kind, rows: [] });
      events.get(row.event_id).rows.push({ lane: row.lane, status: row.status });
    }
    return [...events.values()];
  }
  async markOutboxDelivered(eventId) {
    if (!Number.isSafeInteger(eventId) || eventId < 1) throw new Error('invalid_event_id');
    const result = await this.pool.query(
      'UPDATE marsx_telegram.outbox SET delivered_at=now() WHERE event_id=$1 AND delivered_at IS NULL RETURNING event_id',
      [eventId]
    );
    return result.rowCount === 1;
  }
  async claimOutbox(limit = 20, leaseSeconds = 90) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_limit');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 300) throw new Error('invalid_lease');
    const token = randomUUID();
    const result = await this.pool.query(
      `WITH available AS (
         SELECT event_id FROM marsx_telegram.outbox
         WHERE delivered_at IS NULL AND (claim_until IS NULL OR claim_until <= now())
           AND attempt_count < 20
         ORDER BY event_id FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE marsx_telegram.outbox o
       SET claim_token=$2::uuid, claim_until=now()+($3::integer * interval '1 second'),
           attempt_count=attempt_count+1
       FROM available a WHERE o.event_id=a.event_id
       RETURNING o.event_id,o.update_id,o.event_kind`,
      [limit, token, leaseSeconds]
    );
    return { token, events: result.rows };
  }
  async markClaimedOutboxDelivered(eventId, token) {
    if (!Number.isSafeInteger(eventId) || eventId < 1) throw new Error('invalid_event_id');
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) throw new Error('invalid_claim_token');
    const result = await this.pool.query(
      `UPDATE marsx_telegram.outbox SET delivered_at=now(), claim_token=NULL, claim_until=NULL
       WHERE event_id=$1 AND claim_token=$2::uuid AND claim_until > now()
         AND delivered_at IS NULL RETURNING event_id`,
      [eventId, token]
    );
    return result.rowCount === 1;
  }
  async close() { await this.pool.end(); }
}
