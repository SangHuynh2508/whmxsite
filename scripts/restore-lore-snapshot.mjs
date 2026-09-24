// scripts/restore-lore-snapshot.mjs
// Usage: restore-lore-snapshot.mjs <file.json.gz> --actor <owner email> [--apply]
// Default is a dry run. --apply writes the DB (owner approval required).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { eq, inArray, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import { editHistory, managedEntities } from '../db/schema/core.mjs';
import { lorePublishState, loreTerms, profileTexts } from '../db/schema/profile.mjs';
import { selectProfileTextsWithCharacterId } from '../server/profile/lore-repository.mjs';
import { planRestore } from '../server/profile/lore-restore.mjs';

const [file, ...rest] = process.argv.slice(2);
const actorEmail = rest[rest.indexOf('--actor') + 1];
const applyChanges = rest.includes('--apply');
try {
  if (!file || !actorEmail || rest.indexOf('--actor') < 0) throw new Error('usage: <file.json.gz> --actor <owner email> [--apply]');
  const snapshot = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  const db = getDb();
  const [actor] = await db.select().from(users).where(eq(users.email, actorEmail));
  if (!actor || actor.role !== 'owner' || actor.status !== 'active') throw new Error('actor must be an active owner');
  const plan = planRestore(snapshot, { profileTexts: await selectProfileTextsWithCharacterId(db), loreTerms: await db.select().from(loreTerms) });
  console.log(JSON.stringify({ mode: applyChanges ? 'apply' : 'dry run (nothing written)', texts: plan.texts, terms: plan.terms, unmatched: plan.unmatched }, null, 2));
  // Unmatched snapshot rows mean this DB lacks units the backup has (run the importer first).
  if (applyChanges && plan.unmatched.length) throw new Error(`${plan.unmatched.length} snapshot rows have no matching DB row; run the importer first`);
  if (applyChanges && (plan.texts.length || plan.terms.length)) {
    await db.transaction(async (tx) => {
      const now = new Date();
      const group = randomUUID();
      const byId = new Map((await tx.select().from(profileTexts)).map((r) => [r.id, r]));
      const history = [];
      for (const change of plan.texts) {
        await tx.update(profileTexts).set({ ...change.after, viUpdatedByUserId: actor.id, viUpdatedAt: now, updatedAt: now }).where(eq(profileTexts.id, change.id));
        history.push({ entityId: byId.get(change.id).profileEntityId, entityType: 'character_profile', fieldName: change.unitKey, oldValue: change.before, newValue: change.after });
      }
      const termIds = new Map((await tx.select().from(loreTerms)).map((r) => [r.code, r.entityId]));
      for (const change of plan.terms) {
        await tx.update(loreTerms).set({ ...change.after, viUpdatedByUserId: actor.id, viUpdatedAt: now, updatedAt: now }).where(eq(loreTerms.code, change.code));
        history.push({ entityId: termIds.get(change.code), entityType: 'lore_term', fieldName: 'vi', oldValue: change.before, newValue: change.after });
      }
      await tx.insert(editHistory).values(history.map((h) => ({ ...h, changeGroupId: group, requestId: group, eventType: 'human_edit', actorUserId: actor.id, metadata: { restoredFrom: file } })));
      await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(inArray(managedEntities.id, [...new Set(history.map((h) => h.entityId))]));
      await tx.insert(lorePublishState).values({ id: 1, lastEditAt: now }).onConflictDoUpdate({ target: lorePublishState.id, set: { lastEditAt: now } });
    });
    console.log('RESTORE_APPLIED');
  }
} catch (error) {
  console.error(`LORE_RESTORE_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
