import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';

const databaseArgument = process.argv.find((argument) => argument.startsWith('--database='));
const requestedDatabase = databaseArgument?.slice('--database='.length);
let connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
if (requestedDatabase) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(requestedDatabase)) {
    throw new Error('The optional --database value is not a valid PostgreSQL database name.');
  }
  const databaseUrl = new URL(connectionString);
  databaseUrl.pathname = `/${requestedDatabase}`;
  connectionString = databaseUrl.toString();
}

const expectedTables = [
  'users',
  'admin_account_audits',
  'managed_entities',
  'source_snapshots',
  'edit_history',
  'characters',
  'skins',
  'asset_objects',
  'character_publication_states',
  'preview_characters',
  'preview_character_reconciliations',
  'entity_asset_role_rules',
  'entity_asset_mappings',
  'asset_upload_intents',
  'admin_account_audits_subject_created_at_idx',
];
const expectedIndexes = [
  'managed_entities_id_type_unique',
  'preview_character_reconciliations_confirmed_preview_unique',
  'preview_character_reconciliations_confirmed_official_unique',
  'entity_asset_mappings_active_asset_idx',
  'asset_upload_intents_quarantine_key_unique',
];
const expectedEnums = {
  managed_entity_type: ['character', 'skin', 'series', 'preview_character'],
  character_origin: ['manual_preview', 'source_backed'],
  character_lifecycle: ['unverified', 'unreleased', 'released', 'retired'],
  character_visibility: ['hidden', 'preview', 'public'],
};

const sql = postgres(connectionString, { max: 1, prepare: false });
try {
  const missingTables = [];
  for (const table of expectedTables) {
    const rows = await sql`select to_regclass(${'public.' + table}) as name`;
    if (!rows[0]?.name) missingTables.push(table);
  }
  if (missingTables.length) throw new Error(`Missing migration tables: ${missingTables.join(', ')}`);

  const missingIndexes = [];
  for (const index of expectedIndexes) {
    const rows = await sql`
      select 1 from pg_indexes where schemaname = 'public' and indexname = ${index} limit 1
    `;
    if (!rows.length) missingIndexes.push(index);
  }
  if (missingIndexes.length) throw new Error(`Missing migration indexes: ${missingIndexes.join(', ')}`);

  for (const [typeName, expectedValues] of Object.entries(expectedEnums)) {
    const rows = await sql`
      select e.enumlabel
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public' and t.typname = ${typeName}
      order by e.enumsortorder
    `;
    const values = rows.map((row) => row.enumlabel);
    if (JSON.stringify(values) !== JSON.stringify(expectedValues)) {
      throw new Error(`Unexpected enum values for ${typeName}.`);
    }
  }

  const migrationFiles = readMigrationFiles({ migrationsFolder: 'db/migrations' });
  const migrationRows = await sql`
    select hash, created_at from drizzle.__drizzle_migrations order by created_at
  `;
  if (migrationRows.length !== migrationFiles.length) {
    throw new Error(`Migration journal count mismatch: ${migrationRows.length} != ${migrationFiles.length}.`);
  }
  migrationFiles.forEach((migration, index) => {
    const applied = migrationRows[index];
    if (!applied || applied.hash !== migration.hash || Number(applied.created_at) !== migration.folderMillis) {
      throw new Error(`Migration journal mismatch at index ${index}.`);
    }
  });

  const roleRules = await sql`select count(*)::int as count from entity_asset_role_rules`;
  const previews = await sql`select count(*)::int as count from preview_characters`;
  const characters = await sql`select count(*)::int as count from characters`;
  const skins = await sql`select count(*)::int as count from skins`;
  const skinMappings = await sql`select count(*)::int as count from skin_asset_mappings`;
  const foreignKeys = await sql`
    select count(*)::int as count
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and r.relname in ('character_publication_states', 'preview_characters', 'preview_character_reconciliations', 'entity_asset_mappings', 'asset_upload_intents')
  `;
  const checks = await sql`
    select count(*)::int as count
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where c.contype = 'c' and n.nspname = 'public'
      and r.relname in ('character_publication_states', 'preview_characters', 'entity_asset_role_rules', 'entity_asset_mappings', 'asset_upload_intents', 'asset_objects')
  `;
  console.log(JSON.stringify({
    status: 'PASS',
    database: requestedDatabase || 'configured',
    migrationCount: migrationRows.length,
    roleRules: Number(roleRules[0].count),
    previewRows: Number(previews[0].count),
    characters: Number(characters[0].count),
    skins: Number(skins[0].count),
    skinAssetMappings: Number(skinMappings[0].count),
    foreignKeys: Number(foreignKeys[0].count),
    checks: Number(checks[0].count),
  }));
} finally {
  await sql.end({ timeout: 5 });
}
