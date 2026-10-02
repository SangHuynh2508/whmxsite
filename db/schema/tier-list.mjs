// db/schema/tier-list.mjs — curated tier lists (spec docs/superpowers/specs/2026-10-02-tier-list-design.md §3).
// One row per list; `doc` = the validated document (server/tier-lists/tier-list-validate.mjs). Revision lives on the
// managed entity (409 on a stale save, like builds). Drafts never leave the DB; published + archived ride in the game
// document. The slug is set once at creation and never changes (public links).
import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { managedEntities } from './core.mjs';

export const tierListStatus = pgEnum('tier_list_status', ['draft', 'published', 'archived']);

export const tierLists = pgTable('tier_lists', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull(),
  status: tierListStatus('status').notNull().default('draft'),
  position: integer('position').notNull().default(0),
  doc: jsonb('doc').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('tier_lists_slug_unique').on(table.slug),
  check('tier_lists_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${table.slug}) <= 40`),
  check('tier_lists_position_nonnegative', sql`${table.position} >= 0`),
]);
