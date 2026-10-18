import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { encryptMessage, decryptMessage, loadEncryptionKey } from './message-crypto.mjs';
import { LANES, planLaneTasks } from './lane-planner.mjs';

// Production adapter: requires an already-migrated PostgreSQL schema and dedicated role.
// Does not execute agents. Atomic intake protects against partial ten-lane writes.
export class PostgresTaskQueue {
  durable = true;
  constructor({ connectionString, encryptionKeyHex, pool } = {}) {
    if (!pool && (!connectionString || typeof connectionString !== 'string')) throw new Error('database_url_required');
    this.key = loadEncryptionKey(encryptionKeyHex);
    this.pool = pool || new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, ssl: connectionString?.includes('render.com') ? { rejectUnauthorized: true } : undefined });
  }
  async storeCommandAtomic({ updateId, kind, project, message }) {
    if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('invalid_update_id');
    if (!['chat', 'task'].includes(kind)) throw new Error('invalid_command_kind');
    if (typeof project !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(project)) throw new Error('invalid_project');
    if (typeof message !== 'string' || !message.trim() || message.length > 3500) throw new Error('invalid_message');
    const commandId = `telegram-${updateId}-${kind}`;
    const encrypted = encryptMessage(JSON.stringify({ kind, project, message }), this.key, updateId);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO marsx_telegram.command_inbox
           (command_id,update_id,command_kind,project,payload_ciphertext,encryption_key_version)
         VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT (update_id) DO NOTHING`,
        [commandId, updateId, kind, project, encrypted]
      );
      const result = await client.query(
        `SELECT command_id,update_id,command_kind,project,status,attempt_count
         FROM marsx_telegram.command_inbox WHERE update_id=$1 FOR UPDATE`,
        [updateId]
      );
      const row = result.rows[0];
      if (!row) throw new Error('command_insert_not_visible');
      if (row.command_id !== commandId || row.command_kind !== kind || row.project !== project)
        throw new Error('update_id_conflict');
      await client.query('COMMIT');
      return { commandId: row.command_id, status: row.status, duplicate: inserted.rowCount === 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async getCommandStatus(commandId) {
    if (typeof commandId !== 'string' || !/^telegram-\d+-(chat|task)$/.test(commandId)) throw new Error('invalid_command_id');
    const result = await this.pool.query(
      `SELECT command_id,command_kind,project,status,attempt_count,created_at,updated_at
       FROM marsx_telegram.command_inbox WHERE command_id=$1`,
      [commandId]
    );
    return result.rows[0] || null;
  }
  async appendCommandAudit({ commandId, eventKey, eventKind, laneNumber, actorRefHash = null, metadata = {} }) {
    if (typeof commandId !== 'string' || !/^telegram-\d+-(chat|task)$/.test(commandId)) throw new Error('invalid_command_id');
    if (typeof eventKey !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(eventKey)) throw new Error('invalid_audit_event_key');
    if (!['RECEIVED','CLAIMED','RETRIED','COMPLETED','FAILED','BLOCKED'].includes(eventKind)) throw new Error('invalid_audit_event_kind');
    if (!Number.isInteger(laneNumber) || laneNumber < 1 || laneNumber > 10) throw new Error('invalid_audit_lane');
    if (actorRefHash !== null && (typeof actorRefHash !== 'string' || !/^[a-f0-9]{64}$/.test(actorRefHash)))
      throw new Error('invalid_actor_ref_hash');
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('invalid_audit_metadata');
    let encoded;
    try { encoded = JSON.stringify(metadata); } catch { throw new Error('invalid_audit_metadata'); }
    if (Buffer.byteLength(encoded, 'utf8') > 16000) throw new Error('audit_metadata_too_large');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO marsx_telegram.command_audit_log
           (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,metadata)
         VALUES ('audit_' || md5($1 || ':' || $2),$1,$2,$3,$4,$5,$6)
         ON CONFLICT (command_id,event_key) DO NOTHING
         RETURNING audit_event_id`,
        [commandId, eventKey, eventKind, laneNumber, actorRefHash, metadata]
      );
      if (inserted.rowCount === 1) {
        await client.query('COMMIT');
        return { recorded: true };
      }

      const existing = await client.query(
        `SELECT event_kind,lane_number,actor_ref_hash,metadata
           FROM marsx_telegram.command_audit_log
          WHERE command_id=$1 AND event_key=$2 FOR UPDATE`,
        [commandId, eventKey]
      );
      const row = existing.rows[0];
      if (!row) throw new Error('audit_insert_not_visible');
      if (row.event_kind !== eventKind
          || row.lane_number !== laneNumber
          || row.actor_ref_hash !== actorRefHash
          || JSON.stringify(row.metadata) !== encoded) {
        throw new Error('audit_idempotency_conflict');
      }
      await client.query('COMMIT');
      return { recorded: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async claimNextCommand(workerId, leaseSeconds = 60) {
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 300) throw new Error('invalid_lease');
    const actorRefHash = createHash('sha256').update(workerId, 'utf8').digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `WITH available AS (
           SELECT command_id FROM marsx_telegram.command_inbox
           WHERE status='pending' AND retry_at <= now() AND attempt_count < 10
           ORDER BY created_at,command_id FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE marsx_telegram.command_inbox c
         SET status='claimed',worker_id=$1,lease_until=now()+($2::integer * interval '1 second'),
             attempt_count=c.attempt_count+1,updated_at=now()
         FROM available a WHERE c.command_id=a.command_id
         RETURNING c.command_id,c.update_id,c.command_kind,c.project,c.status,c.worker_id,c.attempt_count`,
        [workerId, leaseSeconds]
      );
      const row = result.rows[0] || null;
      if (row) {
        const eventKey = `claim_attempt_${row.attempt_count}_${actorRefHash.slice(0, 16)}`;
        await client.query(
          `INSERT INTO marsx_telegram.command_audit_log
             (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,metadata)
           VALUES ('audit_' || md5($1 || ':' || $2),$1,$2,$3,$4,$5,$6)
           ON CONFLICT (command_id,event_key) DO NOTHING`,
          [row.command_id, eventKey, 'CLAIMED', 10, actorRefHash, { attemptCount: row.attempt_count }]
        );
      }
      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async retryCommand(commandId, workerId, errorCode, delaySeconds) {
    if (typeof commandId !== 'string' || !/^telegram-\d+-(chat|task)$/.test(commandId)) throw new Error('invalid_command_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    if (typeof errorCode !== 'string' || !/^[a-z0-9_]{1,64}$/.test(errorCode)) throw new Error('invalid_error_code');
    if (!Number.isSafeInteger(delaySeconds) || delaySeconds < 1 || delaySeconds > 3600) throw new Error('invalid_retry_delay');
    const actorRefHash = createHash('sha256').update(workerId, 'utf8').digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE marsx_telegram.command_inbox
         SET status=CASE WHEN attempt_count < 10 THEN 'pending' ELSE 'failed' END,
             worker_id=NULL,lease_until=NULL,
             retry_at=CASE WHEN attempt_count < 10 THEN now()+($4::integer * interval '1 second') ELSE retry_at END,
             last_error_code=$3,updated_at=now()
         WHERE command_id=$1 AND worker_id=$2 AND status='claimed' AND lease_until > now()
         RETURNING command_id,update_id,command_kind,project,status,attempt_count`,
        [commandId, workerId, errorCode, delaySeconds]
      );
      const row = result.rows[0] || null;
      if (row) {
        const eventKey = `retry_attempt_${row.attempt_count}_${actorRefHash.slice(0, 16)}`;
        const eventKind = row.status === 'failed' ? 'FAILED' : 'RETRIED';
        await client.query(
          `INSERT INTO marsx_telegram.command_audit_log
             (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,error_code,metadata)
           VALUES ('audit_' || md5($1 || ':' || $2),$1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (command_id,event_key) DO NOTHING`,
          [row.command_id, eventKey, eventKind, 10, actorRefHash, errorCode, {
            attemptCount: row.attempt_count,
            delaySeconds
          }]
        );
      }
      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async completeCommand(commandId, workerId) {
    if (typeof commandId !== 'string' || !/^telegram-\d+-(chat|task)$/.test(commandId)) throw new Error('invalid_command_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    const actorRefHash = createHash('sha256').update(workerId, 'utf8').digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE marsx_telegram.command_inbox
         SET status='completed',worker_id=NULL,lease_until=NULL,last_error_code=NULL,updated_at=now()
         WHERE command_id=$1 AND worker_id=$2 AND status='claimed' AND lease_until > now()
         RETURNING command_id,update_id,command_kind,project,status,attempt_count`,
        [commandId, workerId]
      );
      const row = result.rows[0] || null;
      if (row) {
        const eventKey = `complete_attempt_${row.attempt_count}_${actorRefHash.slice(0, 16)}`;
        await client.query(
          `INSERT INTO marsx_telegram.command_audit_log
             (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,metadata)
           VALUES ('audit_' || md5($1 || ':' || $2),$1,$2,$3,10,$4,$5)
           ON CONFLICT (command_id,event_key) DO NOTHING`,
          [row.command_id, eventKey, 'COMPLETED', actorRefHash, { attemptCount: row.attempt_count }]
        );
      }
      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async enqueueAtomic({ updateId, tasks }) {
    if (!Number.isSafeInteger(updateId) || updateId < 0 || !Array.isArray(tasks) || tasks.length !== LANES.length) throw new Error('invalid_intake');
    if (typeof tasks[0]?.message !== 'string' || !tasks[0].message.trim() || tasks[0].message.length > 4000) throw new Error('invalid_message');
    const expected = planLaneTasks(updateId, tasks[0].message);
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
      if (count.rows[0].count !== LANES.length) throw new Error('incomplete_task_set');
      await client.query('COMMIT');
      return { committed: true, taskCount: LANES.length, duplicate: inserted.rowCount === 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async claimAtomic(taskId, workerId, leaseSeconds = 60) {
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-(10|[1-9])$/.test(taskId)) throw new Error('invalid_task_id');
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
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-(10|[1-9])$/.test(taskId)) throw new Error('invalid_task_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Acquire the parent intake lock before changing any task row. This
      // matches recordCompletionEvent and avoids concurrent completion deadlocks.
      const parent = await client.query(
        'SELECT update_id FROM marsx_telegram.tasks WHERE task_id=$1',
        [taskId]
      );
      if (parent.rows?.[0]) {
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [parent.rows[0].update_id]);
      }
      const result = await client.query(
        `UPDATE marsx_telegram.tasks SET status=$3, lease_until=NULL, updated_at=now()
         WHERE task_id=$1 AND worker_id=$2 AND status IN ('claimed','running')
           AND lease_until > now() RETURNING task_id,update_id,lane,status`,
        [taskId, workerId, outcome]
      );
      if (result.rows[0]) {
        const updateId = result.rows[0].update_id;
        // Parent intake lock is already held before updating the task.
        const statuses = await client.query(
          'SELECT status FROM marsx_telegram.tasks WHERE update_id=$1',
          [updateId]
        );
        if (statuses.rows.length === LANES.length && statuses.rows.every(row =>
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
    if (!Number.isInteger(lane) || lane < 1 || lane > LANES.length) throw new Error('invalid_lane');
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
    if (typeof taskId !== 'string' || !/^telegram-\d+-lane-(10|[1-9])$/.test(taskId)) throw new Error('invalid_task_id');
    if (typeof workerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(workerId)) throw new Error('invalid_worker_id');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Use the same parent-first lock order as acknowledgements and recovery.
      const parent = await client.query(
        'SELECT update_id FROM marsx_telegram.tasks WHERE task_id=$1',
        [taskId]
      );
      if (parent.rows?.[0]) {
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [parent.rows[0].update_id]);
      }
      const result = await client.query(
        `UPDATE marsx_telegram.tasks SET status='not_configured',lease_until=NULL,updated_at=now()
         WHERE task_id=$1 AND worker_id=$2 AND status='claimed' AND lease_until > now()
         RETURNING task_id,update_id,lane,status`,
        [taskId, workerId]
      );
      if (result.rows[0]) {
        const updateId = result.rows[0].update_id;
        const statuses = await client.query('SELECT status FROM marsx_telegram.tasks WHERE update_id=$1', [updateId]);
        if (statuses.rows.length === LANES.length && statuses.rows.every(row =>
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
      const recoveredCommands = await client.query(
        `WITH expired_commands AS (
           SELECT command_id FROM marsx_telegram.command_inbox
           WHERE status='claimed' AND lease_until <= now()
           ORDER BY lease_until FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE marsx_telegram.command_inbox c
         SET status=CASE WHEN attempt_count >= 10 THEN 'failed' ELSE 'pending' END,
             worker_id=NULL,lease_until=NULL,retry_at=now(),
             last_error_code='lease_expired',updated_at=now()
         FROM expired_commands e WHERE c.command_id=e.command_id
         RETURNING c.command_id,c.status,c.attempt_count`,
        [limit]
      );
      const recoveryActorHash = createHash('sha256').update('lease_recovery', 'utf8').digest('hex');
      for (const command of recoveredCommands.rows || []) {
        const eventKey = `lease_expired_attempt_${command.attempt_count}_${recoveryActorHash.slice(0, 16)}`;
        const eventKind = command.status === 'failed' ? 'FAILED' : 'RETRIED';
        await client.query(
          `INSERT INTO marsx_telegram.command_audit_log
             (audit_event_id,command_id,event_key,event_kind,lane_number,actor_ref_hash,error_code,metadata)
           VALUES ('audit_' || md5($1 || ':' || $2),$1,$2,$3,10,$4,$5,$6)
           ON CONFLICT (command_id,event_key) DO NOTHING`,
          [command.command_id, eventKey, eventKind, recoveryActorHash, 'lease_expired', {
            attemptCount: command.attempt_count
          }]
        );
      }
      // A crashed worker may have exhausted its retries. Reconcile every affected
      // intake so an otherwise completed ten-lane job still produces a report.
      const updateIds = [...new Set(result.rows.filter(row => row.status === 'failed').map(row => row.update_id))];
      for (const updateId of updateIds) {
        await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [updateId]);
        const statuses = await client.query('SELECT status FROM marsx_telegram.tasks WHERE update_id=$1', [updateId]);
        if (statuses.rows.length === LANES.length && statuses.rows.every(row =>
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
      // Match ackAtomic's lock ordering: intake first, then task status read.
      // Locking task rows first can deadlock against concurrent worker acknowledgements.
      await client.query('SELECT update_id FROM marsx_telegram.intakes WHERE update_id=$1 FOR UPDATE', [updateId]);
      const rows = await client.query(
        'SELECT lane,status FROM marsx_telegram.tasks WHERE update_id=$1 ORDER BY lane',
        [updateId]
      );
      const done = rows.rows.length === LANES.length && rows.rows.every(row =>
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
