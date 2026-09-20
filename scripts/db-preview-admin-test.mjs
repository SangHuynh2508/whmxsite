import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { editHistory, managedEntities, previewCharacters, characterPublicationStates, users } from '../db/schema/index.mjs';
import { createPreviewCharacter, setPreviewPublicationState, updatePreviewCharacter } from '../server/preview-characters/preview-character-domain.mjs';
import { getPreviewCharacter, listPreviewCharacters } from '../server/preview-characters/preview-character-read-domain.mjs';

const marker = `d0c-admin-${randomUUID()}`;
let db;
let ownerId;
let editorId;
let entityId;
try {
  db = getDb();
  await db.transaction(async (tx) => {
    ownerId = randomUUID(); editorId = randomUUID();
    await tx.insert(users).values([
      { id: ownerId, name: `${marker}-owner`, email: `${ownerId}@d0c.invalid`, role: 'owner', status: 'active' },
      { id: editorId, name: `${marker}-editor`, email: `${editorId}@d0c.invalid`, role: 'editor', status: 'active' },
    ]);
    const created = await createPreviewCharacter(tx, {
      actorUserId: editorId,
      requestId: randomUUID(),
      nameVi: `${marker}-preview`,
      nameCn: '预览角色',
      claimedRawId: 'CANDIDATE-0001',
      claimedRawIdEvidence: { reviewed: false },
      provenanceNotes: 'Manual preview fixture',
    });
    entityId = created.entityId;
  });

  const listed = await listPreviewCharacters({ q: marker });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].origin, 'manual_preview');
  assert.equal(listed[0].lifecycle, 'unverified');
  assert.equal(listed[0].visibility, 'hidden');
  assert.equal(listed[0].claimedRawId, 'CANDIDATE-0001');

  const detail = await getPreviewCharacter(entityId);
  assert.equal(detail.revision, 1);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.reconciliation.length, 0);

  await db.transaction((tx) => updatePreviewCharacter(tx, {
    actorUserId: editorId,
    requestId: randomUUID(),
    entityId,
    expectedRevision: 1,
    patch: { nameVi: `${marker}-edited`, tagsVi: 'manual' },
  }));
  await db.transaction((tx) => setPreviewPublicationState(tx, {
    actorUserId: ownerId,
    requestId: randomUUID(),
    entityId,
    expectedRevision: 2,
    lifecycle: 'unreleased',
    visibility: 'preview',
  }));
  const updated = await getPreviewCharacter(entityId);
  assert.equal(updated.revision, 3);
  assert.equal(updated.lifecycle, 'unreleased');
  assert.equal(updated.visibility, 'preview');
  assert.ok(updated.history.length >= 3);

  await assert.rejects(
    () => db.transaction((tx) => setPreviewPublicationState(tx, {
      actorUserId: editorId,
      requestId: randomUUID(), entityId, expectedRevision: 3,
      lifecycle: 'released', visibility: 'public',
    })),
    (error) => error.code === 'FORBIDDEN',
  );
  await assert.rejects(
    () => db.transaction((tx) => updatePreviewCharacter(tx, {
      actorUserId: ownerId,
      requestId: randomUUID(), entityId, expectedRevision: 1,
      patch: { nameVi: 'stale must not win' },
    })),
    (error) => error.code === 'VERSION_CONFLICT',
  );
  console.log('DB_PREVIEW_ADMIN_D0C_TEST=PASS');
} finally {
  if (db && entityId) {
    await db.transaction(async (tx) => {
      await tx.delete(editHistory).where(eq(editHistory.entityId, entityId));
      await tx.delete(characterPublicationStates).where(eq(characterPublicationStates.entityId, entityId));
      await tx.delete(previewCharacters).where(eq(previewCharacters.entityId, entityId));
      await tx.delete(managedEntities).where(eq(managedEntities.id, entityId));
    }).catch(() => undefined);
  }
  if (db) {
    if (ownerId) await db.delete(users).where(eq(users.id, ownerId)).catch(() => undefined);
    if (editorId) await db.delete(users).where(eq(users.id, editorId)).catch(() => undefined);
  }
  await closeDb();
}
