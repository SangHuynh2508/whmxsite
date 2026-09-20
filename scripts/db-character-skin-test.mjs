import { closeDb, getDb } from '../db/client.mjs';
import { sql } from 'drizzle-orm';

const db = getDb();

function count(rows, key = 'count') {
  return Number(rows[0]?.[key] ?? 0);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertZero(actual, label) {
  assertEqual(actual, 0, label);
}

try {
  const counts = {};
  for (const table of [
    'characters',
    'series',
    'skins',
    'acquisition_categories',
    'asset_objects',
    'skin_series_state',
    'skin_acquisition_state',
    'skin_asset_mappings',
  ]) {
    counts[table] = count(await db.execute(sql.raw(`select count(*)::int as count from ${table}`)));
  }
  assertEqual(counts.characters, 133, 'characters');
  assertEqual(counts.series, 19, 'series');
  assertEqual(counts.skins, 145, 'skins');
  assertEqual(counts.acquisition_categories, 7, 'acquisition categories');
  assertEqual(counts.asset_objects, 435, 'asset objects');
  assertEqual(counts.skin_series_state, 145, 'skin Series state');
  assertEqual(counts.skin_acquisition_state, 145, 'skin acquisition state');
  assertEqual(counts.skin_asset_mappings, 435, 'skin asset mappings');

  const highSkinCount = count(await db.execute(sql`select count(*)::int as count from skins where is_high_skin = true`));
  assertEqual(highSkinCount, 10, 'High Skin count');
  const nullSeries = await db.execute(sql`select skin_id from skins where raw_series_id is null`);
  assertEqual(nullSeries.length, 1, 'null Series count');
  assertEqual(nullSeries[0]?.skin_id, 'S0174003', 'null Series skin');

  const orphanSkins = count(await db.execute(sql`
    select count(*)::int as count
    from skins s
    left join characters c on c.entity_id = s.character_entity_id
    where c.entity_id is null
  `));
  const orphanSeries = count(await db.execute(sql`
    select count(*)::int as count
    from skin_series_state ss
    left join series sr on sr.series_id = ss.source_series_id
    where ss.source_series_id is not null and sr.entity_id is null
  `));
  const orphanAssets = count(await db.execute(sql`
    select count(*)::int as count
    from skin_asset_mappings sm
    left join asset_objects ao on ao.id = sm.source_asset_id
    where ao.id is null
  `));
  assertZero(orphanSkins, 'skin -> character FK');
  assertZero(orphanSeries, 'skin -> Series FK');
  assertZero(orphanAssets, 'skin -> asset FK');

  const invalidAssetRoles = count(await db.execute(sql`
    select count(*)::int as count
    from skin_asset_mappings
    where asset_role not in ('drawing', 'card', 'avatar')
  `));
  assertZero(invalidAssetRoles, 'asset roles');

  const snapshots = await db.execute(sql`
    select source_kind, content_hash
    from source_snapshots
    where source_kind in ('masterdata', 'workbook', 'normalized_build')
  `);
  const requiredSourceKinds = ['masterdata', 'workbook', 'normalized_build'];
  const sourceKinds = new Set(snapshots.map((row) => row.source_kind));
  if (
    requiredSourceKinds.some((sourceKind) => !sourceKinds.has(sourceKind)) ||
    snapshots.some((row) => !row.content_hash)
  ) {
    throw new Error('source receipts are incomplete');
  }

  console.log(JSON.stringify({
    test: 'character-skin-schema-and-relations',
    status: 'PASS',
    counts,
    highSkinCount,
    nullSeries: nullSeries[0].skin_id,
    sourceReceiptCount: snapshots.length,
    sourceReceiptKinds: requiredSourceKinds,
  }));
} finally {
  await closeDb();
}
