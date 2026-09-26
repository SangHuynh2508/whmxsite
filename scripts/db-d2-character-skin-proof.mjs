import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { cleanupFailed } from './lib/cleanup.mjs';

const marker = `d2-proof-${randomUUID()}`;
const email = `${marker}@d2.invalid`;
const password = randomBytes(24).toString('base64url');
let db;
let fixtureUserId;
let characterId;
let skinId;
let originalCharacter;
let originalSkin;
let schema;
let originalCharacterOverrides = [];
let originalSkinOverrides = [];
try {
  const [{ provisioningAuth, internalAuthHeaders }, { getDb, closeDb }, loadedSchema, domain] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/index.mjs'),
    import('../server/character-skin-admin-domain.mjs'),
  ]);
  schema = loadedSchema;
  db = getDb();
  const created = await provisioningAuth.api.signUpEmail({ body: { name: marker, email, password }, headers: internalAuthHeaders() });
  fixtureUserId = created.user.id;
  const listed = await domain.listCharacters();
  assert.equal(listed.length, 133);
  characterId = listed[0].characterId;
  const detail = await domain.getCharacter(characterId);
  assert.ok(detail.character.protected.characterId === undefined || detail.character.characterId === characterId);
  assert.ok(detail.character.tagsCn);
  assert.equal(detail.character.tagsCn, detail.character.protected.rawIdentity.CharacterTagLanText);
  assert.ok(detail.skins.length >= 1);
  skinId = detail.skins[0].skinId;
  originalCharacter = detail.character;
  originalSkin = detail.skins[0];
  const [characterEntity] = await db.select({ id: schema.managedEntities.id }).from(schema.managedEntities).where(and(eq(schema.managedEntities.entityType, 'character'), eq(schema.managedEntities.sourceKey, characterId)));
  const [skinEntity] = await db.select({ id: schema.managedEntities.id }).from(schema.managedEntities).where(and(eq(schema.managedEntities.entityType, 'skin'), eq(schema.managedEntities.sourceKey, skinId)));
  originalCharacterOverrides = characterEntity ? await db.select().from(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, characterEntity.id)) : [];
  originalSkinOverrides = skinEntity ? await db.select().from(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, skinEntity.id)) : [];
  const first = await domain.updateCharacter(characterId, { actorUserId: fixtureUserId, expectedRevision: originalCharacter.revision, changes: { nameVi: `${marker} override` }, requestId: randomUUID() });
  assert.equal(first.changed, true);
  const afterCharacter = await domain.getCharacter(characterId);
  assert.equal(afterCharacter.character.nameVi.value, `${marker} override`);
  assert.equal(afterCharacter.character.revision, originalCharacter.revision + 1);
  const stale = await domain.updateCharacter(characterId, { actorUserId: fixtureUserId, expectedRevision: originalCharacter.revision, changes: { nameVi: 'stale' }, requestId: randomUUID() }).catch((error) => error);
  assert.equal(stale.code, 'VERSION_CONFLICT');
  const skinResult = await domain.updateSkin(skinId, { actorUserId: fixtureUserId, expectedRevision: originalSkin.revision, changes: { descriptionVi: `${marker} skin` }, requestId: randomUUID() });
  assert.equal(skinResult.changed, true);
  const afterSkin = await domain.getSkin(skinId);
  assert.equal(afterSkin.skin.descriptionVi.value, `${marker} skin`);
  await db.update(schema.users).set({ role: 'owner' }).where(eq(schema.users.id, fixtureUserId));
  const ownerWrite = await domain.updateCharacter(characterId, { actorUserId: fixtureUserId, expectedRevision: afterCharacter.character.revision, changes: { nicknameVi: `${marker} owner` }, requestId: randomUUID() });
  assert.equal(ownerWrite.changed, true);
  const auditCount = await db.execute(sql`select count(*)::int as count from edit_history where actor_user_id = ${fixtureUserId}`);
  assert.ok(Number(auditCount[0]?.count ?? 0) >= 2);
  const protectedAttempt = await domain.updateCharacter(characterId, { actorUserId: fixtureUserId, expectedRevision: afterCharacter.character.revision, changes: { characterId: 'forbidden' }, requestId: randomUUID() }).catch((error) => error);
  assert.equal(protectedAttempt.name, 'ZodError');
  console.log(JSON.stringify({ test: 'd2-character-skin-admin-proof', status: 'PASS', characters: listed.length, skinsForCharacter: detail.skins.length, optimisticConflict: stale.code, editorWrite: true, ownerWrite: ownerWrite.changed, audits: Number(auditCount[0]?.count ?? 0) }));
} finally {
  if (db && fixtureUserId) {
    await db.execute(sql`delete from edit_history where actor_user_id = ${fixtureUserId}`).catch(cleanupFailed);
  }
  if (db && characterId && originalCharacter) {
    const entities = schema?.managedEntities;
    if (entities) {
      const [entity] = await db.select({ id: entities.id, revision: entities.revision }).from(entities).where(and(eq(entities.entityType, 'character'), eq(entities.sourceKey, characterId)));
      if (entity) {
        await db.delete(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, entity.id)).catch(cleanupFailed);
        await db.update(entities).set({ revision: originalCharacter.revision, editedByUserId: null, updatedAt: new Date() }).where(eq(entities.id, entity.id)).catch(cleanupFailed);
        if (originalCharacterOverrides.length) await db.insert(schema.fieldOverrides).values(originalCharacterOverrides).catch(cleanupFailed);
      }
    }
  }
  if (db && skinId && originalSkin) {
    const entities = schema?.managedEntities;
    if (entities) {
      const [entity] = await db.select({ id: entities.id }).from(entities).where(and(eq(entities.entityType, 'skin'), eq(entities.sourceKey, skinId)));
      if (entity) {
        await db.delete(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, entity.id)).catch(cleanupFailed);
        await db.update(entities).set({ revision: originalSkin.revision, editedByUserId: null, updatedAt: new Date() }).where(eq(entities.id, entity.id)).catch(cleanupFailed);
        if (originalSkinOverrides.length) await db.insert(schema.fieldOverrides).values(originalSkinOverrides).catch(cleanupFailed);
      }
    }
  }
  if (db && fixtureUserId) {
    const authSchema = await import('../db/schema/auth.mjs');
    await db.delete(authSchema.users).where(eq(authSchema.users.id, fixtureUserId)).catch(cleanupFailed);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
