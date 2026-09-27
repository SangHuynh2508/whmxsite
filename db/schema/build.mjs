// db/schema/build.mjs — game database + builds (spec docs/superpowers/specs/2026-09-26-character-build-design.md §4,
// owner decision 2026-09-27: game text in its own table, published in its own game.<hash>.json, not in lore).
// game_references = structure of every game object (kind + code); game_texts = its translatable name/description;
// character_builds = what editors write (they store codes only). Builds, popups and later the weapon / team pages
// all read the same catalogue.
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { characters } from './character-skin.mjs';
import { managedEntities } from './core.mjs';
import { viColumns } from './profile.mjs';

export const gameRefKind = pgEnum('game_ref_kind', ['weapon', 'weapon_affix', 'job_style', 'style_sector', 'character_style']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const gameTextKind = pgEnum('game_text_kind', ['weapon', 'weapon_skill', 'weapon_affix', 'job_style', 'style_sector', 'style_talent']);

// Translatable text of a game object, same rules as lore_terms: CN from MasterData, VI edited in Admin, only
// viOrigin = admin + state = ok is published, a CN change under a VI → state = source_changed.
export const gameTexts = pgTable('game_texts', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  kind: gameTextKind('kind').notNull(),
  code: text('code').notNull(),
  nameCn: text('name_cn').notNull(),
  detailCn: text('detail_cn').notNull().default(''),
  nameVi: text('name_vi'),
  detailVi: text('detail_vi'),
  ...viColumns,
  ...timestamps,
}, (table) => [
  uniqueIndex('game_texts_kind_code_unique').on(table.kind, table.code),
  check('game_texts_vi_origin_pairing', sql`(${table.nameVi} is null and ${table.detailVi} is null) = (${table.viOrigin} is null)`),
]);

// One row per game object; `data` = the normaliser's structural fields. Rows gone from MasterData keep
// source_present = false (never deleted: builds may still point at them).
export const gameReferences = pgTable('game_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: gameRefKind('kind').notNull(),
  code: text('code').notNull(),
  data: jsonb('data').notNull(),
  sourceHash: text('source_hash').notNull(),
  sourcePresent: boolean('source_present').notNull().default(true),
  sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [uniqueIndex('game_references_kind_code_unique').on(table.kind, table.code)]);

// A build of a character (several per character, shown as tabs in `position` order). `doc` = spec §5; its
// revision lives on the managed entity (409 on a stale save, like lore).
export const characterBuilds = pgTable('character_builds', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  characterEntityId: uuid('character_entity_id').notNull().references(() => characters.entityId, { onDelete: 'restrict' }),
  position: integer('position').notNull().default(0),
  doc: jsonb('doc').notNull(),
  ...timestamps,
}, (table) => [
  index('character_builds_character_idx').on(table.characterEntityId, table.position),
  check('character_builds_position_nonnegative', sql`${table.position} >= 0`),
]);
