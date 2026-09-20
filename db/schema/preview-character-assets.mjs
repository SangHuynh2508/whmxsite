import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from './auth.mjs';
import { assetObjects, assetProvenance, characters } from './character-skin.mjs';
import { managedEntities, managedEntityType, sourceSnapshots } from './core.mjs';

export const characterOrigin = pgEnum('character_origin', ['manual_preview', 'source_backed']);
export const characterLifecycle = pgEnum('character_lifecycle', [
  'unverified',
  'unreleased',
  'released',
  'retired',
]);
export const characterVisibility = pgEnum('character_visibility', ['hidden', 'preview', 'public']);
export const previewRetiredReason = pgEnum('preview_retired_reason', [
  'reconciled',
  'identity_incorrect',
  'duplicate_preview',
  'withdrawn',
  'other',
]);
export const previewReconciliationStatus = pgEnum('preview_reconciliation_status', [
  'proposed',
  'confirmed',
  'rejected',
  'cancelled',
]);
export const assetSelectionMode = pgEnum('asset_selection_mode', ['source', 'manual']);
export const assetSourceState = pgEnum('asset_source_state', [
  'no_source',
  'current',
  'replacement_pending',
  'source_changed',
]);
export const uploadIntentStatus = pgEnum('upload_intent_status', [
  'issued',
  'uploaded',
  'verified',
  'finalized',
  'expired',
  'rejected',
  'cleaned',
]);

export const characterPublicationStates = pgTable(
  'character_publication_states',
  {
    entityId: uuid('entity_id').primaryKey(),
    entityType: managedEntityType('entity_type').notNull(),
    origin: characterOrigin('origin').notNull(),
    lifecycle: characterLifecycle('lifecycle').notNull(),
    visibility: characterVisibility('visibility').notNull(),
    publicKey: text('public_key').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedByUserId: uuid('published_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    uniqueIndex('character_publication_states_public_key_unique').on(table.publicKey),
    foreignKey({
      columns: [table.entityId, table.entityType],
      foreignColumns: [managedEntities.id, managedEntities.entityType],
      name: 'character_publication_states_managed_entity_fk',
    }).onDelete('restrict'),
    check(
      'character_publication_states_origin_type_check',
      sql`(
        (${table.entityType} = 'preview_character' and ${table.origin} = 'manual_preview')
        or
        (${table.entityType} = 'character' and ${table.origin} = 'source_backed')
      )`,
    ),
    check(
      'character_publication_states_entity_type_check',
      sql`${table.entityType} in ('preview_character', 'character')`,
    ),
  ],
);

export const previewCharacters = pgTable(
  'preview_characters',
  {
    entityId: uuid('entity_id')
      .primaryKey()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    claimedRawId: text('claimed_raw_id'),
    claimedRawIdEvidence: jsonb('claimed_raw_id_evidence').notNull().default({}),
    nameCn: text('name_cn'),
    fullnameCn: text('fullname_cn'),
    nameVi: text('name_vi'),
    fullnameVi: text('fullname_vi'),
    nicknameVi: text('nickname_vi'),
    tagsVi: text('tags_vi'),
    manualMetadata: jsonb('manual_metadata').notNull().default({}),
    provenanceNotes: text('provenance_notes'),
    retiredReason: previewRetiredReason('retired_reason'),
    reconciledToCharacterEntityId: uuid('reconciled_to_character_entity_id').references(
      () => characters.entityId,
      { onDelete: 'restrict' },
    ),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    reconciledByUserId: uuid('reconciled_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => [
    index('preview_characters_claimed_raw_id_idx')
      .on(table.claimedRawId)
      .where(sql`${table.claimedRawId} is not null`),
    index('preview_characters_reconciled_to_character_idx')
      .on(table.reconciledToCharacterEntityId)
      .where(sql`${table.reconciledToCharacterEntityId} is not null`),
    index('preview_characters_updated_at_idx').on(table.updatedAt),
    check(
      'preview_characters_reconciliation_fields_check',
      sql`(
        (${table.reconciledToCharacterEntityId} is null and ${table.reconciledAt} is null and ${table.reconciledByUserId} is null)
        or
        (${table.reconciledToCharacterEntityId} is not null and ${table.reconciledAt} is not null and ${table.reconciledByUserId} is not null)
      )`,
    ),
  ],
);

export const previewCharacterReconciliations = pgTable(
  'preview_character_reconciliations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    previewEntityId: uuid('preview_entity_id')
      .notNull()
      .references(() => previewCharacters.entityId, { onDelete: 'restrict' }),
    officialCharacterEntityId: uuid('official_character_entity_id')
      .notNull()
      .references(() => characters.entityId, { onDelete: 'restrict' }),
    evaluatedSourceSnapshotId: uuid('evaluated_source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    status: previewReconciliationStatus('status').notNull(),
    candidateEvidence: jsonb('candidate_evidence').notNull().default({}),
    decisionNotes: text('decision_notes'),
    proposedByUserId: uuid('proposed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    proposedAt: timestamp('proposed_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    changeGroupId: uuid('change_group_id').notNull(),
    requestId: uuid('request_id').notNull(),
  },
  (table) => [
    index('preview_character_reconciliations_preview_proposed_idx').on(
      table.previewEntityId,
      table.proposedAt,
    ),
    index('preview_character_reconciliations_official_proposed_idx').on(
      table.officialCharacterEntityId,
      table.proposedAt,
    ),
    uniqueIndex('preview_character_reconciliations_confirmed_preview_unique')
      .on(table.previewEntityId)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex('preview_character_reconciliations_confirmed_official_unique')
      .on(table.officialCharacterEntityId)
      .where(sql`${table.status} = 'confirmed'`),
  ],
);

export const entityAssetRoleRules = pgTable(
  'entity_asset_role_rules',
  {
    entityType: managedEntityType('entity_type').notNull(),
    assetRole: text('asset_role').notNull(),
    allowsSource: boolean('allows_source').notNull(),
    allowsManual: boolean('allows_manual').notNull(),
    maximumActiveMappings: smallint('maximum_active_mappings').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.assetRole], name: 'entity_asset_role_rules_pk' }),
    check(
      'entity_asset_role_rules_maximum_active_mappings_check',
      sql`${table.maximumActiveMappings} > 0`,
    ),
  ],
);

