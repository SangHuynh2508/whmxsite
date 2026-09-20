import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import {
  characters,
  fieldOverrides,
  skins,
} from '../db/schema/character-skin.mjs';
import { importRuns, managedEntities } from '../db/schema/core.mjs';
import { hashValue, loadSourceBundle, runImport } from './import-character-skin.mjs';

const db = getDb();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(rows) {
  return Number(rows[0]?.count ?? 0);
}

try {
  const bundle = loadSourceBundle({});

  const idempotent = await runImport(db, bundle);
  assert(idempotent.status === 'completed', `idempotent import status: ${idempotent.status}`);
  assert(idempotent.counts.inserted === 0, `idempotent inserted: ${idempotent.counts.inserted}`);
  assert(idempotent.counts.updated === 0, `idempotent updated: ${idempotent.counts.updated}`);
  assert(idempotent.counts.conflicted === 0, `idempotent conflicts: ${idempotent.counts.conflicted}`);
  assert(idempotent.counts.unchanged === 297, `idempotent unchanged: ${idempotent.counts.unchanged}`);

  const beforeOmission = count(await db.execute(sql`select count(*)::int as count from skins`));
  const omissionBundle = {
    ...bundle,
    skins: bundle.skins.filter((skin) => skin.skinId !== 'S0174003'),
    assets: bundle.assets.filter((asset) => asset.skinId !== 'S0174003'),
  };
  const omission = await runImport(db, omissionBundle, { validateExpectedCounts: false });
  assert(omission.counts.skipped >= 1, 'omitted source entity was not reported as skipped');
  const afterOmission = count(await db.execute(sql`select count(*)::int as count from skins`));
  assert(afterOmission === beforeOmission, 'omitted source entity was deleted');
  assert(count(await db.execute(sql`select count(*)::int as count from skins where skin_id = 'S0174003'`)) === 1, 'omitted skin disappeared');

  const character = (await db.select().from(characters).where(eq(characters.characterId, 'A0001')))[0];
  const managed = (await db.select().from(managedEntities).where(eq(managedEntities.id, character.entityId)))[0];
  assert(character && managed, 'proof character A0001 is missing');
  const proofUserId = randomUUID();
  const proofEmail = `milestone-c-proof-${proofUserId}@invalid.local`;
  const now = new Date();
  await db.insert(users).values({
    id: proofUserId,
    name: 'Milestone C proof user',
    email: proofEmail,
    emailVerified: false,
    role: 'editor',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  const originalName = character.nameVi;
  await db.insert(fieldOverrides).values({
    entityId: managed.id,
    fieldName: 'name_vi',
    overrideValue: '__working_override__',
    baseSourceValue: originalName,
    baseSourceHash: hashValue(originalName),
    baseSourceSnapshotId: character.workbookSnapshotId,
    state: 'active',
    createdByUserId: proofUserId,
    updatedByUserId: proofUserId,
    createdAt: now,
    updatedAt: now,
  });
  const changedName = '__milestone_c_source_change__';
  const changedBundle = {
    ...bundle,
    characters: bundle.characters.map((candidate) => candidate.characterId === 'A0001'
      ? {
          ...candidate,
          nameVi: changedName,
          workbookValueHash: hashValue({
            nameVi: changedName,
            fullnameVi: candidate.fullnameVi,
            nicknameVi: candidate.nicknameVi,
            tagsVi: candidate.tagsVi,
          }),
        }
      : candidate),
  };
  const conflict = await runImport(db, changedBundle, { validateExpectedCounts: false });
  assert(conflict.status === 'completed_with_conflicts', `override conflict status: ${conflict.status}`);
  assert(conflict.counts.conflicted >= 1, 'active field override conflict was not reported');
  const conflictOverride = (await db.select().from(fieldOverrides).where(and(
    eq(fieldOverrides.entityId, managed.id),
    eq(fieldOverrides.fieldName, 'name_vi'),
  )))[0];
  const changedCharacter = (await db.select().from(characters).where(eq(characters.entityId, managed.id)))[0];
  assert(conflictOverride?.state === 'source_changed', `override state: ${conflictOverride?.state}`);
  assert(conflictOverride.overrideValue === '__working_override__', 'working override was overwritten');
  assert(conflictOverride.baseSourceValue === changedName, 'new source baseline was not recorded');
  assert(changedCharacter.nameVi === changedName, 'source baseline did not update');

  await db.delete(fieldOverrides).where(eq(fieldOverrides.id, conflictOverride.id));
  await db.delete(users).where(eq(users.id, proofUserId));
  await runImport(db, bundle);
  const restored = (await db.select().from(characters).where(eq(characters.entityId, managed.id)))[0];
  assert(restored.nameVi === originalName, 'canonical source was not restored after proof cleanup');

  const runsBeforeRollback = count(await db.execute(sql`select count(*)::int as count from import_runs`));
  const beforeRollback = (await db.select().from(characters).where(eq(characters.entityId, managed.id)))[0];
  let rollbackObserved = false;
  try {
    await runImport(db, bundle, { failAfterEntity: 1 });
  } catch (error) {
    rollbackObserved = error instanceof Error && error.message === 'IMPORT_TEST_FAILURE';
  }
  assert(rollbackObserved, 'rollback proof did not receive the injected failure');
  const runsAfterRollback = count(await db.execute(sql`select count(*)::int as count from import_runs`));
  const afterRollback = (await db.select().from(characters).where(eq(characters.entityId, managed.id)))[0];
  assert(runsAfterRollback === runsBeforeRollback, 'failed import left an import_runs row');
  assert(afterRollback.nameVi === beforeRollback.nameVi && afterRollback.workbookValueHash === beforeRollback.workbookValueHash, 'failed import changed domain data');

  console.log(JSON.stringify({
    test: 'character-skin-import-proof',
    status: 'PASS',
    idempotent: idempotent.counts,
    omission: omission.counts,
    conflict: conflict.counts,
    rollback: 'rolled back',
  }));
} finally {
  await closeDb();
}
