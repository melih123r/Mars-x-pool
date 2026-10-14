// Read-only diagnostics for the existing Render internal PostgreSQL connection.
// Run inside the Render service: node telegram-relay/check-postgres.mjs
// Never prints credentials, messages, or database URLs.
import pg from 'pg';
const required = ['DATABASE_URL', 'MARSX_MESSAGE_ENCRYPTION_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(JSON.stringify({ ok: false, reason: 'missing_environment', missing }));
  process.exitCode = 1;
} else {
  const key = process.env.MARSX_MESSAGE_ENCRYPTION_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error(JSON.stringify({ ok: false, reason: 'invalid_encryption_key_format' }));
    process.exitCode = 1;
  } else {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const { rows } = await pool.query(`SELECT
        to_regclass('marsx_telegram.intakes') IS NOT NULL AS intakes,
        to_regclass('marsx_telegram.tasks') IS NOT NULL AS tasks,
        to_regclass('marsx_telegram.outbox') IS NOT NULL AS outbox`);
      const tables = rows[0];
      console.log(JSON.stringify({ ok: Object.values(tables).every(Boolean), connection: 'successful', tables, agents_connected: false }));
      if (!Object.values(tables).every(Boolean)) process.exitCode = 2;
    } catch (error) {
      console.error(JSON.stringify({ ok: false, reason: 'postgres_connection_or_query_failed', code: error.code || 'unknown' }));
      process.exitCode = 1;
    } finally { await pool.end(); }
  }
}
