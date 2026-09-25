import { createHash, randomUUID } from 'node:crypto';

import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/client.mjs';
import {
  acquisitionCategories,
  assetObjects,
  characters,
  fieldOverrides,
  skinAcquisitionState,
  skinAssetMappings,
  skinSeriesState,
  skins,
  series,
} from '../db/schema/character-skin.mjs';
import { editHistory, managedEntities } from '../db/schema/core.mjs';
import { users } from '../db/schema/auth.mjs';

const CHARACTER_FIELDS = Object.freeze({
  nameVi: { column: characters.nameVi, sourceKey: 'nameVi', fieldName: 'name_vi', label: 'Tên Việt' },
  fullnameVi: { column: characters.fullnameVi, sourceKey: 'fullnameVi', fieldName: 'fullname_vi', label: 'Tên đầy đủ Việt' },
  nicknameVi: { column: characters.nicknameVi, sourceKey: 'nicknameVi', fieldName: 'nickname_vi', label: 'Biệt danh Việt' },
  tagsVi: { column: characters.tagsVi, sourceKey: 'tagsVi', fieldName: 'tags_vi', label: 'Thẻ Việt' },
});

const SKIN_FIELDS = Object.freeze({
  skinNameVi: { column: skins.skinNameVi, sourceKey: 'skinNameVi', fieldName: 'name_vi', label: 'Tên skin Việt' },
  descriptionVi: { column: skins.descriptionVi, sourceKey: 'descriptionVi', fieldName: 'description_vi', label: 'Mô tả Việt' },
  obtainVi: { column: skins.obtainVi, sourceKey: 'obtainVi', fieldName: 'obtain_vi', label: 'Cách nhận Việt' },
});

const characterChangeSchema = z.object({
  actorUserId: z.string().uuid(),
  expectedRevision: z.coerce.number().int().positive(),
  changes: z.object({
    nameVi: z.string().trim().max(10_000).nullable().optional(),
    fullnameVi: z.string().trim().max(10_000).nullable().optional(),
    nicknameVi: z.string().trim().max(10_000).nullable().optional(),
    tagsVi: z.string().trim().max(10_000).nullable().optional(),
  }).strict(),
  requestId: z.string().uuid().optional(),
}).strict();

const skinChangeSchema = z.object({
  actorUserId: z.string().uuid(),
  expectedRevision: z.coerce.number().int().positive(),
  changes: z.object({
    skinNameVi: z.string().trim().max(10_000).nullable().optional(),
    descriptionVi: z.string().trim().max(10_000).nullable().optional(),
    obtainVi: z.string().trim().max(10_000).nullable().optional(),
  }).strict(),
  requestId: z.string().uuid().optional(),
}).strict();

