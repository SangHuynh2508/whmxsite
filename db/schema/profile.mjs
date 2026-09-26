// db/schema/profile.mjs
import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth.mjs';
import { characters } from './character-skin.mjs';
import { managedEntities, sourceSnapshots } from './core.mjs';

export const viOrigin = pgEnum('vi_origin', ['legacy_workbook', 'admin']);
export const loreTextState = pgEnum('lore_text_state', ['ok', 'source_changed']);
export const loreTermKind = pgEnum('lore_term_kind', ['relic_type', 'era', 'museum', 'era_range', 'affinity_level', 'organisation', 'relic_tag']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const characterProfiles = pgTable('character_profiles', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  characterEntityId: uuid('character_entity_id').notNull().references(() => characters.entityId, { onDelete: 'restrict' }),
  recordId: text('record_id').notNull().default(''),
  staffStatusCn: text('staff_status_cn').notNull().default(''),
  storeStatusCn: text('store_status_cn').notNull().default(''),
  organisationCode: text('organisation_code'),
  relicTypeCode: text('relic_type_code'),
  eraCode: text('era_code'),
  museumCode: text('museum_code'),
  eraRangeCode: text('era_range_code'),
  legacyRelicFields: jsonb('legacy_relic_fields').notNull(),
  structure: jsonb('structure').notNull(),
  sourceSnapshotId: uuid('source_snapshot_id').notNull().references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
  sourceHash: text('source_hash').notNull(),
  sourcePresent: boolean('source_present').notNull().default(true),
  sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [uniqueIndex('character_profiles_character_unique').on(table.characterEntityId)]);

const viColumns = {
  viOrigin: viOrigin('vi_origin'),
  state: loreTextState('state').notNull().default('ok'),
  viUpdatedByUserId: uuid('vi_updated_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  viUpdatedAt: timestamp('vi_updated_at', { withTimezone: true }),
  sourceHash: text('source_hash').notNull(),
  sourcePresent: boolean('source_present').notNull().default(true),
};

export const profileTexts = pgTable('profile_texts', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileEntityId: uuid('profile_entity_id').notNull().references(() => characterProfiles.entityId, { onDelete: 'restrict' }),
  unitKey: text('unit_key').notNull(),
  sourceCn: text('source_cn').notNull(),
  sourceRef: text('source_ref').notNull(),
  vi: text('vi'),
  ...viColumns,
  ...timestamps,
}, (table) => [
  uniqueIndex('profile_texts_profile_unit_unique').on(table.profileEntityId, table.unitKey),
  index('profile_texts_state_idx').on(table.state),
  check('profile_texts_vi_origin_pairing', sql`(${table.vi} is null) = (${table.viOrigin} is null)`),
]);

export const loreTerms = pgTable('lore_terms', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  code: text('code').notNull(),
  kind: loreTermKind('kind').notNull(),
  nameCn: text('name_cn').notNull(),
  detailCn: text('detail_cn').notNull().default(''),
  nameVi: text('name_vi'),
  detailVi: text('detail_vi'),
  ...viColumns,
  ...timestamps,
}, (table) => [
  uniqueIndex('lore_terms_code_unique').on(table.code),
  check('lore_terms_vi_origin_pairing', sql`(${table.nameVi} is null and ${table.detailVi} is null) = (${table.viOrigin} is null)`),
]);

export const lorePublishState = pgTable('lore_publish_state', {
  id: smallint('id').primaryKey().default(1),
  publishedFile: text('published_file'),
  publishedHash: text('published_hash'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedByUserId: uuid('published_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  lastEditAt: timestamp('last_edit_at', { withTimezone: true }),
}, (table) => [check('lore_publish_state_single_row', sql`${table.id} = 1`)]);

export const lorePublishLockKey = 7_319_024; // pg advisory lock key for publishLore (any stable bigint)
