import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  assetObjects,
  characters,
  editHistory,
  managedEntities,
  sourceSnapshots,
  users,
} from '../../db/schema/index.mjs';
import {
  assetUploadIntents,
  characterPublicationStates,
  entityAssetMappings,
  entityAssetRoleRules,
  previewCharacterReconciliations,
  previewCharacters,
} from '../../db/schema/preview-character-assets.mjs';

const lifecycleValues = ['unverified', 'unreleased', 'released', 'retired'];
const visibilityValues = ['hidden', 'preview', 'public'];
const provenanceValues = [
  'source_extracted',
  'manual_official',
  'manual_preview',
  'manual_placeholder',
];

const nullableText = z.string().trim().max(10_000).nullable().optional();
const jsonValue = z.record(z.string(), z.unknown()).default({});
const requestIdSchema = z.string().uuid();

const createPreviewSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  nameCn: nullableText,
  fullnameCn: nullableText,
  nameVi: nullableText,
  fullnameVi: nullableText,
  nicknameVi: nullableText,
  tagsVi: nullableText,
  claimedRawId: nullableText,
  claimedRawIdEvidence: jsonValue,
  manualMetadata: jsonValue,
  provenanceNotes: nullableText,
});

const updatePreviewSchema = createPreviewSchema
  .omit({
    nameCn: true,
    fullnameCn: true,
    nameVi: true,
    fullnameVi: true,
    nicknameVi: true,
    tagsVi: true,
    claimedRawId: true,
    claimedRawIdEvidence: true,
    manualMetadata: true,
    provenanceNotes: true,
  })
  .extend({
    entityId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    patch: z
      .object({
        nameCn: nullableText,
        fullnameCn: nullableText,
        nameVi: nullableText,
        fullnameVi: nullableText,
        nicknameVi: nullableText,
        tagsVi: nullableText,
        claimedRawId: nullableText,
        claimedRawIdEvidence: jsonValue.optional(),
        manualMetadata: jsonValue.optional(),
        provenanceNotes: nullableText,
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, 'patch must not be empty'),
  });

const ownerPublicationSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  entityId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  lifecycle: z.enum(lifecycleValues),
  visibility: z.enum(visibilityValues),
});

const uploadIntentSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  entityId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  assetRole: z.enum(['avatar', 'card', 'drawing']),
  requestedFilename: z.string().trim().max(512).nullable().optional(),
  requestedProvenance: z.enum(provenanceValues),
});

const activateAssetSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  entityId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  assetRole: z.enum(['avatar', 'card', 'drawing']),
  assetId: z.string().uuid(),
  mappingSlot: z.string().trim().min(1).max(128).default('primary'),
  selectionMode: z.enum(['source', 'manual']),
  sourceAssetId: z.string().uuid().nullable().optional(),
  sourceState: z.enum(['no_source', 'current', 'replacement_pending', 'source_changed']),
  acknowledgePublicPlaceholder: z.boolean().default(false),
});

const proposeReconciliationSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  previewEntityId: z.string().uuid(),
  officialCharacterEntityId: z.string().uuid(),
  evaluatedSourceSnapshotId: z.string().uuid(),
  candidateEvidence: jsonValue,
  decisionNotes: nullableText,
});

const confirmReconciliationSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: requestIdSchema,
  reconciliationId: z.string().uuid(),
  previewExpectedRevision: z.number().int().positive(),
  officialExpectedRevision: z.number().int().positive(),
  decisionNotes: nullableText,
});

export class PreviewDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PreviewDomainError';
    this.code = code;
  }
}

function forbidden(message = 'The current user is not allowed to perform this operation.') {
  throw new PreviewDomainError('FORBIDDEN', message);
}

function conflict(message = 'The record was changed by another request.') {
  throw new PreviewDomainError('VERSION_CONFLICT', message);
}

async function actorFromDatabase(tx, actorUserId) {
  const [actor] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, actorUserId));
  if (!actor || actor.status !== 'active') forbidden('An active authenticated user is required.');
  return actor;
}

function requireOwner(actor) {
  if (actor.role !== 'owner') forbidden('This operation requires an owner role.');
}

