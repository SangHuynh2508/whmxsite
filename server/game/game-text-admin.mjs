// server/game/game-text-admin.mjs
// Admin translation of game texts (weapon, skill, affix, 深造 names…): same rules and editor as lore terms.
import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { gameReferences, gameTexts } from '../../db/schema/build.mjs';
import { editHistory, managedEntities } from '../../db/schema/core.mjs';
import { AdminApiError } from '../admin-api.mjs';
import { bumpRevision } from '../profile/lore-admin.mjs';
import { planTermEdit } from '../profile/lore-edit.mjs';
import { createLoreRepository } from '../profile/lore-repository.mjs';
import { withWeaponSkills } from './weapon-skills.mjs';

export async function listGameTexts(db) {
  const rows = await db.select({ text: gameTexts, revision: managedEntities.revision })
    .from(gameTexts).innerJoin(managedEntities, eq(managedEntities.id, gameTexts.entityId)).where(eq(gameTexts.sourcePresent, true));
  const texts = rows
    .map(({ text: t, revision }) => ({ kind: t.kind, code: t.code, nameCn: t.nameCn, detailCn: t.detailCn, nameVi: t.nameVi, detailVi: t.detailVi, viOrigin: t.viOrigin, state: t.state, revision }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code));
  const weaponRefs = await db.select({ kind: gameReferences.kind, code: gameReferences.code, data: gameReferences.data }).from(gameReferences).where(eq(gameReferences.kind, 'weapon'));
  return withWeaponSkills(texts, weaponRefs);
}

export async function saveGameText(db, kind, code, { expectedRevision, nameVi, detailVi, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ text: gameTexts, revision: managedEntities.revision })
      .from(gameTexts).innerJoin(managedEntities, eq(managedEntities.id, gameTexts.entityId))
      .where(and(eq(gameTexts.kind, String(kind || '')), eq(gameTexts.code, String(code || ''))));
    if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown game text.');
    if (row.revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const { write } = planTermEdit(row.text, { nameVi, detailVi });
    if (!write) return { revision: row.revision, changed: false };
    await tx.update(gameTexts).set({ ...write.after, viUpdatedByUserId: actorUserId, viUpdatedAt: now, updatedAt: now }).where(eq(gameTexts.entityId, row.text.entityId));
    const next = await bumpRevision(tx, row.text.entityId, expectedRevision, actorUserId, now);
    await tx.insert(editHistory).values({ changeGroupId: requestId, requestId, entityId: row.text.entityId, entityType: 'game_text', fieldName: 'name_detail_vi', eventType: 'human_edit', oldValue: write.before, newValue: write.after, actorUserId });
    await createLoreRepository(db).writeState(tx, { lastEditAt: now });
    return { revision: next, changed: true };
  });
}
