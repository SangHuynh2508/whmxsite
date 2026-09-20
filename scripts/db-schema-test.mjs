import assert from 'node:assert/strict';

import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';

const requiredTables = [
  'users',
  'sessions',
  'accounts',
  'verifications',
  'admin_account_audits',
  'source_snapshots',
  'managed_entities',
  'import_runs',
  'edit_history',
  'admin_account_audits',
];

const requiredForeignKeyTables = [
  'sessions',
  'accounts',
  'managed_entities',
  'import_runs',
  'edit_history',
];

function rowsOf(result) {
  return Array.isArray(result) ? result : result.rows || [];
}

const db = getDb();

try {
  const tableRows = rowsOf(
    await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'sessions', 'accounts', 'verifications', 'admin_account_audits', 'source_snapshots', 'managed_entities', 'import_runs', 'edit_history')
    `),
  );
  const tableNames = new Set(tableRows.map((row) => row.table_name));

  for (const tableName of requiredTables) {
    assert.ok(tableNames.has(tableName), `missing required table: ${tableName}`);
  }

  const foreignKeyRows = rowsOf(
    await db.execute(sql`
      select rel.relname as table_name, count(*)::int as foreign_key_count
      from pg_constraint fk_constraint
      join pg_class rel on rel.oid = fk_constraint.conrelid
      join pg_namespace namespace on namespace.oid = rel.relnamespace
      where fk_constraint.contype = 'f'
        and namespace.nspname = 'public'
        and rel.relname in ('sessions', 'accounts', 'admin_account_audits', 'managed_entities', 'import_runs', 'edit_history')
      group by rel.relname
    `),
  );
  const foreignKeyCounts = new Map(
    foreignKeyRows.map((row) => [row.table_name, Number(row.foreign_key_count)]),
  );

  for (const tableName of requiredForeignKeyTables) {
    assert.ok((foreignKeyCounts.get(tableName) || 0) > 0, `missing FK for ${tableName}`);
  }

  console.log('DB_SCHEMA_TEST=PASS');
} finally {
  await closeDb();
}