async function previewSubject(tx, entityId) {
  const [subject] = await tx
    .select({
      entityId: managedEntities.id,
      entityType: managedEntities.entityType,
      revision: managedEntities.revision,
      lifecycle: characterPublicationStates.lifecycle,
      visibility: characterPublicationStates.visibility,
      reconciledToCharacterEntityId: previewCharacters.reconciledToCharacterEntityId,
    })
    .from(managedEntities)
    .innerJoin(previewCharacters, eq(previewCharacters.entityId, managedEntities.id))
    .innerJoin(characterPublicationStates, eq(characterPublicationStates.entityId, managedEntities.id))
    .where(eq(managedEntities.id, entityId));
  if (!subject || subject.entityType !== 'preview_character') {
    throw new PreviewDomainError('NOT_FOUND', 'Preview Character was not found.');
  }
  return subject;
}

async function assertExpectedRevision(tx, entityId, expectedRevision) {
  const [entity] = await tx
    .select({
      id: managedEntities.id,
      entityType: managedEntities.entityType,
      revision: managedEntities.revision,
    })
    .from(managedEntities)
    .where(eq(managedEntities.id, entityId));
  if (!entity) throw new PreviewDomainError('NOT_FOUND', 'Managed entity was not found.');
  if (entity.revision !== expectedRevision) conflict();
  return entity;
}

async function incrementRevision(tx, entityId, expectedRevision, actorUserId) {
  const rows = await tx
    .update(managedEntities)
    .set({
      revision: sql`${managedEntities.revision} + 1`,
      updatedAt: new Date(),
      editedByUserId: actorUserId,
    })
    .where(and(eq(managedEntities.id, entityId), eq(managedEntities.revision, expectedRevision)))
    .returning({ revision: managedEntities.revision });
  if (rows.length !== 1) conflict();
  return rows[0].revision;
}

async function writeAudit(tx, { entityId, entityType, actorUserId, requestId, changeGroupId, fieldName, oldValue, newValue, metadata = {} }) {
  await tx.insert(editHistory).values({
    entityId,
    entityType,
    actorUserId,
    requestId,
    changeGroupId,
    fieldName,
    eventType: 'human_edit',
    oldValue,
    newValue,
    metadata,
  });
}

function changedValues(previous, patch) {
  const oldValue = {};
  const newValue = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && JSON.stringify(previous[key]) !== JSON.stringify(value)) {
      oldValue[key] = previous[key];
      newValue[key] = value;
    }
  }
  return { oldValue, newValue };
}

