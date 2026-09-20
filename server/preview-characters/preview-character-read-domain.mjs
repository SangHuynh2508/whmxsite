import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';

import { getDb } from '../../db/client.mjs';
import {
  assetObjects,
  characters,
  characterPublicationStates,
  editHistory,
  entityAssetMappings,
  managedEntities,
  previewCharacterReconciliations,
  previewCharacters,
  assetUploadIntents,
  users,
} from '../../db/schema/index.mjs';

function assetMap(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.entityId)) result.set(row.entityId, {});
    result.get(row.entityId)[row.assetRole] = {
      id: row.assetId,
      url: row.publicUrl,
      role: row.assetRole,
      provenance: row.provenance,
      verificationState: row.verificationState,
      storageTier: row.storageTier,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      byteSize: row.byteSize,
      createdAt: row.assetCreatedAt,
      createdByUserId: row.createdByUserId,
    };
  }
  return result;
}

const listProjection = {
  entityId: managedEntities.id,
  publicKey: characterPublicationStates.publicKey,
  revision: managedEntities.revision,
  updatedAt: managedEntities.updatedAt,
  editedByUserId: managedEntities.editedByUserId,
  nameCn: previewCharacters.nameCn,
  nameVi: previewCharacters.nameVi,
  fullnameVi: previewCharacters.fullnameVi,
  claimedRawId: previewCharacters.claimedRawId,
  origin: characterPublicationStates.origin,
  lifecycle: characterPublicationStates.lifecycle,
  visibility: characterPublicationStates.visibility,
};