export class CharacterSkinDomainError extends Error {
  constructor(code, status = 400, details = undefined) {
    super(code);
    this.name = 'CharacterSkinDomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(code, status = 400, details) {
  throw new CharacterSkinDomainError(code, status, details);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function hashValue(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function jsonEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function jsonValue(value) {
  return value === null ? sql`'null'::jsonb` : value;
}

async function actorFor(tx, actorUserId) {
  const [actor] = await tx.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, actorUserId));
  if (!actor || actor.status !== 'active') fail('UNAUTHORIZED', 401);
  if (!['owner', 'editor'].includes(actor.role)) fail('FORBIDDEN', 403);
  return actor;
}

function overrideMap(rows) {
  return new Map(rows.map((row) => [`${row.entityId}:${row.fieldName}`, row]));
}

function fieldState(sourceValue, override) {
  const active = override && override.state !== 'cleared';
  return {
    value: active ? override.overrideValue : sourceValue,
    source: sourceValue,
    override: active ? override.overrideValue : null,
    state: override?.state || 'none',
    editable: true,
  };
}

function characterSummary(row, overrides) {
  const by = (field) => fieldState(row[field], overrides.get(`${row.entityId}:${CHARACTER_FIELDS[field].fieldName}`));
  return {
    entityId: row.entityId,
    characterId: row.characterId,
    revision: row.revision,
    updatedAt: row.updatedAt,
    nameCn: row.nameCn,
    fullnameCn: row.fullnameCn,
    tagsCn: normalizeText(row.rawIdentity?.CharacterTagLanText),
    nameVi: by('nameVi'),
    fullnameVi: by('fullnameVi'),
    nicknameVi: by('nicknameVi'),
    tagsVi: by('tagsVi'),
    protected: {
      rawRare: row.rawRare,
      rawJob: row.rawJob,
      rawAttackType: row.rawAttackType,
      rawUnlockDate: row.rawUnlockDate,
      rawIdentity: row.rawIdentity,
      sourceSnapshotId: row.sourceSnapshotId,
      workbookSnapshotId: row.workbookSnapshotId,
    },
  };
}

function skinSummary(row, overrides, relation = {}) {
  const by = (field) => fieldState(row[field], overrides.get(`${row.entityId}:${SKIN_FIELDS[field].fieldName}`));
  return {
    entityId: row.entityId,
    skinId: row.skinId,
    revision: row.revision,
    updatedAt: row.updatedAt,
    skinNameCn: row.skinNameCn,
    descriptionCn: row.descriptionCn,
    obtainCn: row.obtainCn,
    skinNameVi: by('skinNameVi'),
    descriptionVi: by('descriptionVi'),
    obtainVi: by('obtainVi'),
    source: {
      skinType: row.skinType,
      isBaseSkin: row.isBaseSkin,
      isHighSkin: row.isHighSkin,
      skinRareRaw: row.skinRareRaw,
      rawItemId: row.rawItemId,
      rawGoodsId: row.rawGoodsId,
      rawDiscountGoodsId: row.rawDiscountGoodsId,
      rawDiscountPrice: row.rawDiscountPrice,
      rawDiscountStart: row.rawDiscountStart,
      rawDiscountEnd: row.rawDiscountEnd,
      rawSeriesId: row.rawSeriesId,
      sourceSnapshotId: row.sourceSnapshotId,
      workbookSnapshotId: row.workbookSnapshotId,
    },
    relations: relation,
    assets: relation.assets || [],
  };
}

async function characterRows(tx, query = '') {
  const pattern = query.trim() ? `%${query.trim()}%` : null;
  const rows = await tx.select({
    entityId: managedEntities.id,
    revision: managedEntities.revision,
    updatedAt: managedEntities.updatedAt,
    characterId: characters.characterId,
    nameCn: characters.nameCn,
    fullnameCn: characters.fullnameCn,
    nameVi: characters.nameVi,
    fullnameVi: characters.fullnameVi,
    nicknameVi: characters.nicknameVi,
    tagsVi: characters.tagsVi,
    rawRare: characters.rawRare,
    rawJob: characters.rawJob,
    rawAttackType: characters.rawAttackType,
    rawUnlockDate: characters.rawUnlockDate,
    rawIdentity: characters.rawIdentity,
    sourceSnapshotId: characters.sourceSnapshotId,
    workbookSnapshotId: characters.workbookSnapshotId,
  }).from(characters).innerJoin(managedEntities, eq(managedEntities.id, characters.entityId))
    .where(pattern ? or(ilike(characters.characterId, pattern), ilike(characters.nameCn, pattern), ilike(characters.nameVi, pattern)) : undefined)
    .orderBy(asc(characters.characterId));
  const ids = rows.map((row) => row.entityId);
  const overrides = ids.length ? await tx.select().from(fieldOverrides).where(inArray(fieldOverrides.entityId, ids)) : [];
  const mapped = overrideMap(overrides);
  return rows.map((row) => characterSummary(row, mapped));
}

export async function listCharacters({ query = '' } = {}) {
  return characterRows(getDb(), query);
}

async function loadCharacter(tx, characterId) {
  const [row] = await tx.select({
    entityId: managedEntities.id,
    revision: managedEntities.revision,
    updatedAt: managedEntities.updatedAt,
    characterId: characters.characterId,
    nameCn: characters.nameCn,
    fullnameCn: characters.fullnameCn,
    nameVi: characters.nameVi,
    fullnameVi: characters.fullnameVi,
    nicknameVi: characters.nicknameVi,
    tagsVi: characters.tagsVi,
    rawRare: characters.rawRare,
    rawJob: characters.rawJob,
    rawAttackType: characters.rawAttackType,
    rawUnlockDate: characters.rawUnlockDate,
    rawIdentity: characters.rawIdentity,
    sourceSnapshotId: characters.sourceSnapshotId,
    workbookSnapshotId: characters.workbookSnapshotId,
  }).from(characters).innerJoin(managedEntities, eq(managedEntities.id, characters.entityId)).where(eq(characters.characterId, characterId));
  if (!row) fail('NOT_FOUND', 404);
  const skinRows = await tx.select({
    entityId: managedEntities.id,
    revision: managedEntities.revision,
    updatedAt: managedEntities.updatedAt,
    skinId: skins.skinId,
    skinNameCn: skins.skinNameCn,
    descriptionCn: skins.descriptionCn,
    obtainCn: skins.obtainCn,
    skinNameVi: skins.skinNameVi,
    descriptionVi: skins.descriptionVi,
    obtainVi: skins.obtainVi,
    skinType: skins.skinType,
    isBaseSkin: skins.isBaseSkin,
    isHighSkin: skins.isHighSkin,
    skinRareRaw: skins.skinRareRaw,
    rawItemId: skins.rawItemId,
    rawGoodsId: skins.rawGoodsId,
    rawDiscountGoodsId: skins.rawDiscountGoodsId,
    rawDiscountPrice: skins.rawDiscountPrice,
    rawDiscountStart: skins.rawDiscountStart,
    rawDiscountEnd: skins.rawDiscountEnd,
    rawSeriesId: skins.rawSeriesId,
    sourceSnapshotId: skins.sourceSnapshotId,
    workbookSnapshotId: skins.workbookSnapshotId,
  }).from(skins).innerJoin(managedEntities, eq(managedEntities.id, skins.entityId)).where(eq(skins.characterEntityId, row.entityId)).orderBy(asc(skins.skinId));
  const allIds = [row.entityId, ...skinRows.map((skin) => skin.entityId)];
  const overrides = await tx.select().from(fieldOverrides).where(inArray(fieldOverrides.entityId, allIds));
  const mapped = overrideMap(overrides);
  const seriesStates = skinRows.length ? await tx.select().from(skinSeriesState).where(inArray(skinSeriesState.skinEntityId, skinRows.map((skin) => skin.entityId))) : [];
  const acquisitionStates = skinRows.length ? await tx.select().from(skinAcquisitionState).where(inArray(skinAcquisitionState.skinEntityId, skinRows.map((skin) => skin.entityId))) : [];
  const mappingRows = skinRows.length ? await tx.select().from(skinAssetMappings).where(inArray(skinAssetMappings.skinEntityId, skinRows.map((skin) => skin.entityId))) : [];
  const assetIds = [...new Set(mappingRows.flatMap((mapping) => [mapping.sourceAssetId, mapping.overrideAssetId].filter(Boolean)))];
  const assetRows = assetIds.length ? await tx.select().from(assetObjects).where(inArray(assetObjects.id, assetIds)) : [];
  const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));
  const assetsBySkin = new Map();
  for (const mapping of mappingRows) {
    const source = assetById.get(mapping.sourceAssetId);
    const override = mapping.overrideAssetId ? assetById.get(mapping.overrideAssetId) : null;
    const list = assetsBySkin.get(mapping.skinEntityId) || [];
    list.push({ assetRole: mapping.assetRole, source: source ? { id: source.id, url: source.publicUrl, objectKey: source.objectKey, provenance: source.provenance, verificationState: source.verificationState } : null, override: override ? { id: override.id, url: override.publicUrl, objectKey: override.objectKey, provenance: override.provenance, verificationState: override.verificationState } : null, state: mapping.state, readOnly: true });
    assetsBySkin.set(mapping.skinEntityId, list);
  }
  const categoryRows = acquisitionStates.length ? await tx.select().from(acquisitionCategories).where(inArray(acquisitionCategories.id, acquisitionStates.map((state) => state.sourceCategoryId).filter(Boolean))) : [];
  const seriesRows = seriesStates.length ? await tx.select().from(series).where(inArray(series.seriesId, seriesStates.map((state) => state.sourceSeriesId).filter(Boolean))) : [];
  const seriesMap = new Map(seriesRows.map((item) => [item.seriesId, item]));
  const categoryMap = new Map(categoryRows.map((item) => [item.id, item]));
  const seriesMapBySkin = new Map(seriesStates.map((state) => [state.skinEntityId, { source: state.sourceSeriesId ? seriesMap.get(state.sourceSeriesId) || { seriesId: state.sourceSeriesId } : null, overrideMode: state.overrideMode, overrideSeriesId: state.overrideSeriesId, state: state.state }]));
  const acquisitionBySkin = new Map(acquisitionStates.map((state) => [state.skinEntityId, { source: state.sourceCategoryId ? categoryMap.get(state.sourceCategoryId) || { id: state.sourceCategoryId } : null, overrideCategoryId: state.overrideCategoryId, state: state.state }]));
  const histories = await tx.select({ id: editHistory.id, entityId: editHistory.entityId, fieldName: editHistory.fieldName, eventType: editHistory.eventType, oldValue: editHistory.oldValue, newValue: editHistory.newValue, actorUserId: editHistory.actorUserId, editedAt: editHistory.editedAt, metadata: editHistory.metadata }).from(editHistory).where(inArray(editHistory.entityId, allIds)).orderBy(desc(editHistory.editedAt)).limit(200);
  return {
    character: characterSummary(row, mapped),
    skins: skinRows.map((skin) => skinSummary(skin, mapped, { series: seriesMapBySkin.get(skin.entityId) || null, acquisition: acquisitionBySkin.get(skin.entityId) || null, assets: assetsBySkin.get(skin.entityId) || [] })),
    history: histories,
  };
}

