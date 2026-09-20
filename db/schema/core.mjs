import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.mjs';

export const sourceKind = pgEnum('source_kind', ['masterdata', 'workbook', 'normalized_build']);
export const importRunStatus = pgEnum('import_run_status', [
  'started',
  'completed',
  'failed',
  'completed_with_conflicts',
]);
export const managedEntityType = pgEnum('managed_entity_type', [
  'character',
  'skin',
  'series',
  'preview_character',
]);
export const editEventType = pgEnum('edit_event_type', [
  'human_edit',
  'validated_relation_edit',
  'override_resolution',
  'source_import',
]);

export const sourceSnapshots = pgTable(
  'source_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceKind: sourceKind('source_kind').notNull(),
    sourceVersion: text('source_version').notNull(),
    contentHash: text('content_hash').notNull(),
    sourcePath: text('source_path'),
    manifest: jsonb('manifest').notNull().default({}),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_snapshots_receipt_unique').on(
      table.sourceKind,
      table.sourceVersion,
      table.contentHash,
    ),
    index('source_snapshots_kind_captured_at_idx').on(table.sourceKind, table.capturedAt),
  ],
);

export const managedEntities = pgTable(
  'managed_entities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: managedEntityType('entity_type').notNull(),
    sourceKey: text('source_key').notNull(),
    revision: bigint('revision', { mode: 'number' }).notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    editedByUserId: uuid('edited_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    uniqueIndex('managed_entities_type_source_key_unique').on(table.entityType, table.sourceKey),
    uniqueIndex('managed_entities_id_type_unique').on(table.id, table.entityType),
    index('managed_entities_updated_at_idx').on(table.updatedAt),
  ],
);

export const importRuns = pgTable(
  'import_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceSnapshotId: uuid('source_snapshot_id')
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
    status: importRunStatus('status').notNull().default('started'),
    initiatedByUserId: uuid('initiated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    counts: jsonb('counts').notNull().default({}),
    errorSummary: text('error_summary'),
  },
  (table) => [
    index('import_runs_status_started_at_idx').on(table.status, table.startedAt),
  ],
);

export const editHistory = pgTable(
  'edit_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    changeGroupId: uuid('change_group_id').notNull(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => managedEntities.id, { onDelete: 'restrict' }),
    entityType: managedEntityType('entity_type').notNull(),
    fieldName: text('field_name').notNull(),
    eventType: editEventType('event_type').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    importRunId: uuid('import_run_id').references(() => importRuns.id, {
      onDelete: 'restrict',
    }),
    requestId: uuid('request_id').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => [
    index('edit_history_edited_at_idx').on(table.editedAt),
    index('edit_history_entity_edited_at_idx').on(table.entityId, table.editedAt),
    index('edit_history_change_group_edited_at_idx').on(table.changeGroupId, table.editedAt),
    index('edit_history_actor_edited_at_idx').on(table.actorUserId, table.editedAt),
  ],
);
