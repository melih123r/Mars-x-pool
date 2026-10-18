import { createHash } from 'node:crypto';

export async function applyFinanceMigration(client, { version, name, sql }) {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('invalid_migration_version');
  if (typeof name !== 'string' || !/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name))
    throw new Error('invalid_migration_name');
  if (typeof sql !== 'string' || !sql.trim() || Buffer.byteLength(sql, 'utf8') > 1024 * 1024)
    throw new Error('invalid_migration_sql');

  const checksum = createHash('sha256').update(sql, 'utf8').digest('hex');
  await client.query('BEGIN');
  try {
    const registration = await client.query(
      'SELECT * FROM marsx_finance.register_schema_migration($1,$2,$3)',
      [version, name, checksum]
    );
    const applied = registration.rows[0]?.inserted === true;
    if (applied) await client.query(sql);
    await client.query('COMMIT');
    return { version, name, applied };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
