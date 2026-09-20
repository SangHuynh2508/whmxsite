import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import {
  acquisitionCategories,
  assetObjects,
  characters,
  fieldOverrides,
  series,
  skinAcquisitionState,
  skinAssetMappings,
  skinSeriesState,
  skins,
} from '../db/schema/character-skin.mjs';
import {
  editHistory,
  importRuns,
  managedEntities,
  sourceSnapshots,
} from '../db/schema/core.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MASTER_ROOT = resolve(PROJECT_ROOT, '..', 'NeoArtifacts', 'MasterData', 'json');
const DEFAULT_WORKBOOK = join(PROJECT_ROOT, 'localization', 'localization_master.xlsx');
const DEFAULT_MANIFEST = join(PROJECT_ROOT, 'asset-publish-manifest.json');
const DEFAULT_PUBLIC_ROOT = join(PROJECT_ROOT, 'public');
const READER = join(PROJECT_ROOT, 'scripts', 'read_character_skin_sources.py');

const SERIES_NAMES = Object.freeze({
  202: ['新春', 'Tân Xuân'],
  203: ['花朝', 'Hoa Triêu'],
  204: ['节气', 'Tiết Khí'],
  205: ['非遗', 'Phi Di'],
  206: ['闲趣', 'Nhàn Thú'],
  207: ['长安', 'Trường An'],
  208: ['绮梦', 'Ỷ Mộng'],
  209: ['幸食', 'Hạnh Thực'],
  210: ['纪念', 'Kỷ Niệm'],
  211: ['异象', 'Dị Tượng'],
  212: ['幻景', 'Huyễn Cảnh'],
  213: ['行者', 'Hành Giả'],
  214: ['裁样', 'Tài Dạng'],
  215: ['聆律', 'Linh Luật'],
  216: ['秦音', 'Tần Âm'],
  217: ['织彩', 'Chức Thải'],
  218: ['异世', 'Dị Thế'],
  219: ['消暑', 'Tiêu Thử'],
  220: ['云想新裳', 'Vân Tưởng Tân Thường'],
});

const CATEGORY_ROWS = Object.freeze([
  { id: 'premium', labelVi: 'Cao Cấp', labelCn: 'High Skin', sortOrder: 1 },
  { id: 'travel', labelVi: 'Du Lịch', labelCn: '游历', sortOrder: 2 },
  { id: 'event', labelVi: 'Sự Kiện', labelCn: '活动', sortOrder: 3 },
  { id: 'shop', labelVi: 'Cửa Hàng', labelCn: '衣装店/礼包/易市', sortOrder: 4 },
  { id: 'training', labelVi: 'Tập Huấn', labelCn: '集训易市', sortOrder: 5 },
  { id: 'story', labelVi: 'Cốt Truyện', labelCn: '章节解锁', sortOrder: 6 },
  { id: 'free', labelVi: 'Miễn Phí', labelCn: '彩蛋赠送', sortOrder: 7 },
]);

const CATEGORY_BY_OBTAIN_CN = Object.freeze({
  '通过游历获得': 'travel',
  '通过活动获得': 'event',
  '通过预约奖励获得': 'event',
  '通过花朝昔时活动获得': 'event',
  '通过协韵行歌活动获得': 'event',
  '通过衣装店限时销售': 'shop',
  '通过礼包限时销售': 'shop',
  '通过集训易市获得': 'training',
  '通过珍集易市获得': 'shop',
  '通关第七章解锁': 'story',
  '彩蛋赠送': 'free',
});

