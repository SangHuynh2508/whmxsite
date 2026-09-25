// server/profile/lore-admin.mjs
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';

import manifest from '../../asset-publish-manifest.json' with { type: 'json' };
import { characters } from '../../db/schema/character-skin.mjs';
import { editHistory, managedEntities } from '../../db/schema/core.mjs';
import { characterProfiles, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { AdminApiError } from '../admin-api.mjs';
import { archiveImagesFor, loreProgress, planLoreTextEdit, planTermEdit, shapeLoreRecord, termUsage } from './lore-edit.mjs';
import { createLoreRepository } from './lore-repository.mjs';

async function profileOf(tx, characterId) {
  const [row] = await tx.select({ profile: characterProfiles, revision: managedEntities.revision })
    .from(characterProfiles)
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .innerJoin(managedEntities, eq(managedEntities.id, characterProfiles.entityId))
    .where(and(eq(characters.characterId, String(characterId || '')), eq(characterProfiles.sourcePresent, true)));
  if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'No lore for this character.');
  return row;
}

async function bumpRevision(tx, entityId, expectedRevision, actorUserId, now) {
  const [row] = await tx.update(managedEntities)
    .set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now, editedByUserId: actorUserId })
    .where(and(eq(managedEntities.id, entityId), eq(managedEntities.revision, expectedRevision)))
    .returning({ revision: managedEntities.revision });
  if (!row) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
  return row.revision;
}

export async function getLoreRecord(db, characterId) {
  const { profile, revision } = await profileOf(db, characterId);
  const texts = await db.select().from(profileTexts).where(eq(profileTexts.profileEntityId, profile.entityId));
  const terms = new Map((await db.select().from(loreTerms)).map((t) => [t.code, t]));
  const history = await db.select({ id: editHistory.id, fieldName: editHistory.fieldName, eventType: editHistory.eventType, oldValue: editHistory.oldValue, newValue: editHistory.newValue, actorUserId: editHistory.actorUserId, editedAt: editHistory.editedAt })
    .from(editHistory).where(eq(editHistory.entityId, profile.entityId)).orderBy(desc(editHistory.editedAt)).limit(200);
  return shapeLoreRecord({ characterId, revision, profile, texts, terms, history, archiveImages: archiveImagesFor(manifest, characterId) });
}

export async function saveLoreTexts(db, characterId, { expectedRevision, texts, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const { profile, revision } = await profileOf(tx, characterId);
    if (revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const units = await tx.select().from(profileTexts).where(and(eq(profileTexts.profileEntityId, profile.entityId), eq(profileTexts.sourcePresent, true)));
    const plan = planLoreTextEdit(units, texts);
    if (plan.error) throw new AdminApiError(422, plan.error, plan.unknown.join(', '));
    if (!plan.writes.length) return { revision, changed: false };
    for (const w of plan.writes) {
      await tx.update(profileTexts).set({ ...w.after, viUpdatedByUserId: actorUserId, viUpdatedAt: now, updatedAt: now }).where(eq(profileTexts.id, w.id));
    }
    const next = await bumpRevision(tx, profile.entityId, expectedRevision, actorUserId, now);
    await tx.insert(editHistory).values(plan.writes.map((w) => ({
      changeGroupId: requestId, requestId, entityId: profile.entityId, entityType: 'character_profile',
      fieldName: w.unitKey, eventType: 'human_edit', oldValue: w.before, newValue: w.after, actorUserId,
    })));
    await createLoreRepository(db).writeState(tx, { lastEditAt: now });
    return { revision: next, changed: true };
  });
}

export async function listLoreTerms(db) {
  const rows = await db.select({ term: loreTerms, revision: managedEntities.revision })
    .from(loreTerms).innerJoin(managedEntities, eq(managedEntities.id, loreTerms.entityId));
  const profiles = await db.select({ characterId: characters.characterId, organisationCode: characterProfiles.organisationCode, relicTypeCode: characterProfiles.relicTypeCode, eraCode: characterProfiles.eraCode, museumCode: characterProfiles.museumCode, eraRangeCode: characterProfiles.eraRangeCode, structure: characterProfiles.structure })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId)).where(eq(characterProfiles.sourcePresent, true));
  const usage = termUsage(profiles);
  return rows
    .map(({ term: t, revision }) => ({ code: t.code, kind: t.kind, nameCn: t.nameCn, detailCn: t.detailCn, nameVi: t.nameVi, detailVi: t.detailVi, viOrigin: t.viOrigin, state: t.state, revision, usedBy: usage[t.code] ?? [] }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code));
}

export async function saveLoreTerm(db, code, { expectedRevision, nameVi, detailVi, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ term: loreTerms, revision: managedEntities.revision })
      .from(loreTerms).innerJoin(managedEntities, eq(managedEntities.id, loreTerms.entityId)).where(eq(loreTerms.code, String(code || '')));
    if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown term.');
    if (row.revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const { write } = planTermEdit(row.term, { nameVi, detailVi });
    if (!write) return { revision: row.revision, changed: false };
    await tx.update(loreTerms).set({ ...write.after, viUpdatedByUserId: actorUserId, viUpdatedAt: now, updatedAt: now }).where(eq(loreTerms.entityId, row.term.entityId));
    const next = await bumpRevision(tx, row.term.entityId, expectedRevision, actorUserId, now);
    await tx.insert(editHistory).values({ changeGroupId: requestId, requestId, entityId: row.term.entityId, entityType: 'lore_term', fieldName: 'name_detail_vi', eventType: 'human_edit', oldValue: write.before, newValue: write.after, actorUserId });
    await createLoreRepository(db).writeState(tx, { lastEditAt: now });
    return { revision: next, changed: true };
  });
}

export async function getLoreProgress(db) {
  const rows = await db.select({ characterId: characters.characterId, vi: profileTexts.vi, viOrigin: profileTexts.viOrigin, state: profileTexts.state })
    .from(profileTexts)
    .innerJoin(characterProfiles, eq(characterProfiles.entityId, profileTexts.profileEntityId))
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .where(and(eq(profileTexts.sourcePresent, true), eq(characterProfiles.sourcePresent, true)));
  return loreProgress(rows);
}