export async function getCharacter(characterId) {
  return loadCharacter(getDb(), String(characterId || ''));
}

export async function getSkin(skinId) {
  const tx = getDb();
  const [row] = await tx.select({
    entityId: managedEntities.id,
    revision: managedEntities.revision,
    updatedAt: managedEntities.updatedAt,
    skinId: skins.skinId,
    characterEntityId: skins.characterEntityId,
    skinNameCn: skins.skinNameCn,
    descriptionCn: skins.descriptionCn,
    obtainCn: skins.obtainCn,
    skinNameVi: skins.skinNameVi,
    descriptionVi: skins.descriptionVi,
    obtainVi: skins.obtainVi,
    skinType: skins.skinType,
    isBaseSkin: skins.isBaseSkin,
    isHighSkin: skins.isHighSkin,
    skinRareRaw: skins.skinRareRaw,
    rawItemId: skins.rawItemId,
    rawGoodsId: skins.rawGoodsId,
    rawDiscountGoodsId: skins.rawDiscountGoodsId,
    rawDiscountPrice: skins.rawDiscountPrice,
    rawDiscountStart: skins.rawDiscountStart,
    rawDiscountEnd: skins.rawDiscountEnd,
    rawSeriesId: skins.rawSeriesId,
    sourceSnapshotId: skins.sourceSnapshotId,
    workbookSnapshotId: skins.workbookSnapshotId,
  }).from(skins).innerJoin(managedEntities, eq(managedEntities.id, skins.entityId)).where(eq(skins.skinId, String(skinId || '')));
  if (!row) fail('NOT_FOUND', 404);
  const overrides = await tx.select().from(fieldOverrides).where(eq(fieldOverrides.entityId, row.entityId));
  const seriesState = (await tx.select().from(skinSeriesState).where(eq(skinSeriesState.skinEntityId, row.entityId)))[0] || null;
  const acquisitionState = (await tx.select().from(skinAcquisitionState).where(eq(skinAcquisitionState.skinEntityId, row.entityId)))[0] || null;
  const mappingRows = await tx.select().from(skinAssetMappings).where(eq(skinAssetMappings.skinEntityId, row.entityId));
  const assetIds = [...new Set(mappingRows.flatMap((mapping) => [mapping.sourceAssetId, mapping.overrideAssetId].filter(Boolean)))];
  const assetRows = assetIds.length ? await tx.select().from(assetObjects).where(inArray(assetObjects.id, assetIds)) : [];
  const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));
  const assets = mappingRows.map((mapping) => ({ assetRole: mapping.assetRole, source: assetById.has(mapping.sourceAssetId) ? { id: mapping.sourceAssetId, url: assetById.get(mapping.sourceAssetId).publicUrl, objectKey: assetById.get(mapping.sourceAssetId).objectKey, provenance: assetById.get(mapping.sourceAssetId).provenance, verificationState: assetById.get(mapping.sourceAssetId).verificationState } : null, override: mapping.overrideAssetId && assetById.has(mapping.overrideAssetId) ? { id: mapping.overrideAssetId, url: assetById.get(mapping.overrideAssetId).publicUrl, objectKey: assetById.get(mapping.overrideAssetId).objectKey, provenance: assetById.get(mapping.overrideAssetId).provenance, verificationState: assetById.get(mapping.overrideAssetId).verificationState } : null, state: mapping.state, readOnly: true }));
  const history = await tx.select({ id: editHistory.id, entityId: editHistory.entityId, fieldName: editHistory.fieldName, eventType: editHistory.eventType, oldValue: editHistory.oldValue, newValue: editHistory.newValue, actorUserId: editHistory.actorUserId, editedAt: editHistory.editedAt, metadata: editHistory.metadata }).from(editHistory).where(eq(editHistory.entityId, row.entityId)).orderBy(desc(editHistory.editedAt)).limit(100);
  return { skin: skinSummary(row, overrideMap(overrides), { series: seriesState, acquisition: acquisitionState, assets }), history };
}