function asText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function hashValue(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function hashFile(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function fileReceipt(filePath, displayPath) {
  const stat = statSync(filePath);
  return {
    path: displayPath,
    bytes: stat.size,
    sha256: hashFile(filePath),
  };
}

function parseJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertSafeRelativeAssetPath(assetPath) {
  const value = asText(assetPath);
  if (!value || value.startsWith('/') || value.includes('..') || value.includes('\\')) {
    throw new Error('invalid asset path in source workbook');
  }
  return value;
}

function runWorkbookReader(workbookPath) {
  const output = execFileSync('python', [READER, '--workbook', workbookPath], {
    encoding: 'utf8',
    maxBuffer: 24 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(output);
}

function chooseCategory({ obtainCn, isHighSkin }) {
  if (isHighSkin) return 'premium';
  const category = CATEGORY_BY_OBTAIN_CN[obtainCn];
  if (!category) throw new Error(`unmapped acquisition source: ${obtainCn || '(empty)'}`);
  return category;
}

function relativeSourcePath(filePath) {
  return relative(resolve(PROJECT_ROOT, '..'), filePath).split(sep).join('/');
}

function buildAssetCandidate({ workbookPath, publicRoot, manifest, row, role, provider, key, localPath }) {
  const safeKey = assertSafeRelativeAssetPath(key);
  let contentHash;
  let mimeType;
  let metadata;
  let publicUrl;
  if (provider === 'r2') {
    const entry = manifest.assets[safeKey];
    if (!entry) throw new Error(`missing asset manifest entry: ${safeKey}`);
    contentHash = entry.optimized_sha256;
    mimeType = entry.content_type;
    metadata = {
      characterId: row.character_id,
      sourceFilename: entry.source_filename,
      optimizedBytes: entry.optimized_bytes,
      width: entry.width,
      height: entry.height,
      policyVersion: entry.policy_version,
    };
    publicUrl = `${manifest.public_base_url.replace(/\/$/, '')}/${safeKey}`;
  } else {
    const safeLocal = assertSafeRelativeAssetPath(localPath);
    const absolute = join(publicRoot, 'assets', safeLocal);
    if (!absolute.startsWith(join(publicRoot, 'assets') + sep) || !statSync(absolute, { throwIfNoEntry: false })) {
      throw new Error(`missing public asset: ${safeLocal}`);
    }
    contentHash = hashFile(absolute);
    mimeType = safeLocal.toLowerCase().endsWith('.png') ? 'image/png' : 'application/octet-stream';
    metadata = { path: `public/assets/${safeLocal}` };
    publicUrl = `/assets/${safeLocal}`;
  }
  return {
    skinId: row.skin_id,
    role,
    storageProvider: provider,
    objectKey: safeKey,
    publicUrl,
    contentHash,
    mimeType,
    metadata: { ...metadata, sourceWorkbook: relativeSourcePath(workbookPath) },
  };
}

export function loadSourceBundle({
  masterRoot = DEFAULT_MASTER_ROOT,
  workbookPath = DEFAULT_WORKBOOK,
  manifestPath = DEFAULT_MANIFEST,
  publicRoot = DEFAULT_PUBLIC_ROOT,
  validateExpectedCounts = true,
} = {}) {
  const characterTablePath = join(masterRoot, 'characterTable.json');
  const characterSkinsPath = join(masterRoot, 'characterSkins.json');
  const highSkinPath = join(masterRoot, 'CharacterHighSkinMap.json');
  const characterTable = parseJson(characterTablePath);
  const characterSkins = parseJson(characterSkinsPath);
  const highSkinMap = parseJson(highSkinPath);
  const manifest = parseJson(manifestPath);
  const workbook = runWorkbookReader(resolve(workbookPath));
  const rawSkinMap = new Map();
  for (const [ownerId, records] of Object.entries(characterSkins)) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (record?.skinType !== 3) continue;
      if (!record.skinID || rawSkinMap.has(record.skinID)) throw new Error(`duplicate raw actual skin: ${record.skinID}`);
      rawSkinMap.set(record.skinID, { ...record, ownerId });
    }
  }

  const workbookCharacters = new Map(workbook.characters.map((row) => [row.character_id, row]));
  const workbookSkins = new Map(workbook.skins.map((row) => [row.skin_id, row]));
  if (validateExpectedCounts) {
    if (workbook.characters.length !== 133) throw new Error(`expected 133 CHARACTER rows, got ${workbook.characters.length}`);
    if (workbook.skins.length !== 145) throw new Error(`expected 145 SKIN rows, got ${workbook.skins.length}`);
    if (rawSkinMap.size !== 145) throw new Error(`expected 145 raw actual skins, got ${rawSkinMap.size}`);
  }

  const characterCandidates = [];
  for (const row of workbook.characters) {
    const raw = characterTable[row.character_id];
    if (!raw) throw new Error(`workbook character missing raw record: ${row.character_id}`);
    const rawTagsCn = asText(raw.CharacterTagLanText);
    const workbookTagsCn = asText(row.tags_cn);
    if (rawTagsCn !== workbookTagsCn) throw new Error(`Character tags source mismatch: ${row.character_id}`);
    characterCandidates.push({
      characterId: row.character_id,
      nameCn: asText(raw.namelanText) || row.name_cn || row.character_id,
      fullnameCn: asText(raw.FullnameLanText),
      nameVi: asText(row.name_vi),
      fullnameVi: asText(row.fullname_vi),
      nicknameVi: asText(row.nickname_vi),
      tagsVi: asText(row.tags_vi),
      rawRare: raw.rare ?? null,
      rawJob: raw.job ?? null,
      rawAttackType: raw.attacktype ?? null,
      rawUnlockDate: raw.UnlockDate || null,
      rawIdentity: {
        id: raw.id,
        namelan: raw.namelan,
        FullnameLan: raw.FullnameLan,
        CharacterTagLan: raw.CharacterTagLan,
        CharacterTagLanText: rawTagsCn,
        Switch: raw.Switch ?? null,
        Linkage: raw.Linkage ?? null,
      },
      sourceValueHash: hashValue({
        id: raw.id,
        nameCn: raw.namelanText,
        fullnameCn: raw.FullnameLanText,
        tagsCn: rawTagsCn,
        rare: raw.rare ?? null,
        job: raw.job ?? null,
        attacktype: raw.attacktype ?? null,
        unlockDate: raw.UnlockDate || null,
      }),
      workbookValueHash: hashValue({
        nameVi: row.name_vi,
        fullnameVi: row.fullname_vi,
        nicknameVi: row.nickname_vi,
        tagsVi: row.tags_vi,
      }),
    });
  }

  const skinCandidates = [];
  const seriesCandidates = new Map();
  const assetCandidates = [];
  for (const row of workbook.skins) {
    const raw = rawSkinMap.get(row.skin_id);
    if (!raw) throw new Error(`workbook skin missing raw actual record: ${row.skin_id}`);
    const rawSeriesId = raw.skinLOGO === 0 ? null : Number(raw.skinLOGO);
    const workbookSeriesId = row.series_id === null || row.series_id === undefined ? null : Number(row.series_id);
    if (raw.characterId !== row.character_id) throw new Error(`skin character relation mismatch: ${row.skin_id}`);
    if (raw.skinType !== 3 || Number(row.skin_type) !== 3) throw new Error(`non-actual skin in accepted workbook: ${row.skin_id}`);
    if (rawSeriesId !== workbookSeriesId) throw new Error(`skin Series mismatch: ${row.skin_id}`);
    const isHighSkin = Boolean(highSkinMap[row.skin_id]) || raw.highskin === 1;
    if (isHighSkin !== asBool(row.is_high_skin)) throw new Error(`High Skin mismatch: ${row.skin_id}`);
    if (rawSeriesId !== null) {
      const canonical = SERIES_NAMES[rawSeriesId];
      if (!canonical || row.series_name_cn !== canonical[0] || row.series_name_vi !== canonical[1]) {
        throw new Error(`unknown or mismatched Series source: ${row.skin_id}`);
      }
      seriesCandidates.set(rawSeriesId, {
        seriesId: rawSeriesId,
        nameCn: canonical[0],
        nameVi: canonical[1],
        sourceValueHash: hashValue({ seriesId: rawSeriesId, nameCn: canonical[0] }),
      });
    }
    const categoryId = chooseCategory({ obtainCn: raw.getdescriptionLanText, isHighSkin });
    const rawSource = {
      skinID: raw.skinID,
      characterId: raw.characterId,
      skinType: raw.skinType,
      skinLOGO: raw.skinLOGO,
      skinRare: raw.skinRare,
      highskin: raw.highskin ?? null,
      bIsBaseSkin: raw.bIsBaseSkin,
      UnlockDate: raw.UnlockDate,
      mapItemsID: raw.mapItemsID ?? null,
      goodsID: raw.goodsID ?? null,
      discountGoodsID: raw.discountGoodsID ?? null,
      CvName: raw.CvName ?? null,
    };
    const workbookValue = {
      skinNameVi: row.skin_name_vi,
      descriptionVi: row.desc_vi,
      obtainVi: row.obtain_vi,
      drawingPath: row.drawing_path,
      cardPath: row.card_path,
      avatarPath: row.avatar_path,
      seriesId: workbookSeriesId,
    };
    skinCandidates.push({
      skinId: row.skin_id,
      characterId: row.character_id,
      skinNameCn: asText(raw.skinNamelanText) || row.skin_name_cn || row.skin_id,
      skinNameVi: asText(row.skin_name_vi),
      descriptionCn: asText(raw.skinFileLanText),
      descriptionVi: asText(row.desc_vi),
      obtainCn: asText(raw.getdescriptionLanText),
      obtainVi: asText(row.obtain_vi),
      categoryId,
      isBaseSkin: Boolean(raw.bIsBaseSkin),
      skinType: raw.skinType,
      unlockDate: raw.UnlockDate || null,
      price: row.price ?? null,
      currency: asText(row.currency),
      isHighSkin,
      skinRareRaw: raw.skinRare ?? null,
      cvName: asText(raw.CvName),
      rawItemId: asText(raw.mapItemsID),
      rawGoodsId: asText(raw.goodsID),
      rawDiscountGoodsId: asText(raw.discountGoodsID),
      rawDiscountPrice: row.discount_price ?? null,
      rawDiscountStart: row.discount_start ?? null,
      rawDiscountEnd: row.discount_end ?? null,
      rawSeriesId,
      rawSource,
      sourceValueHash: hashValue(rawSource),
      workbookValueHash: hashValue(workbookValue),
    });
    assetCandidates.push(
      buildAssetCandidate({
        workbookPath,
        publicRoot,
        manifest,
        row,
        role: 'drawing',
        provider: 'r2',
        key: row.drawing_path,
      }),
      buildAssetCandidate({
        workbookPath,
        publicRoot,
        manifest,
        row,
        role: 'card',
        provider: 'r2',
        key: row.card_path,
      }),
      buildAssetCandidate({
        workbookPath,
        publicRoot,
        manifest,
        row,
        role: 'avatar',
        provider: 'public',
        key: `characters/avatars/${row.skin_id.toLowerCase()}.png`,
        localPath: `characters/avatars/${row.skin_id.toLowerCase()}.png`,
      }),
    );
  }

  if (validateExpectedCounts) {
    const highCount = skinCandidates.filter((candidate) => candidate.isHighSkin).length;
    if (highCount !== 10) throw new Error(`expected 10 High Skins, got ${highCount}`);
    const noSeries = skinCandidates.filter((candidate) => candidate.skinId === 'S0174003');
    if (noSeries.length !== 1 || noSeries[0].rawSeriesId !== null) throw new Error('S0174003 must have null Series');
    if (skinCandidates.some((candidate) => candidate.rawSeriesId === null && candidate.skinId !== 'S0174003')) {
      throw new Error('unexpected null Series in accepted actual-skin source');
    }
  }

  const rawFiles = [
    ['NeoArtifacts/MasterData/json/characterTable.json', characterTablePath],
    ['NeoArtifacts/MasterData/json/characterSkins.json', characterSkinsPath],
    ['NeoArtifacts/MasterData/json/CharacterHighSkinMap.json', highSkinPath],
    [relativeSourcePath(manifestPath), resolve(manifestPath)],
  ].map(([displayPath, filePath]) => fileReceipt(filePath, displayPath));
  const workbookReceipt = fileReceipt(resolve(workbookPath), relativeSourcePath(resolve(workbookPath)));
  const rawHash = hashValue(rawFiles);
  const workbookHash = workbookReceipt.sha256;
  const normalizedHash = hashValue({ rawHash, workbookHash, characterCount: characterCandidates.length, skinCount: skinCandidates.length });

  return {
    receipts: {
      raw: {
        sourceKind: 'masterdata',
        sourceVersion: 'character-skin-masterdata-v1',
        contentHash: rawHash,
        sourcePath: 'NeoArtifacts/MasterData/json',
        manifest: { files: rawFiles },
      },
      workbook: {
        sourceKind: 'workbook',
        sourceVersion: 'localization-master-v1',
        contentHash: workbookHash,
        sourcePath: relativeSourcePath(resolve(workbookPath)),
        manifest: { file: workbookReceipt, sheets: ['CHARACTER', 'SKIN'] },
      },
      normalized: {
        sourceKind: 'normalized_build',
        sourceVersion: 'character-skin-import-v1',
        contentHash: normalizedHash,
        sourcePath: 'scripts/import-character-skin.mjs',
        manifest: { rawHash, workbookHash, characterCount: characterCandidates.length, skinCount: skinCandidates.length },
      },
    },
    characters: characterCandidates,
    series: [...seriesCandidates.values()].sort((left, right) => left.seriesId - right.seriesId),
    skins: skinCandidates,
    assets: assetCandidates,
    workbookCharacters,
    workbookSkins,
  };
}

async function ensureSnapshot(tx, receipt) {
  const existing = await tx
    .select()
    .from(sourceSnapshots)
    .where(and(eq(sourceSnapshots.sourceKind, receipt.sourceKind), eq(sourceSnapshots.sourceVersion, receipt.sourceVersion), eq(sourceSnapshots.contentHash, receipt.contentHash)))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await tx.insert(sourceSnapshots).values({
    sourceKind: receipt.sourceKind,
    sourceVersion: receipt.sourceVersion,
    contentHash: receipt.contentHash,
    sourcePath: receipt.sourcePath,
    manifest: receipt.manifest,
  }).returning();
  return inserted[0];
}

function makeCounts() {
  return {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    conflicted: 0,
    skipped: 0,
    byEntity: {},
  };
}

function bump(counts, entityType, kind) {
  counts[kind] += 1;
  counts.byEntity[entityType] ??= makeCounts();
  counts.byEntity[entityType][kind] += 1;
}

async function insertAuditRows(tx, rows) {
  if (rows.length) await tx.insert(editHistory).values(rows);
}

function auditRow({ runId, entityId, entityType, fieldName, oldValue, newValue, metadata = {} }) {
  return {
    changeGroupId: runId,
    entityId,
    entityType,
    fieldName,
    eventType: 'source_import',
    oldValue,
    newValue,
    importRunId: runId,
    requestId: runId,
    metadata,
  };
}

async function loadManagedMaps(tx) {
  const rows = await tx.select().from(managedEntities);
  return new Map(rows.map((row) => [`${row.entityType}:${row.sourceKey}`, row]));
}

async function ensureManagedEntities(tx, candidates) {
  const managed = await loadManagedMaps(tx);
  const missing = candidates.filter((candidate) => !managed.has(`${candidate.entityType}:${candidate.sourceKey}`));
  if (missing.length) {
    await tx.insert(managedEntities).values(missing.map((candidate) => ({
      entityType: candidate.entityType,
      sourceKey: candidate.sourceKey,
    }))).onConflictDoNothing({ target: [managedEntities.entityType, managedEntities.sourceKey] });
  }
  const refreshed = await loadManagedMaps(tx);
  return refreshed;
}

function overrideFieldValues(candidate, entityType) {
  if (entityType === 'character') {
    return {
      name_vi: candidate.nameVi,
      fullname_vi: candidate.fullnameVi,
      nickname_vi: candidate.nicknameVi,
      tags_vi: candidate.tagsVi,
    };
  }
  if (entityType === 'skin') {
    return {
      name_vi: candidate.skinNameVi,
      description_vi: candidate.descriptionVi,
      obtain_vi: candidate.obtainVi,
    };
  }
  return {};
}

async function applyFieldOverrideConflicts(tx, candidate, entityType, entityId, runId, counts, audits, activeOverrides, baseSnapshotId) {
  const rows = activeOverrides.filter((row) => row.entityId === entityId && row.state === 'active');
  const values = overrideFieldValues(candidate, entityType);
  for (const override of rows) {
    if (!(override.fieldName in values)) continue;
    const nextHash = hashValue(values[override.fieldName]);
    if (nextHash === override.baseSourceHash) continue;
    await tx.update(fieldOverrides).set({
      baseSourceValue: values[override.fieldName],
      baseSourceHash: nextHash,
      baseSourceSnapshotId: baseSnapshotId,
      state: 'source_changed',
      updatedAt: new Date(),
    }).where(eq(fieldOverrides.id, override.id));
    bump(counts, entityType, 'conflicted');
    audits.push(auditRow({
      runId,
      entityId,
      entityType,
      fieldName: override.fieldName,
      oldValue: { baseSourceHash: override.baseSourceHash, state: override.state },
      newValue: { baseSourceHash: nextHash, state: 'source_changed' },
      metadata: { conflict: 'active_override_underlying_source_changed' },
    }));
  }
}

async function upsertDomainRow(tx, table, current, entityId, values, entityType, sourceHash, workbookHash, runId, counts, audits, now) {
  const existing = current.get(entityId);
  if (!existing) {
    await tx.insert(table).values({ entityId, ...values });
    bump(counts, entityType, 'inserted');
    audits.push(auditRow({ runId, entityId, entityType, fieldName: 'source_baseline', oldValue: null, newValue: { sourceValueHash: sourceHash, workbookValueHash: workbookHash } }));
    return;
  }
  const changed = existing.sourceValueHash !== sourceHash || (workbookHash !== null && existing.workbookValueHash !== workbookHash);
  if (!changed) {
    bump(counts, entityType, 'unchanged');
    return;
  }
  await tx.update(table).set({ ...values, sourcePresent: true, sourceSeenAt: now, updatedAt: now }).where(eq(table.entityId, entityId));
  await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(eq(managedEntities.id, entityId));
  bump(counts, entityType, 'updated');
  audits.push(auditRow({ runId, entityId, entityType, fieldName: 'source_baseline', oldValue: { sourceValueHash: existing.sourceValueHash, workbookValueHash: existing.workbookValueHash }, newValue: { sourceValueHash: sourceHash, workbookValueHash: workbookHash } }));
}

async function seedCategories(tx) {
  const existing = await tx.select().from(acquisitionCategories);
  const known = new Set(existing.map((row) => row.id));
  const missing = CATEGORY_ROWS.filter((row) => !known.has(row.id));
  if (missing.length) await tx.insert(acquisitionCategories).values(missing.map((row) => ({ id: row.id, labelVi: row.labelVi, labelCn: row.labelCn, sortOrder: row.sortOrder })));
}

async function upsertAssets(tx, bundle, rawSnapshotId) {
  const unique = new Map(bundle.assets.map((asset) => [`${asset.storageProvider}:${asset.objectKey}`, asset]));
  const existing = await tx.select().from(assetObjects);
  const existingByKey = new Map(existing.map((asset) => [`${asset.storageProvider}:${asset.objectKey}`, asset]));
  const missing = [];
  for (const asset of unique.values()) {
    const key = `${asset.storageProvider}:${asset.objectKey}`;
    const existingAsset = existingByKey.get(key);
    if (!existingAsset) {
      missing.push({
        storageProvider: asset.storageProvider,
        objectKey: asset.objectKey,
        publicUrl: asset.publicUrl,
        contentHash: asset.contentHash,
        mimeType: asset.mimeType,
        sourceSnapshotId: rawSnapshotId,
        metadata: asset.metadata,
      });
    } else if (
      existingAsset.contentHash !== asset.contentHash
      || existingAsset.publicUrl !== asset.publicUrl
      || existingAsset.mimeType !== asset.mimeType
      || JSON.stringify(existingAsset.metadata) !== JSON.stringify(asset.metadata)
    ) {
      await tx.update(assetObjects).set({
        publicUrl: asset.publicUrl,
        contentHash: asset.contentHash,
        mimeType: asset.mimeType,
        sourceSnapshotId: rawSnapshotId,
        metadata: asset.metadata,
      }).where(eq(assetObjects.id, existingAsset.id));
    }
  }
  if (missing.length) await tx.insert(assetObjects).values(missing);
  const refreshed = await tx.select().from(assetObjects);
  return new Map(refreshed.map((asset) => [`${asset.storageProvider}:${asset.objectKey}`, asset]));
}

async function applyTypedState(tx, table, current, currentKey, key, values, sourceHash, rawSnapshotId, entityType, entityId, runId, counts, audits, now, active) {
  const existing = current.get(currentKey);
  if (!existing) {
    await tx.insert(table).values(values);
    return;
  }
  if (existing.baseSourceHash === sourceHash) return;
  const conflict = active(existing);
  await tx.update(table).set({
    ...values,
    baseSourceHash: sourceHash,
    baseSourceSnapshotId: rawSnapshotId,
    updatedAt: now,
    state: conflict ? 'source_changed' : existing.state,
  }).where(and(...key.map(([column, value]) => eq(column, value))));
  if (conflict) {
    bump(counts, entityType, 'conflicted');
    audits.push(auditRow({ runId, entityId, entityType, fieldName: table === skinSeriesState ? 'series_id' : table === skinAcquisitionState ? 'acquisition_category' : 'asset_mapping', oldValue: { baseSourceHash: existing.baseSourceHash, state: existing.state }, newValue: { baseSourceHash: sourceHash, state: 'source_changed' }, metadata: { conflict: 'active_typed_override_underlying_source_changed' } }));
  }
}

export async function runImport(db, bundle, { validateExpectedCounts = true, failAfterEntity = null } = {}) {
  if (validateExpectedCounts) {
    if (bundle.characters.length !== 133 || bundle.skins.length !== 145 || bundle.skins.filter((skin) => skin.isHighSkin).length !== 10) {
      throw new Error('source bundle does not meet the accepted Character/Skin counts');
    }
  }
  const counts = makeCounts();
  const now = new Date();
  return db.transaction(async (tx) => {
    const rawSnapshot = await ensureSnapshot(tx, bundle.receipts.raw);
    const workbookSnapshot = await ensureSnapshot(tx, bundle.receipts.workbook);
    const normalizedSnapshot = await ensureSnapshot(tx, bundle.receipts.normalized);
    const run = (await tx.insert(importRuns).values({ sourceSnapshotId: normalizedSnapshot.id, status: 'started', counts: {} }).returning())[0];
    await seedCategories(tx);
    const managedCandidates = [
      ...bundle.characters.map((candidate) => ({ entityType: 'character', sourceKey: candidate.characterId })),
      ...bundle.series.map((candidate) => ({ entityType: 'series', sourceKey: String(candidate.seriesId) })),
      ...bundle.skins.map((candidate) => ({ entityType: 'skin', sourceKey: candidate.skinId })),
    ];
    const managed = await ensureManagedEntities(tx, managedCandidates);
    const characterRows = await tx.select().from(characters);
    const seriesRows = await tx.select().from(series);
    const skinRows = await tx.select().from(skins);
    const currentCharacters = new Map(characterRows.map((row) => [row.entityId, row]));
    const currentSeries = new Map(seriesRows.map((row) => [row.entityId, row]));
    const currentSkins = new Map(skinRows.map((row) => [row.entityId, row]));
    const activeOverrides = await tx.select().from(fieldOverrides);
    const audits = [];

    let processed = 0;
    for (const candidate of bundle.characters) {
      const entity = managed.get(`character:${candidate.characterId}`);
      await upsertDomainRow(tx, characters, currentCharacters, entity.id, {
        characterId: candidate.characterId,
        sourceSnapshotId: rawSnapshot.id,
        workbookSnapshotId: workbookSnapshot.id,
        nameCn: candidate.nameCn,
        fullnameCn: candidate.fullnameCn,
        nameVi: candidate.nameVi,
        fullnameVi: candidate.fullnameVi,
        nicknameVi: candidate.nicknameVi,
        tagsVi: candidate.tagsVi,
        rawRare: candidate.rawRare,
        rawJob: candidate.rawJob,
        rawAttackType: candidate.rawAttackType,
        rawUnlockDate: candidate.rawUnlockDate,
        rawIdentity: candidate.rawIdentity,
        sourceValueHash: candidate.sourceValueHash,
        workbookValueHash: candidate.workbookValueHash,
      }, 'character', candidate.sourceValueHash, candidate.workbookValueHash, run.id, counts, audits, now);
      await applyFieldOverrideConflicts(tx, candidate, 'character', entity.id, run.id, counts, audits, activeOverrides, workbookSnapshot.id);
      processed += 1;
      if (failAfterEntity && processed >= failAfterEntity) throw new Error('IMPORT_TEST_FAILURE');
    }

    for (const candidate of bundle.series) {
      const entity = managed.get(`series:${candidate.seriesId}`);
      await upsertDomainRow(tx, series, currentSeries, entity.id, {
        seriesId: candidate.seriesId,
        sourceSnapshotId: rawSnapshot.id,
        workbookSnapshotId: workbookSnapshot.id,
        nameCn: candidate.nameCn,
        nameVi: candidate.nameVi,
        sourceValueHash: candidate.sourceValueHash,
      }, 'series', candidate.sourceValueHash, null, run.id, counts, audits, now);
    }

    for (const candidate of bundle.skins) {
      const entity = managed.get(`skin:${candidate.skinId}`);
      const characterEntity = managed.get(`character:${candidate.characterId}`);
      await upsertDomainRow(tx, skins, currentSkins, entity.id, {
        skinId: candidate.skinId,
        characterEntityId: characterEntity.id,
        sourceSnapshotId: rawSnapshot.id,
        workbookSnapshotId: workbookSnapshot.id,
        skinNameCn: candidate.skinNameCn,
        skinNameVi: candidate.skinNameVi,
        descriptionCn: candidate.descriptionCn,
        descriptionVi: candidate.descriptionVi,
        obtainCn: candidate.obtainCn,
        obtainVi: candidate.obtainVi,
        isBaseSkin: candidate.isBaseSkin,
        skinType: candidate.skinType,
        unlockDate: candidate.unlockDate,
        price: candidate.price,
        currency: candidate.currency,
        isHighSkin: candidate.isHighSkin,
        skinRareRaw: candidate.skinRareRaw,
        cvName: candidate.cvName,
        rawItemId: candidate.rawItemId,
        rawGoodsId: candidate.rawGoodsId,
        rawDiscountGoodsId: candidate.rawDiscountGoodsId,
        rawDiscountPrice: candidate.rawDiscountPrice,
        rawDiscountStart: candidate.rawDiscountStart,
        rawDiscountEnd: candidate.rawDiscountEnd,
        rawSeriesId: candidate.rawSeriesId,
        rawSource: candidate.rawSource,
        sourceValueHash: candidate.sourceValueHash,
        workbookValueHash: candidate.workbookValueHash,
      }, 'skin', candidate.sourceValueHash, candidate.workbookValueHash, run.id, counts, audits, now);
      await applyFieldOverrideConflicts(tx, { skinNameVi: candidate.skinNameVi, descriptionVi: candidate.descriptionVi, obtainVi: candidate.obtainVi }, 'skin', entity.id, run.id, counts, audits, activeOverrides, workbookSnapshot.id);
    }

    const assetMap = await upsertAssets(tx, bundle, rawSnapshot.id);
    const currentSeriesStates = new Map((await tx.select().from(skinSeriesState)).map((row) => [row.skinEntityId, row]));
    const currentAcquisitionStates = new Map((await tx.select().from(skinAcquisitionState)).map((row) => [row.skinEntityId, row]));
    const currentMappings = new Map((await tx.select().from(skinAssetMappings)).map((row) => [`${row.skinEntityId}:${row.assetRole}`, row]));
    for (const candidate of bundle.skins) {
      const entity = managed.get(`skin:${candidate.skinId}`);
      const seriesHash = hashValue({ seriesId: candidate.rawSeriesId });
      await applyTypedState(tx, skinSeriesState, currentSeriesStates, entity.id, [[skinSeriesState.skinEntityId, entity.id]], {
        skinEntityId: entity.id,
        sourceSeriesId: candidate.rawSeriesId,
        overrideMode: 'inherit',
        overrideSeriesId: null,
        baseSourceValue: candidate.rawSeriesId,
        baseSourceHash: seriesHash,
        baseSourceSnapshotId: rawSnapshot.id,
      }, seriesHash, rawSnapshot.id, 'skin', entity.id, run.id, counts, audits, now, (row) => row.overrideMode !== 'inherit');
      const acquisitionHash = hashValue({ categoryId: candidate.categoryId, obtainCn: candidate.obtainCn, isHighSkin: candidate.isHighSkin });
      await applyTypedState(tx, skinAcquisitionState, currentAcquisitionStates, entity.id, [[skinAcquisitionState.skinEntityId, entity.id]], {
        skinEntityId: entity.id,
        sourceCategoryId: candidate.categoryId,
        overrideCategoryId: null,
        baseSourceValue: { categoryId: candidate.categoryId, obtainCn: candidate.obtainCn, isHighSkin: candidate.isHighSkin },
        baseSourceHash: acquisitionHash,
        baseSourceSnapshotId: rawSnapshot.id,
      }, acquisitionHash, rawSnapshot.id, 'skin', entity.id, run.id, counts, audits, now, (row) => row.overrideCategoryId !== null);
      for (const asset of bundle.assets.filter((item) => item.skinId === candidate.skinId)) {
        const sourceAsset = assetMap.get(`${asset.storageProvider}:${asset.objectKey}`);
        if (!sourceAsset) throw new Error(`asset metadata missing after upsert: ${asset.objectKey}`);
        const mappingKey = `${entity.id}:${asset.role}`;
        const mappingHash = hashValue({ provider: asset.storageProvider, objectKey: asset.objectKey, contentHash: asset.contentHash });
        await applyTypedState(tx, skinAssetMappings, currentMappings, mappingKey, [[skinAssetMappings.skinEntityId, entity.id], [skinAssetMappings.assetRole, asset.role]], {
          skinEntityId: entity.id,
          assetRole: asset.role,
          sourceAssetId: sourceAsset.id,
          overrideAssetId: null,
          baseSourceHash: mappingHash,
          baseSourceSnapshotId: rawSnapshot.id,
        }, mappingHash, rawSnapshot.id, 'skin', entity.id, run.id, counts, audits, now, (row) => row.overrideAssetId !== null);
        currentMappings.set(mappingKey, { ...(currentMappings.get(mappingKey) || {}), baseSourceHash: mappingHash });
      }
    }

    const existingManaged = await tx.select().from(managedEntities);
    const seen = new Set(managedCandidates.map((candidate) => `${candidate.entityType}:${candidate.sourceKey}`));
    for (const entity of existingManaged) {
      if (!seen.has(`${entity.entityType}:${entity.sourceKey}`)) bump(counts, entity.entityType, 'skipped');
    }
    await insertAuditRows(tx, audits);
    const status = counts.conflicted > 0 ? 'completed_with_conflicts' : 'completed';
    await tx.update(importRuns).set({ status, finishedAt: new Date(), counts }).where(eq(importRuns.id, run.id));
    return { importRunId: run.id, status, counts, sourceFingerprints: { raw: bundle.receipts.raw.contentHash, workbook: bundle.receipts.workbook.contentHash, normalized: bundle.receipts.normalized.contentHash } };
  });
}

function parseArgs(argv) {
  const args = { masterRoot: DEFAULT_MASTER_ROOT, workbookPath: DEFAULT_WORKBOOK, manifestPath: DEFAULT_MANIFEST, publicRoot: DEFAULT_PUBLIC_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--master-root') args.masterRoot = resolve(argv[++index]);
    else if (value === '--workbook') args.workbookPath = resolve(argv[++index]);
    else if (value === '--manifest') args.manifestPath = resolve(argv[++index]);
    else if (value === '--public-root') args.publicRoot = resolve(argv[++index]);
    else if (value === '--no-count-validation') args.validateExpectedCounts = false;
    else throw new Error(`unknown importer argument: ${value}`);
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const db = getDb();
  try {
    const options = parseArgs(process.argv.slice(2));
    const bundle = loadSourceBundle(options);
    const summary = await runImport(db, bundle, options);
    console.log(JSON.stringify(summary));
  } catch (error) {
    console.error(`IMPORT_FAILED: ${error instanceof Error ? error.message : 'unknown importer failure'}`);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
