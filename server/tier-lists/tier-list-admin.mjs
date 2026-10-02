// server/tier-lists/tier-list-admin.mjs
// Admin Tier List area: list / create / read / save / delete. Same rules as builds (build-admin.mjs): every save is
// validated, bumps the entity revision (409 on a stale one), writes edit_history and marks the public data stale so the
// ~30 s auto-publish picks it up. Lists are addressed by their slug (set once, never changed).
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { asc, eq, sql } from 'drizzle-orm';

import { editHistory, managedEntities } from '../../db/schema/core.mjs';
import { tierLists } from '../../db/schema/tier-list.mjs';
import { AdminApiError } from '../admin-api.mjs';
import { bumpRevision } from '../profile/lore-admin.mjs';
import { createLoreRepository } from '../profile/lore-repository.mjs';
import { SLUG, STATUSES, defaultTierListDoc, tierListContext, validateTierList } from './tier-list-validate.mjs';

let siteCharacters;
const loadSiteCharacters = () => (siteCharacters ??= readFile(new URL('../../public/data.json', import.meta.url), 'utf8').then((s) => JSON.parse(s).characters));

const columns = { id: tierLists.entityId, slug: tierLists.slug, status: tierLists.status, position: tierLists.position, doc: tierLists.doc, revision: managedEntities.revision, updatedAt: tierLists.updatedAt };
const selectLists = (db) => db.select(columns).from(tierLists).innerJoin(managedEntities, eq(managedEntities.id, tierLists.entityId));

async function rowOf(tx, slug) {
  const [row] = await selectLists(tx).where(eq(tierLists.slug, String(slug ?? '')));
  if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown tier list.');
  return row;
}

async function validated(doc) {
  const { doc: clean, errors } = validateTierList(doc, tierListContext(await loadSiteCharacters()));
  if (errors.length) {
    const error = new AdminApiError(422, 'INVALID_TIER_LIST', errors.map((e) => `${e.path} ${e.code}`).join(', '));
    error.details = errors;
    throw error;
  }
  return clean;
}

const history = (tx, { entityId, requestId, actorUserId, oldValue, newValue }) => tx.insert(editHistory).values({
  changeGroupId: requestId, requestId, entityId, entityType: 'tier_list', fieldName: 'doc', eventType: 'human_edit', oldValue, newValue, actorUserId,
});
const snapshot = (row) => ({ status: row.status, position: row.position, doc: row.doc });
const markStale = (db, tx, now) => createLoreRepository(db).writeState(tx, { lastEditAt: now });

export async function listTierLists(db) {
  const rows = await selectLists(db).orderBy(asc(tierLists.position), asc(tierLists.slug));
  return rows.map(({ doc, ...row }) => ({ ...row, title: doc.title }));
}

export const getTierList = (db, slug) => rowOf(db, slug);

export async function createTierList(db, { slug, title, actorUserId, requestId = randomUUID(), now = new Date() }) {
  slug = String(slug ?? '').trim();
  if (!SLUG.test(slug) || slug.length > 40) throw new AdminApiError(422, 'INVALID_SLUG', 'Slug: a-z, 0-9 and single dashes, at most 40.');
  const doc = await validated(defaultTierListDoc(String(title ?? '')));
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: tierLists.entityId }).from(tierLists).where(eq(tierLists.slug, slug));
    if (taken) throw new AdminApiError(409, 'SLUG_TAKEN', 'This slug is already used.');
    const [entity] = await tx.insert(managedEntities).values({ entityType: 'tier_list', sourceKey: `tier-list:${slug}`, editedByUserId: actorUserId }).returning({ id: managedEntities.id });
    const [{ next }] = await tx.select({ next: sql`coalesce(max(${tierLists.position}) + 1, 0)`.mapWith(Number) }).from(tierLists);
    await tx.insert(tierLists).values({ entityId: entity.id, slug, position: next, doc, createdAt: now, updatedAt: now });
    await history(tx, { entityId: entity.id, requestId, actorUserId, oldValue: null, newValue: { status: 'draft', position: next, doc } });
    return rowOf(tx, slug);
  });
}

export async function saveTierList(db, slug, { expectedRevision, doc, status, position, actorUserId, requestId = randomUUID(), now = new Date() }) {
  if (status !== undefined && !STATUSES.includes(status)) throw new AdminApiError(422, 'INVALID_STATUS', 'Unknown status.');
  if (position !== undefined && !(Number.isInteger(position) && position >= 0)) throw new AdminApiError(422, 'INVALID_POSITION', 'Bad position.');
  const clean = doc === undefined ? undefined : await validated(doc);
  return db.transaction(async (tx) => {
    const row = await rowOf(tx, slug);
    if (row.revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    await bumpRevision(tx, row.id, expectedRevision, actorUserId, now);
    const patch = { updatedAt: now, ...(clean && { doc: clean }), ...(status && { status }), ...(position !== undefined && { position }) };
    await tx.update(tierLists).set(patch).where(eq(tierLists.entityId, row.id));
    await history(tx, { entityId: row.id, requestId, actorUserId, oldValue: snapshot(row), newValue: snapshot({ ...row, ...patch }) });
    await markStale(db, tx, now);
    return rowOf(tx, slug);
  });
}

// The row goes; its managed entity and edit_history (with the last doc) stay, so a deleted list can be recovered.
export async function deleteTierList(db, slug, { expectedRevision, actorUserId, actorRole, requestId = randomUUID(), now = new Date() }) {
  if (actorRole !== 'owner') throw new AdminApiError(403, 'FORBIDDEN', 'Only the owner deletes a tier list.');
  return db.transaction(async (tx) => {
    const row = await rowOf(tx, slug);
    await bumpRevision(tx, row.id, expectedRevision, actorUserId, now);
    await tx.delete(tierLists).where(eq(tierLists.entityId, row.id));
    await history(tx, { entityId: row.id, requestId, actorUserId, oldValue: snapshot(row), newValue: null });
    await markStale(db, tx, now);
    return { slug: row.slug, deleted: true };
  });
}
