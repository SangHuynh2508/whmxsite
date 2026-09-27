// server/builds/build-admin.mjs
// Admin Build module: read a character's builds with the game data to pick from; create / save / delete a build.
// Every save is validated (build-validate.mjs), bumps the build's revision (409 on a stale one), writes edit_history
// and marks the public data stale so the lore/game auto-publish picks it up (~30 s, like lore).
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { and, eq, sql } from 'drizzle-orm';

import { characterBuilds, gameReferences, gameTexts } from '../../db/schema/build.mjs';
import { characters } from '../../db/schema/character-skin.mjs';
import { editHistory, managedEntities } from '../../db/schema/core.mjs';
import { AdminApiError } from '../admin-api.mjs';
import { bumpRevision } from '../profile/lore-admin.mjs';
import { createLoreRepository } from '../profile/lore-repository.mjs';
import { buildValidationContext, shapeBuildEditor } from './build-editor.mjs';
import { validateBuild } from './build-validate.mjs';

// The site's own character data (public/data.json): which characters exist and each one's skill ids.
let siteCharacters;
const loadSiteCharacters = () => (siteCharacters ??= readFile(new URL('../../public/data.json', import.meta.url), 'utf8').then((s) => JSON.parse(s).characters));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function characterRow(tx, characterId) {
  const [row] = await tx.select({ entityId: characters.entityId, rawJob: characters.rawJob }).from(characters).where(eq(characters.characterId, String(characterId || '')));
  if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown character.');
  return row;
}

async function characterStyleOf(tx, characterId) {
  const [row] = await tx.select({ data: gameReferences.data }).from(gameReferences)
    .where(and(eq(gameReferences.kind, 'character_style'), eq(gameReferences.code, characterId)));
  return row?.data ?? null;
}

async function buildRow(tx, buildId) {
  if (!UUID.test(String(buildId))) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown build.');
  const [row] = await tx.select({ doc: characterBuilds.doc, characterId: characters.characterId, rawJob: characters.rawJob, revision: managedEntities.revision })
    .from(characterBuilds)
    .innerJoin(characters, eq(characters.entityId, characterBuilds.characterEntityId))
    .innerJoin(managedEntities, eq(managedEntities.id, characterBuilds.entityId))
    .where(eq(characterBuilds.entityId, buildId));
  if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown build.');
  return row;
}

async function validated(tx, characterId, rawJob, doc) {
  const site = await loadSiteCharacters();
  const ctx = buildValidationContext({
    characterId, characterStyle: await characterStyleOf(tx, characterId), job: rawJob,
    refs: await tx.select().from(gameReferences),
    skillIds: (site[characterId]?.skills ?? []).map((s) => s.group_id),
    characterIds: Object.keys(site),
  });
  const { doc: clean, errors } = validateBuild(doc, ctx);
  if (errors.length) {
    const error = new AdminApiError(422, 'INVALID_BUILD', errors.map((e) => `${e.path} ${e.code}`).join(', '));
    error.details = errors;
    throw error;
  }
  return clean;
}

const history = (tx, { entityId, requestId, actorUserId, oldValue, newValue }) => tx.insert(editHistory).values({
  changeGroupId: requestId, requestId, entityId, entityType: 'character_build', fieldName: 'doc', eventType: 'human_edit', oldValue, newValue, actorUserId,
});
const markStale = (db, tx, now) => createLoreRepository(db).writeState(tx, { lastEditAt: now });

export async function getBuildEditor(db, characterId) {
  const row = await characterRow(db, characterId);
  const builds = await db.select({ entityId: characterBuilds.entityId, position: characterBuilds.position, doc: characterBuilds.doc, revision: managedEntities.revision })
    .from(characterBuilds).innerJoin(managedEntities, eq(managedEntities.id, characterBuilds.entityId))
    .where(eq(characterBuilds.characterEntityId, row.entityId));
  return shapeBuildEditor({
    characterId, characterStyle: await characterStyleOf(db, characterId), job: row.rawJob,
    refs: await db.select().from(gameReferences), texts: await db.select().from(gameTexts), builds,
  });
}

export async function createBuild(db, characterId, { doc, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const row = await characterRow(tx, characterId);
    const clean = await validated(tx, characterId, row.rawJob, doc);
    const [entity] = await tx.insert(managedEntities).values({ entityType: 'character_build', sourceKey: `${characterId}:${randomUUID()}`, editedByUserId: actorUserId }).returning({ id: managedEntities.id, revision: managedEntities.revision });
    const [{ next }] = await tx.select({ next: sql`coalesce(max(${characterBuilds.position}) + 1, 0)`.mapWith(Number) }).from(characterBuilds).where(eq(characterBuilds.characterEntityId, row.entityId));
    await tx.insert(characterBuilds).values({ entityId: entity.id, characterEntityId: row.entityId, position: next, doc: clean });
    await history(tx, { entityId: entity.id, requestId, actorUserId, oldValue: null, newValue: clean });
    await markStale(db, tx, now);
    return { id: entity.id, revision: entity.revision, doc: clean };
  });
}

export async function saveBuild(db, buildId, { expectedRevision, doc, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const row = await buildRow(tx, buildId);
    if (row.revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const clean = await validated(tx, row.characterId, row.rawJob, doc);
    const revision = await bumpRevision(tx, buildId, expectedRevision, actorUserId, now);
    await tx.update(characterBuilds).set({ doc: clean, updatedAt: now }).where(eq(characterBuilds.entityId, buildId));
    await history(tx, { entityId: buildId, requestId, actorUserId, oldValue: row.doc, newValue: clean });
    await markStale(db, tx, now);
    return { id: buildId, revision, doc: clean };
  });
}

// The build row goes; its managed entity and edit_history (with the last doc) stay, so a deleted build can be recovered.
export async function deleteBuild(db, buildId, { expectedRevision, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const row = await buildRow(tx, buildId);
    await bumpRevision(tx, buildId, expectedRevision, actorUserId, now);
    await tx.delete(characterBuilds).where(eq(characterBuilds.entityId, buildId));
    await history(tx, { entityId: buildId, requestId, actorUserId, oldValue: row.doc, newValue: null });
    await markStale(db, tx, now);
    return { id: buildId, deleted: true };
  });
}
