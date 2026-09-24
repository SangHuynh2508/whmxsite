// server/profile/lore-repository.mjs
import { inArray, sql } from 'drizzle-orm';

import { editHistory } from '../../db/schema/core.mjs';
import { characterProfiles, lorePublishLockKey, lorePublishState, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { loadProfileContext, resolveAllProfiles } from './resolve-character-profile.mjs';

export function createLoreRepository(db) {
  return {
    async withPublishLock(fn) {
      return db.transaction(async (tx) => {
        const result = await tx.execute(sql`select pg_try_advisory_xact_lock(${lorePublishLockKey}) as locked`);
        const row = Array.isArray(result) ? result[0] : result.rows?.[0]; // same shape handling as db/client.mjs
        return row?.locked ? fn(tx) : { status: 'busy' };
      });
    },
    async loadPublishProfiles(tx) {
      return resolveAllProfiles(await loadProfileContext(tx), { shape: 'v2' });
    },
    async loadBackupPayload(tx) {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        characterProfiles: await tx.select().from(characterProfiles),
        profileTexts: await tx.select().from(profileTexts),
        loreTerms: await tx.select().from(loreTerms),
        lorePublishState: await tx.select().from(lorePublishState),
        editHistory: await tx.select().from(editHistory).where(inArray(editHistory.entityType, ['character_profile', 'lore_term'])),
      };
    },
    async readState(tx) {
      const [row] = await tx.select().from(lorePublishState);
      return row ?? null;
    },
    async writeState(tx, patch) {
      await tx.insert(lorePublishState).values({ id: 1, ...patch }).onConflictDoUpdate({ target: lorePublishState.id, set: patch });
    },
  };
}