function changeSchema(entityType) {
  return entityType === 'character' ? characterChangeSchema : skinChangeSchema;
}

async function updateEntity(entityType, identifier, rawInput) {
  const input = changeSchema(entityType).parse(rawInput);
  const config = entityType === 'character' ? CHARACTER_FIELDS : SKIN_FIELDS;
  const table = entityType === 'character' ? characters : skins;
  const idColumn = entityType === 'character' ? characters.characterId : skins.skinId;
  const parsedIdentifier = String(identifier || '').trim();
  const db = getDb();
  return db.transaction(async (tx) => {
    const actor = await actorFor(tx, input.actorUserId);
    const [row] = await tx.select().from(table).where(eq(idColumn, parsedIdentifier));
    if (!row) fail('NOT_FOUND', 404);
    const [entity] = await tx.select().from(managedEntities).where(eq(managedEntities.id, row.entityId));
    if (!entity) fail('NOT_FOUND', 404);
    if (entity.revision !== input.expectedRevision) fail('VERSION_CONFLICT', 409, { currentRevision: entity.revision, currentUpdatedAt: entity.updatedAt });
    const existingOverrides = await tx.select().from(fieldOverrides).where(eq(fieldOverrides.entityId, row.entityId));
    const existingByField = new Map(existingOverrides.map((item) => [item.fieldName, item]));
    const now = new Date();
    const changeGroupId = input.requestId || randomUUID();
    const auditRows = [];
    let changed = false;
    for (const [fieldName, rawValue] of Object.entries(input.changes)) {
      if (!(fieldName in config) || rawValue === undefined) continue;
      const nextValue = normalizeText(rawValue);
      const sourceValue = row[config[fieldName].sourceKey] ?? null;
      const existing = existingByField.get(config[fieldName].fieldName);
      const previousValue = existing && existing.state !== 'cleared' ? existing.overrideValue : sourceValue;
      if (jsonEqual(previousValue, nextValue)) continue;
      changed = true;
      if (jsonEqual(sourceValue, nextValue)) {
        if (existing) {
          await tx.update(fieldOverrides).set({ overrideValue: jsonValue(sourceValue), state: 'cleared', updatedByUserId: actor.id, updatedAt: now }).where(eq(fieldOverrides.id, existing.id));
        }
      } else if (existing) {
        await tx.update(fieldOverrides).set({ overrideValue: jsonValue(nextValue), baseSourceValue: jsonValue(sourceValue), baseSourceHash: hashValue(sourceValue), baseSourceSnapshotId: row.workbookSnapshotId, state: 'active', updatedByUserId: actor.id, updatedAt: now }).where(eq(fieldOverrides.id, existing.id));
      } else {
        await tx.insert(fieldOverrides).values({ entityId: row.entityId, fieldName: config[fieldName].fieldName, overrideValue: jsonValue(nextValue), baseSourceValue: jsonValue(sourceValue), baseSourceHash: hashValue(sourceValue), baseSourceSnapshotId: row.workbookSnapshotId, state: 'active', createdByUserId: actor.id, createdAt: now, updatedByUserId: actor.id, updatedAt: now });
      }
      auditRows.push({ entityId: row.entityId, entityType, fieldName: config[fieldName].fieldName, eventType: 'human_edit', oldValue: previousValue, newValue: nextValue, actorUserId: actor.id, changeGroupId, requestId: changeGroupId, metadata: { operation: 'field_override', sourceBacked: true } });
    }
    if (!changed) return { revision: entity.revision, changed: false };
    const revisionRows = await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now, editedByUserId: actor.id }).where(and(eq(managedEntities.id, row.entityId), eq(managedEntities.revision, input.expectedRevision))).returning({ revision: managedEntities.revision });
    if (revisionRows.length !== 1) fail('VERSION_CONFLICT', 409);
    await tx.insert(editHistory).values(auditRows);
    return { revision: revisionRows[0].revision, changed: true, entityId: row.entityId };
  });
}

export async function updateCharacter(characterId, input) {
  return updateEntity('character', characterId, input);
}

export async function updateSkin(skinId, input) {
  return updateEntity('skin', skinId, input);
}
