import {
  bigint,
  boolean,
  check,
  foreignKey,
  integer,
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
import {
  editEventType,
  managedEntities,
  sourceSnapshots,
} from './core.mjs';

export const overrideState = pgEnum('override_state', [
  'none',
  'active',
  'source_changed',
  'resolved',
  'cleared',
]);

export const overrideMode = pgEnum('override_mode', ['inherit', 'set', 'clear']);
export const assetProvider = pgEnum('asset_provider', ['r2', 'public']);
export const assetRole = pgEnum('asset_role', ['drawing', 'card', 'avatar']);
export const assetProvenance = pgEnum('asset_provenance', [
  'source_extracted',
  'manual_official',
  'manual_preview',
  'manual_placeholder',
]);
export const assetStorageTier = pgEnum('asset_storage_tier', [
  'public_delivery',
  'private_original',
  'local_public',
]);
export const assetVerificationState = pgEnum('asset_verification_state', [
  'pending',
  'verified',
  'quarantined',
  'retired',
]);

export const characters = pgTable(
  'characters',
  {
    entityId: uuid('entity_id')
      .primaryKey()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    characterId: text('character_id').notNull(),
    sourceSnapshotId: uuid('source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    workbookSnapshotId: uuid('workbook_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    nameCn: text('name_cn').notNull(),
    fullnameCn: text('fullname_cn'),
    nameVi: text('name_vi'),
    fullnameVi: text('fullname_vi'),
    nicknameVi: text('nickname_vi'),
    tagsVi: text('tags_vi'),
    rawRare: integer('raw_rare'),
    rawJob: integer('raw_job'),
    rawAttackType: integer('raw_attack_type'),
    rawUnlockDate: integer('raw_unlock_date'),
    rawIdentity: jsonb('raw_identity').notNull().default({}),
    sourceValueHash: text('source_value_hash').notNull(),
    workbookValueHash: text('workbook_value_hash').notNull(),
    sourcePresent: boolean('source_present').notNull().default(true),
    sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('characters_character_id_unique').on(table.characterId),
    index('characters_source_snapshot_idx').on(table.sourceSnapshotId),
  ],
);

export const series = pgTable(
  'series',
  {
    entityId: uuid('entity_id')
      .primaryKey()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    seriesId: smallint('series_id').notNull().unique(),
    sourceSnapshotId: uuid('source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    workbookSnapshotId: uuid('workbook_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    nameCn: text('name_cn').notNull(),
    nameVi: text('name_vi').notNull(),
    badgeAssetId: uuid('badge_asset_id'),
    sourceValueHash: text('source_value_hash').notNull(),
    sourcePresent: boolean('source_present').notNull().default(true),
    sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('series_source_snapshot_idx').on(table.sourceSnapshotId),
  ],
);

export const skins = pgTable(
  'skins',
  {
    entityId: uuid('entity_id')
      .primaryKey()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    skinId: text('skin_id').notNull(),
    characterEntityId: uuid('character_entity_id')
      .notNull()
      .references(() => characters.entityId, { onDelete: 'restrict' }),
    sourceSnapshotId: uuid('source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    workbookSnapshotId: uuid('workbook_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    skinNameCn: text('skin_name_cn').notNull(),
    skinNameVi: text('skin_name_vi'),
    descriptionCn: text('description_cn'),
    descriptionVi: text('description_vi'),
    obtainCn: text('obtain_cn'),
    obtainVi: text('obtain_vi'),
    isBaseSkin: boolean('is_base_skin').notNull(),
    skinType: integer('skin_type').notNull(),
    unlockDate: integer('unlock_date'),
    price: integer('price'),
    currency: text('currency'),
    isHighSkin: boolean('is_high_skin').notNull(),
    skinRareRaw: jsonb('skin_rare_raw'),
    cvName: text('cv_name'),
    rawItemId: text('raw_item_id'),
    rawGoodsId: text('raw_goods_id'),
    rawDiscountGoodsId: text('raw_discount_goods_id'),
    rawDiscountPrice: integer('raw_discount_price'),
    rawDiscountStart: integer('raw_discount_start'),
    rawDiscountEnd: integer('raw_discount_end'),
    rawSeriesId: smallint('raw_series_id'),
    rawSource: jsonb('raw_source').notNull().default({}),
    sourceValueHash: text('source_value_hash').notNull(),
    workbookValueHash: text('workbook_value_hash').notNull(),
    sourcePresent: boolean('source_present').notNull().default(true),
    sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('skins_skin_id_unique').on(table.skinId),
    index('skins_character_entity_idx').on(table.characterEntityId),
    index('skins_source_series_idx').on(table.rawSeriesId),
    index('skins_source_snapshot_idx').on(table.sourceSnapshotId),
  ],
);

export const acquisitionCategories = pgTable(
  'acquisition_categories',
  {
    id: text('id').primaryKey(),
    labelVi: text('label_vi').notNull(),
    labelCn: text('label_cn'),
    sortOrder: smallint('sort_order').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [uniqueIndex('acquisition_categories_sort_order_unique').on(table.sortOrder)],
);

export const assetObjects = pgTable(
  'asset_objects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storageProvider: assetProvider('storage_provider').notNull(),
    objectKey: text('object_key').notNull(),
    publicUrl: text('public_url'),
    contentHash: text('content_hash').notNull(),
    mimeType: text('mime_type'),
    sourceSnapshotId: uuid('source_snapshot_id').references(() => sourceSnapshots.id, {
      onDelete: 'restrict',
    }),
    provenance: assetProvenance('provenance').notNull().default('source_extracted'),
    storageTier: assetStorageTier('storage_tier').notNull().default('local_public'),
    verificationState: assetVerificationState('verification_state').notNull().default('verified'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    derivedFromAssetId: uuid('derived_from_asset_id').references(() => assetObjects.id, {
      onDelete: 'restrict',
    }),
    byteSize: bigint('byte_size', { mode: 'number' }),
    detectedMimeType: text('detected_mime_type'),
    width: integer('width'),
    height: integer('height'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('asset_objects_provider_key_unique').on(table.storageProvider, table.objectKey),
    index('asset_objects_content_hash_idx').on(table.contentHash),
    index('asset_objects_provenance_verification_idx').on(
      table.provenance,
      table.verificationState,
    ),
    index('asset_objects_derived_from_asset_idx').on(table.derivedFromAssetId),
    check(
      'asset_objects_provenance_owner_check',
      sql`(
        (${table.provenance} = 'source_extracted' and ${table.sourceSnapshotId} is not null and ${table.createdByUserId} is null)
        or
        (${table.provenance} in ('manual_official', 'manual_preview', 'manual_placeholder') and ${table.sourceSnapshotId} is null and ${table.createdByUserId} is not null)
      )`,
    ),
    check(
      'asset_objects_private_original_url_check',
      sql`${table.storageTier} <> 'private_original' or ${table.publicUrl} is null`,
    ),
  ],
);

export const skinSeriesState = pgTable(
  'skin_series_state',
  {
    skinEntityId: uuid('skin_entity_id')
      .primaryKey()
      .references(() => skins.entityId, { onDelete: 'restrict' }),
    sourceSeriesId: smallint('source_series_id').references(() => series.seriesId, {
      onDelete: 'restrict',
    }),
    overrideMode: overrideMode('override_mode').notNull().default('inherit'),
    overrideSeriesId: smallint('override_series_id').references(() => series.seriesId, {
      onDelete: 'restrict',
    }),
    baseSourceValue: jsonb('base_source_value'),
    baseSourceHash: text('base_source_hash').notNull(),
    baseSourceSnapshotId: uuid('base_source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    state: overrideState('state').notNull().default('none'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'skin_series_state_override_check',
      sql`(${table.overrideMode} = 'set' AND ${table.overrideSeriesId} IS NOT NULL) OR (${table.overrideMode} IN ('inherit', 'clear') AND ${table.overrideSeriesId} IS NULL)`,
    ),
  ],
);

export const skinAcquisitionState = pgTable(
  'skin_acquisition_state',
  {
    skinEntityId: uuid('skin_entity_id').primaryKey(),
    sourceCategoryId: text('source_category_id'),
    overrideCategoryId: text('override_category_id'),
    baseSourceValue: jsonb('base_source_value'),
    baseSourceHash: text('base_source_hash').notNull(),
    baseSourceSnapshotId: uuid('base_source_snapshot_id').notNull(),
    state: overrideState('state').notNull().default('none'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.skinEntityId],
      foreignColumns: [skins.entityId],
      name: 'skin_acq_skin_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.sourceCategoryId],
      foreignColumns: [acquisitionCategories.id],
      name: 'skin_acq_source_category_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.overrideCategoryId],
      foreignColumns: [acquisitionCategories.id],
      name: 'skin_acq_override_category_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.baseSourceSnapshotId],
      foreignColumns: [sourceSnapshots.id],
      name: 'skin_acq_source_snapshot_fk',
    }).onDelete('restrict'),
  ],
);

export const skinAssetMappings = pgTable(
  'skin_asset_mappings',
  {
    skinEntityId: uuid('skin_entity_id').notNull(),
    assetRole: assetRole('asset_role').notNull(),
    sourceAssetId: uuid('source_asset_id').notNull(),
    overrideAssetId: uuid('override_asset_id'),
    baseSourceHash: text('base_source_hash').notNull(),
    baseSourceSnapshotId: uuid('base_source_snapshot_id').notNull(),
    state: overrideState('state').notNull().default('none'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.skinEntityId, table.assetRole], name: 'skin_asset_mappings_pk' }),
    foreignKey({
      columns: [table.skinEntityId],
      foreignColumns: [skins.entityId],
      name: 'skin_asset_mapping_skin_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.sourceAssetId],
      foreignColumns: [assetObjects.id],
      name: 'skin_asset_mapping_source_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.overrideAssetId],
      foreignColumns: [assetObjects.id],
      name: 'skin_asset_mapping_override_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.baseSourceSnapshotId],
      foreignColumns: [sourceSnapshots.id],
      name: 'skin_asset_mapping_source_snapshot_fk',
    }).onDelete('restrict'),
    index('skin_asset_mappings_source_asset_idx').on(table.sourceAssetId),
  ],
);

export const fieldOverrides = pgTable(
  'field_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    fieldName: text('field_name').notNull(),
    overrideValue: jsonb('override_value').notNull(),
    baseSourceValue: jsonb('base_source_value').notNull(),
    baseSourceHash: text('base_source_hash').notNull(),
    baseSourceSnapshotId: uuid('base_source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    state: overrideState('state').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('field_overrides_entity_field_unique').on(table.entityId, table.fieldName),
    index('field_overrides_state_idx').on(table.state),
  ],
);

export const sourceImportEventType = editEventType;