export const entityAssetMappings = pgTable(
  'entity_asset_mappings',
  {
    entityId: uuid('entity_id').notNull(),
    entityType: managedEntityType('entity_type').notNull(),
    assetRole: text('asset_role').notNull(),
    mappingSlot: text('mapping_slot').notNull().default('primary'),
    activeAssetId: uuid('active_asset_id')
      .notNull()
      .references(() => assetObjects.id, { onDelete: 'restrict' }),
    sourceAssetId: uuid('source_asset_id').references(() => assetObjects.id, {
      onDelete: 'restrict',
    }),
    selectionMode: assetSelectionMode('selection_mode').notNull(),
    sourceState: assetSourceState('source_state').notNull(),
    baseSourceHash: text('base_source_hash'),
    baseSourceSnapshotId: uuid('base_source_snapshot_id').references(() => sourceSnapshots.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    primaryKey({
      columns: [table.entityId, table.assetRole, table.mappingSlot],
      name: 'entity_asset_mappings_pk',
    }),
    foreignKey({
      columns: [table.entityId, table.entityType],
      foreignColumns: [managedEntities.id, managedEntities.entityType],
      name: 'entity_asset_mappings_managed_entity_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.entityType, table.assetRole],
      foreignColumns: [entityAssetRoleRules.entityType, entityAssetRoleRules.assetRole],
      name: 'entity_asset_mappings_role_rule_fk',
    }).onDelete('restrict'),
    index('entity_asset_mappings_active_asset_idx').on(table.activeAssetId),
    index('entity_asset_mappings_source_asset_idx')
      .on(table.sourceAssetId)
      .where(sql`${table.sourceAssetId} is not null`),
    index('entity_asset_mappings_type_role_idx').on(table.entityType, table.assetRole),
    check(
      'entity_asset_mappings_selection_check',
      sql`(${table.selectionMode} = 'source' and ${table.sourceAssetId} is not null and ${table.activeAssetId} = ${table.sourceAssetId}) or ${table.selectionMode} = 'manual'`,
    ),
  ],
);

export const assetUploadIntents = pgTable(
  'asset_upload_intents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityId: uuid('entity_id').notNull(),
    entityType: managedEntityType('entity_type').notNull(),
    assetRole: text('asset_role').notNull(),
    requestedProvenance: assetProvenance('requested_provenance').notNull(),
    requestedFilename: text('requested_filename'),
    quarantineObjectKey: text('quarantine_object_key').notNull(),
    maxBytes: bigint('max_bytes', { mode: 'number' }).notNull(),
    allowedMimeTypes: jsonb('allowed_mime_types').notNull(),
    expectedRevision: bigint('expected_revision', { mode: 'number' }).notNull(),
    status: uploadIntentStatus('status').notNull().default('issued'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    finalizedByUserId: uuid('finalized_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
  },
  (table) => [
    uniqueIndex('asset_upload_intents_quarantine_key_unique').on(table.quarantineObjectKey),
    foreignKey({
      columns: [table.entityId, table.entityType],
      foreignColumns: [managedEntities.id, managedEntities.entityType],
      name: 'asset_upload_intents_managed_entity_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.entityType, table.assetRole],
      foreignColumns: [entityAssetRoleRules.entityType, entityAssetRoleRules.assetRole],
      name: 'asset_upload_intents_role_rule_fk',
    }).onDelete('restrict'),
    index('asset_upload_intents_entity_status_idx').on(table.entityId, table.status),
    index('asset_upload_intents_expires_at_idx').on(table.expiresAt),
    check('asset_upload_intents_max_bytes_check', sql`${table.maxBytes} > 0`),
  ],
);
