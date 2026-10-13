#!/usr/bin/env node
// Run inside the private Render service/network after schema migration.
// Read-only preflight. Never logs DATABASE_URL or encryption key.
import pg from 'pg';
import { loadEncryptionKey } from './message-crypto.mjs';

const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_ALLOWED_USER_ID', 'DATABASE_URL', 'MARSX_MESSAGE_ENCRYPTION_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error('BLOCKED: missing environment variable names: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  let pool;
  try {
    loadEncryptionKey(process.env.MARSX_MESSAGE_ENCRYPTION_KEY);
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 5000
    });
    const result = await pool.query(`
      SELECT
        to_regclass('marsx_telegram.intakes') IS NOT NULL AS intakes,
        to_regclass('marsx_telegram.tasks') IS NOT NULL AS tasks,
        to_regclass('marsx_telegram.outbox') IS NOT NULL AS outbox
    `);
    const checks = result.rows[0];
    if (!Object.values(checks).every(Boolean)) {
      console.error('BLOCKED: missing PostgreSQL tables: ' +
        Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name).join(', '));
      process.exitCode = 1;
    } else {
      const privileges = await pool.query(`
        SELECT
          has_schema_privilege(current_user, 'marsx_telegram', 'USAGE') AS schema_usage,
          has_table_privilege(current_user, 'marsx_telegram.intakes', 'SELECT, INSERT, UPDATE') AS intake_rw,
          has_table_privilege(current_user, 'marsx_telegram.tasks', 'SELECT, INSERT, UPDATE') AS task_rw,
          has_table_privilege(current_user, 'marsx_telegram.outbox', 'SELECT, INSERT, UPDATE') AS outbox_rw,
          has_sequence_privilege(current_user, pg_get_serial_sequence('marsx_telegram.outbox', 'event_id'), 'USAGE') AS outbox_sequence
      `);
      const denied = Object.entries(privileges.rows[0]).filter(([, allowed]) => !allowed).map(([name]) => name);
      if (denied.length) {
        console.error('BLOCKED: insufficient private DB permissions: ' + denied.join(', '));
        process.exitCode = 1;
      } else {
      const laneConstraint = await pool.query(`
        SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'marsx_telegram' AND t.relname = 'tasks' AND c.contype = 'c'
      `);
      const supportsTen = laneConstraint.rows.some(row =>
        /lane/.test(row.definition) && /10/.test(row.definition));
      if (!supportsTen) {
        console.error('BLOCKED: cannot verify 10-lane schema constraint');
        process.exitCode = 1;
      } else {
        console.log('PASS: credentials present, encryption key valid, private DB schema and 10-lane constraint verified');
        console.log('NOTE: real AI worker connectivity and Telegram E2E are NOT verified');
      }
      }
    }
  } catch (error) {
    console.error('BLOCKED: private DB preflight failed (' + (error.code || error.name || 'unknown') + ')');
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