export async function createPreviewCharacter(tx, rawInput) {
  const input = createPreviewSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  const entityId = randomUUID();
  const changeGroupId = randomUUID();
  const now = new Date();

  await tx.insert(managedEntities).values({
    id: entityId,
    entityType: 'preview_character',
    sourceKey: `preview:${entityId}`,
    revision: 1,
    editedByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(previewCharacters).values({
    entityId,
    claimedRawId: input.claimedRawId ?? null,
    claimedRawIdEvidence: input.claimedRawIdEvidence,
    nameCn: input.nameCn ?? null,
    fullnameCn: input.fullnameCn ?? null,
    nameVi: input.nameVi ?? null,
    fullnameVi: input.fullnameVi ?? null,
    nicknameVi: input.nicknameVi ?? null,
    tagsVi: input.tagsVi ?? null,
    manualMetadata: input.manualMetadata,
    provenanceNotes: input.provenanceNotes ?? null,
    createdByUserId: actor.id,
    updatedByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(characterPublicationStates).values({
    entityId,
    entityType: 'preview_character',
    origin: 'manual_preview',
    lifecycle: 'unverified',
    visibility: 'hidden',
    publicKey: `preview_${entityId}`,
    updatedByUserId: actor.id,
    updatedAt: now,
  });
  await writeAudit(tx, {
    entityId,
    entityType: 'preview_character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId,
    fieldName: 'preview_character.create',
    oldValue: null,
    newValue: { origin: 'manual_preview', lifecycle: 'unverified', visibility: 'hidden' },
    metadata: { operation: 'preview_create' },
  });
  return { entityId, revision: 1, publicKey: `preview_${entityId}`, changeGroupId };
}

export async function updatePreviewCharacter(tx, rawInput) {
  const input = updatePreviewSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  const subject = await previewSubject(tx, input.entityId);
  if (subject.revision !== input.expectedRevision) conflict();
  if (actor.role === 'editor' && subject.reconciledToCharacterEntityId) {
    forbidden('Editors cannot edit a reconciled preview Character.');
  }

  const [existing] = await tx.select().from(previewCharacters).where(eq(previewCharacters.entityId, input.entityId));
  const { oldValue, newValue } = changedValues(existing, input.patch);
  if (Object.keys(newValue).length === 0) return { revision: subject.revision, changed: false };

  await tx
    .update(previewCharacters)
    .set({ ...newValue, updatedByUserId: actor.id, updatedAt: new Date() })
    .where(eq(previewCharacters.entityId, input.entityId));
  const revision = await incrementRevision(tx, input.entityId, input.expectedRevision, actor.id);
  await writeAudit(tx, {
    entityId: input.entityId,
    entityType: 'preview_character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: randomUUID(),
    fieldName:
      'claimedRawId' in newValue || 'claimedRawIdEvidence' in newValue
        ? 'preview_character.claimed_identity_evidence'
        : 'preview_character.metadata',
    oldValue,
    newValue,
    metadata: { operation: 'preview_update', claim_is_non_authoritative: true },
  });
  return { revision, changed: true };
}

export async function setPreviewPublicationState(tx, rawInput) {
  const input = ownerPublicationSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  requireOwner(actor);
  const subject = await previewSubject(tx, input.entityId);
  if (subject.revision !== input.expectedRevision) conflict();

  const oldValue = { lifecycle: subject.lifecycle, visibility: subject.visibility };
  const newValue = { lifecycle: input.lifecycle, visibility: input.visibility };
  await tx
    .update(characterPublicationStates)
    .set({ ...newValue, updatedByUserId: actor.id, updatedAt: new Date() })
    .where(eq(characterPublicationStates.entityId, input.entityId));
  const revision = await incrementRevision(tx, input.entityId, input.expectedRevision, actor.id);
  await writeAudit(tx, {
    entityId: input.entityId,
    entityType: 'preview_character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: randomUUID(),
    fieldName: 'preview_character.publication_state',
    oldValue,
    newValue,
    metadata: { operation: 'owner_publication_state_change' },
  });
  return { revision };
}

const roleUploadPolicy = {
  avatar: { maxBytes: 4 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
  card: { maxBytes: 10 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
  drawing: { maxBytes: 12 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
};

export async function issueAssetUploadIntent(tx, rawInput, options = {}) {
  const input = uploadIntentSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  const [entity] = await tx
    .select({ id: managedEntities.id, entityType: managedEntities.entityType, revision: managedEntities.revision })
    .from(managedEntities)
    .where(eq(managedEntities.id, input.entityId));
  if (!entity || entity.revision !== input.expectedRevision) conflict();
  const [rule] = await tx
    .select()
    .from(entityAssetRoleRules)
    .where(and(eq(entityAssetRoleRules.entityType, entity.entityType), eq(entityAssetRoleRules.assetRole, input.assetRole)));
  if (!rule || !rule.allowsManual || input.requestedProvenance === 'source_extracted') {
    forbidden('This entity and asset role do not accept the requested manual upload.');
  }
  if (
    entity.entityType === 'preview_character' &&
    !['manual_preview', 'manual_placeholder'].includes(input.requestedProvenance)
  ) {
    forbidden('Preview Character uploads must remain explicitly manual-preview or manual-placeholder assets.');
  }
  if (actor.role === 'editor') {
    if (entity.entityType !== 'preview_character' || input.requestedProvenance !== 'manual_preview') {
      forbidden('Editors may stage only manual-preview assets for preview Characters.');
    }
    const subject = await previewSubject(tx, entity.id);
    if (subject.visibility !== 'hidden' || subject.lifecycle !== 'unverified') {
      forbidden('Editors may stage assets only for hidden, unverified preview drafts.');
    }
  }
  const id = randomUUID();
  const policy = roleUploadPolicy[input.assetRole];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const quarantinePrefix = options.quarantinePrefix ?? '';
  if (
    (quarantinePrefix && !/^[a-z0-9][a-z0-9/_-]*$/i.test(quarantinePrefix)) ||
    quarantinePrefix.includes('..')
  ) {
    throw new PreviewDomainError('CONFIGURATION_ERROR', 'The managed asset namespace is not configured safely.');
  }
  const quarantineObjectKey = `${quarantinePrefix ? `${quarantinePrefix}/` : ''}quarantine/uploads/${id}/original`;
  await tx.insert(assetUploadIntents).values({
    id,
    entityId: entity.id,
    entityType: entity.entityType,
    assetRole: input.assetRole,
    requestedProvenance: input.requestedProvenance,
    requestedFilename: input.requestedFilename ?? null,
    quarantineObjectKey,
    maxBytes: policy.maxBytes,
    allowedMimeTypes: policy.allowedMimeTypes,
    expectedRevision: input.expectedRevision,
    status: 'issued',
    expiresAt,
    createdByUserId: actor.id,
  });
  await writeAudit(tx, {
    entityId: entity.id,
    entityType: entity.entityType,
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: randomUUID(),
    fieldName: 'asset_upload_intent.issue',
    oldValue: null,
    newValue: { assetRole: input.assetRole, requestedProvenance: input.requestedProvenance, expiresAt },
    metadata: { operation: 'upload_intent_issue', quarantine_key_server_generated: true },
  });
  return { id, quarantineObjectKey, maxBytes: policy.maxBytes, allowedMimeTypes: policy.allowedMimeTypes, expiresAt };
}

export async function activateEntityAssetMapping(tx, rawInput) {
  const input = activateAssetSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  requireOwner(actor);
  const entity = await assertExpectedRevision(tx, input.entityId, input.expectedRevision);
  const [asset] = await tx
    .select({
      id: assetObjects.id,
      provenance: assetObjects.provenance,
      verificationState: assetObjects.verificationState,
      storageTier: assetObjects.storageTier,
    })
    .from(assetObjects)
    .where(eq(assetObjects.id, input.assetId));
  if (!asset || asset.verificationState !== 'verified' || asset.storageTier !== 'public_delivery') {
    throw new PreviewDomainError('ASSET_NOT_VERIFIED', 'Only a verified public-delivery asset can become an active mapping.');
  }
  const [rule] = await tx
    .select()
    .from(entityAssetRoleRules)
    .where(and(eq(entityAssetRoleRules.entityType, entity.entityType), eq(entityAssetRoleRules.assetRole, input.assetRole)));
  if (!rule) forbidden('This asset role is not valid for the managed entity type.');
  if (input.selectionMode === 'source' && !rule.allowsSource) forbidden('Source selection is not permitted for this asset role.');
  if (input.selectionMode === 'manual' && !rule.allowsManual) forbidden('Manual selection is not permitted for this asset role.');
  if (input.selectionMode === 'source' && input.sourceAssetId !== input.assetId) {
    throw new PreviewDomainError('VALIDATION_ERROR', 'A source mapping must use its source asset as the active asset.');
  }
  if (asset.provenance === 'manual_placeholder') {
    const [publication] = await tx
      .select({ visibility: characterPublicationStates.visibility })
      .from(characterPublicationStates)
      .where(eq(characterPublicationStates.entityId, input.entityId));
    if (publication?.visibility === 'public' && !input.acknowledgePublicPlaceholder) {
      throw new PreviewDomainError('PLACEHOLDER_ACKNOWLEDGEMENT_REQUIRED', 'Public placeholder activation needs explicit owner acknowledgement.');
    }
  }
  const [previous] = await tx
    .select()
    .from(entityAssetMappings)
    .where(
      and(
        eq(entityAssetMappings.entityId, input.entityId),
        eq(entityAssetMappings.assetRole, input.assetRole),
        eq(entityAssetMappings.mappingSlot, input.mappingSlot),
      ),
    );
  const values = {
    entityId: input.entityId,
    entityType: entity.entityType,
    assetRole: input.assetRole,
    mappingSlot: input.mappingSlot,
    activeAssetId: input.assetId,
    sourceAssetId: input.sourceAssetId ?? null,
    selectionMode: input.selectionMode,
    sourceState: input.sourceState,
    updatedByUserId: actor.id,
    updatedAt: new Date(),
  };
  if (previous) {
    await tx
      .update(entityAssetMappings)
      .set(values)
      .where(
        and(
          eq(entityAssetMappings.entityId, input.entityId),
          eq(entityAssetMappings.assetRole, input.assetRole),
          eq(entityAssetMappings.mappingSlot, input.mappingSlot),
        ),
      );
  } else {
    await tx.insert(entityAssetMappings).values(values);
  }
  const revision = await incrementRevision(tx, input.entityId, input.expectedRevision, actor.id);
  await writeAudit(tx, {
    entityId: input.entityId,
    entityType: entity.entityType,
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: randomUUID(),
    fieldName: 'entity_asset_mapping.active_asset',
    oldValue: previous ? { activeAssetId: previous.activeAssetId, selectionMode: previous.selectionMode } : null,
    newValue: { activeAssetId: input.assetId, selectionMode: input.selectionMode, assetRole: input.assetRole },
    metadata: { operation: 'owner_asset_mapping_change', provenance: asset.provenance },
  });
  return { revision };
}

export async function proposePreviewReconciliation(tx, rawInput) {
  const input = proposeReconciliationSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  requireOwner(actor);
  await previewSubject(tx, input.previewEntityId);
  const [official] = await tx.select({ id: characters.entityId }).from(characters).where(eq(characters.entityId, input.officialCharacterEntityId));
  if (!official) throw new PreviewDomainError('NOT_FOUND', 'Official Character was not found.');
  const [snapshot] = await tx.select({ id: sourceSnapshots.id }).from(sourceSnapshots).where(eq(sourceSnapshots.id, input.evaluatedSourceSnapshotId));
  if (!snapshot) throw new PreviewDomainError('NOT_FOUND', 'Evaluated source snapshot was not found.');
  const changeGroupId = randomUUID();
  const [reconciliation] = await tx
    .insert(previewCharacterReconciliations)
    .values({
      previewEntityId: input.previewEntityId,
      officialCharacterEntityId: input.officialCharacterEntityId,
      evaluatedSourceSnapshotId: input.evaluatedSourceSnapshotId,
      status: 'proposed',
      candidateEvidence: input.candidateEvidence,
      decisionNotes: input.decisionNotes ?? null,
      proposedByUserId: actor.id,
      changeGroupId,
      requestId: input.requestId,
    })
    .returning({ id: previewCharacterReconciliations.id });
  await writeAudit(tx, {
    entityId: input.previewEntityId,
    entityType: 'preview_character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId,
    fieldName: 'preview_reconciliation.proposed',
    oldValue: null,
    newValue: { reconciliationId: reconciliation.id, officialCharacterEntityId: input.officialCharacterEntityId },
    metadata: { operation: 'reconciliation_proposal', claimed_id_is_not_confirmation: true },
  });
  return reconciliation;
}

export async function confirmPreviewReconciliation(tx, rawInput) {
  const input = confirmReconciliationSchema.parse(rawInput);
  const actor = await actorFromDatabase(tx, input.actorUserId);
  requireOwner(actor);
  const [reconciliation] = await tx
    .select()
    .from(previewCharacterReconciliations)
    .where(eq(previewCharacterReconciliations.id, input.reconciliationId));
  if (!reconciliation || reconciliation.status !== 'proposed') {
    throw new PreviewDomainError('RECONCILIATION_NOT_PROPOSED', 'Only a proposed reconciliation can be confirmed.');
  }
  await assertExpectedRevision(tx, reconciliation.previewEntityId, input.previewExpectedRevision);
  await assertExpectedRevision(tx, reconciliation.officialCharacterEntityId, input.officialExpectedRevision);
  const now = new Date();
  await tx
    .update(previewCharacterReconciliations)
    .set({ status: 'confirmed', reviewedByUserId: actor.id, reviewedAt: now, decisionNotes: input.decisionNotes ?? reconciliation.decisionNotes })
    .where(eq(previewCharacterReconciliations.id, input.reconciliationId));
  await tx
    .update(previewCharacters)
    .set({
      reconciledToCharacterEntityId: reconciliation.officialCharacterEntityId,
      reconciledAt: now,
      reconciledByUserId: actor.id,
      retiredReason: 'reconciled',
      updatedByUserId: actor.id,
      updatedAt: now,
    })
    .where(eq(previewCharacters.entityId, reconciliation.previewEntityId));
  await tx
    .update(characterPublicationStates)
    .set({ lifecycle: 'retired', visibility: 'hidden', updatedByUserId: actor.id, updatedAt: now })
    .where(eq(characterPublicationStates.entityId, reconciliation.previewEntityId));
  const previewRevision = await incrementRevision(tx, reconciliation.previewEntityId, input.previewExpectedRevision, actor.id);
  const officialRevision = await incrementRevision(tx, reconciliation.officialCharacterEntityId, input.officialExpectedRevision, actor.id);
  await writeAudit(tx, {
    entityId: reconciliation.previewEntityId,
    entityType: 'preview_character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: reconciliation.changeGroupId,
    fieldName: 'preview_reconciliation.confirmed',
    oldValue: null,
    newValue: { officialCharacterEntityId: reconciliation.officialCharacterEntityId, lifecycle: 'retired', visibility: 'hidden' },
    metadata: { operation: 'reconciliation_confirmation', explicit_owner_decision: true },
  });
  await writeAudit(tx, {
    entityId: reconciliation.officialCharacterEntityId,
    entityType: 'character',
    actorUserId: actor.id,
    requestId: input.requestId,
    changeGroupId: reconciliation.changeGroupId,
    fieldName: 'preview_reconciliation.confirmed_target',
    oldValue: null,
    newValue: { previewEntityId: reconciliation.previewEntityId },
    metadata: { operation: 'reconciliation_confirmation', explicit_owner_decision: true },
  });
  return { previewRevision, officialRevision };
}