function filtersFor(query = {}) {
  const clauses = [eq(managedEntities.entityType, 'preview_character')];
  if (['unverified', 'unreleased', 'released', 'retired'].includes(query.lifecycle)) {
    clauses.push(eq(characterPublicationStates.lifecycle, query.lifecycle));
  }
  if (['hidden', 'preview', 'public'].includes(query.visibility)) {
    clauses.push(eq(characterPublicationStates.visibility, query.visibility));
  }
  const text = typeof query.q === 'string' ? query.q.trim() : '';
  if (text) {
    const pattern = `%${text.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    clauses.push(or(
      ilike(previewCharacters.nameVi, pattern),
      ilike(previewCharacters.nameCn, pattern),
      ilike(previewCharacters.fullnameVi, pattern),
      ilike(previewCharacters.claimedRawId, pattern),
    ));
  }
  return and(...clauses);
}

export async function listPreviewCharacters(query = {}) {
  const db = getDb();
  const rows = await db
    .select(listProjection)
    .from(managedEntities)
    .innerJoin(previewCharacters, eq(previewCharacters.entityId, managedEntities.id))
    .innerJoin(characterPublicationStates, eq(characterPublicationStates.entityId, managedEntities.id))
    .where(filtersFor(query))
    .orderBy(desc(managedEntities.updatedAt), asc(previewCharacters.nameVi));
  if (!rows.length) return [];
  const assets = await db
    .select({
      entityId: entityAssetMappings.entityId,
      assetRole: entityAssetMappings.assetRole,
      assetId: assetObjects.id,
      publicUrl: assetObjects.publicUrl,
      provenance: assetObjects.provenance,
      verificationState: assetObjects.verificationState,
      storageTier: assetObjects.storageTier,
      mimeType: assetObjects.mimeType,
      width: assetObjects.width,
      height: assetObjects.height,
      byteSize: assetObjects.byteSize,
      assetCreatedAt: assetObjects.createdAt,
      createdByUserId: assetObjects.createdByUserId,
    })
    .from(entityAssetMappings)
    .innerJoin(assetObjects, eq(assetObjects.id, entityAssetMappings.activeAssetId))
    .where(or(...rows.map((row) => eq(entityAssetMappings.entityId, row.entityId))));
  const byEntity = assetMap(assets);
  return rows.map((row) => ({ ...row, assets: byEntity.get(row.entityId) || {} }));
}

export async function getPreviewCharacter(entityId) {
  const db = getDb();
  const [row] = await db
    .select({
      entityId: managedEntities.id,
      publicKey: characterPublicationStates.publicKey,
      revision: managedEntities.revision,
      createdAt: managedEntities.createdAt,
      updatedAt: managedEntities.updatedAt,
      editedByUserId: managedEntities.editedByUserId,
      nameCn: previewCharacters.nameCn,
      fullnameCn: previewCharacters.fullnameCn,
      nameVi: previewCharacters.nameVi,
      fullnameVi: previewCharacters.fullnameVi,
      nicknameVi: previewCharacters.nicknameVi,
      tagsVi: previewCharacters.tagsVi,
      claimedRawId: previewCharacters.claimedRawId,
      claimedRawIdEvidence: previewCharacters.claimedRawIdEvidence,
      manualMetadata: previewCharacters.manualMetadata,
      provenanceNotes: previewCharacters.provenanceNotes,
      createdByUserId: previewCharacters.createdByUserId,
      updatedByUserId: previewCharacters.updatedByUserId,
      reconciledToCharacterEntityId: previewCharacters.reconciledToCharacterEntityId,
      reconciledAt: previewCharacters.reconciledAt,
      origin: characterPublicationStates.origin,
      lifecycle: characterPublicationStates.lifecycle,
      visibility: characterPublicationStates.visibility,
    })
    .from(managedEntities)
    .innerJoin(previewCharacters, eq(previewCharacters.entityId, managedEntities.id))
    .innerJoin(characterPublicationStates, eq(characterPublicationStates.entityId, managedEntities.id))
    .where(and(eq(managedEntities.id, entityId), eq(managedEntities.entityType, 'preview_character')));
  if (!row) return null;

  const assets = await db
    .select({
      entityId: entityAssetMappings.entityId,
      assetRole: entityAssetMappings.assetRole,
      assetId: assetObjects.id,
      publicUrl: assetObjects.publicUrl,
      provenance: assetObjects.provenance,
      verificationState: assetObjects.verificationState,
      storageTier: assetObjects.storageTier,
      mimeType: assetObjects.mimeType,
      width: assetObjects.width,
      height: assetObjects.height,
      byteSize: assetObjects.byteSize,
      assetCreatedAt: assetObjects.createdAt,
      createdByUserId: assetObjects.createdByUserId,
    })
    .from(entityAssetMappings)
    .innerJoin(assetObjects, eq(assetObjects.id, entityAssetMappings.activeAssetId))
    .where(eq(entityAssetMappings.entityId, entityId));

  const history = await db
    .select({
      id: editHistory.id,
      fieldName: editHistory.fieldName,
      eventType: editHistory.eventType,
      oldValue: editHistory.oldValue,
      newValue: editHistory.newValue,
      actorUserId: editHistory.actorUserId,
      editedAt: editHistory.editedAt,
      metadata: editHistory.metadata,
    })
    .from(editHistory)
    .where(eq(editHistory.entityId, entityId))
    .orderBy(desc(editHistory.editedAt));

  const reconciliation = await db
    .select({
      id: previewCharacterReconciliations.id,
      status: previewCharacterReconciliations.status,
      candidateEvidence: previewCharacterReconciliations.candidateEvidence,
      decisionNotes: previewCharacterReconciliations.decisionNotes,
      officialCharacterEntityId: previewCharacterReconciliations.officialCharacterEntityId,
      officialCharacterId: characters.characterId,
      officialNameCn: characters.nameCn,
      officialNameVi: characters.nameVi,
      proposedAt: previewCharacterReconciliations.proposedAt,
      reviewedAt: previewCharacterReconciliations.reviewedAt,
    })
    .from(previewCharacterReconciliations)
    .leftJoin(characters, eq(characters.entityId, previewCharacterReconciliations.officialCharacterEntityId))
    .where(eq(previewCharacterReconciliations.previewEntityId, entityId))
    .orderBy(desc(previewCharacterReconciliations.proposedAt));

  const pendingUploads = await db
    .select({
      id: assetUploadIntents.id,
      assetRole: assetUploadIntents.assetRole,
      requestedProvenance: assetUploadIntents.requestedProvenance,
      status: assetUploadIntents.status,
      expiresAt: assetUploadIntents.expiresAt,
      createdByUserId: assetUploadIntents.createdByUserId,
    })
    .from(assetUploadIntents)
    .where(and(eq(assetUploadIntents.entityId, entityId), eq(assetUploadIntents.status, 'issued')))
    .orderBy(desc(assetUploadIntents.expiresAt));

  return { ...row, assets: assetMap(assets).get(entityId) || {}, pendingUploads, history, reconciliation };
}
