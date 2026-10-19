import { createHash } from 'node:crypto';

function validateMigration({ version, name, sql } = {}) {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('invalid_migration_version');
  if (typeof name !== 'string' || !/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name))
    throw new Error('invalid_migration_name');
  if (typeof sql !== 'string' || !sql.trim() || Buffer.byteLength(sql, 'utf8') > 1024 * 1024)
    throw new Error('invalid_migration_sql');
  return {
    version,
    name,
    sql,
    checksum: createHash('sha256').update(sql, 'utf8').digest('hex')
  };
}

export async function applyFinanceMigrations(client, migrations) {
  if (!Array.isArray(migrations) || migrations.length < 1 || migrations.length > 100)
    throw new Error('invalid_migration_batch');
  const checked = migrations.map(validateMigration);
  for (let index = 1; index < checked.length; index += 1) {
    if (checked[index].version <= checked[index - 1].version)
      throw new Error('finance_migrations_not_strictly_ordered');
    if (checked[index].version !== checked[index - 1].version + 1)
      throw new Error('finance_migration_gap');
  }

  await client.query('BEGIN');
  try {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['marsx_finance_schema_migrations']
    );
    const results = [];
    for (const migration of checked) {
      const registration = await client.query(
        'SELECT * FROM marsx_finance.register_schema_migration($1,$2,$3)',
        [migration.version, migration.name, migration.checksum]
      );
      const applied = registration.rows[0]?.inserted === true;
      if (applied) await client.query(migration.sql);
      results.push({ version: migration.version, name: migration.name, applied });
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function applyFinanceMigration(client, migration) {
  return (await applyFinanceMigrations(client, [migration]))[0];
}
