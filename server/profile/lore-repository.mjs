// server/profile/lore-repository.mjs
import { eq, getTableColumns, inArray, sql } from 'drizzle-orm';

import { characterBuilds, gameReferences, gameTexts } from '../../db/schema/build.mjs';
import { characters } from '../../db/schema/character-skin.mjs';
import { editHistory } from '../../db/schema/core.mjs';
import { tierLists } from '../../db/schema/tier-list.mjs';
import { characterProfiles, lorePublishLockKey, lorePublishState, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { loadProfileContext, resolveAllProfiles } from './resolve-character-profile.mjs';

// Profile texts carry their character ID so a backup can be matched against a rebuilt DB.
export function selectProfileTextsWithCharacterId(db) {
  return db.select({ ...getTableColumns(profileTexts), characterId: characters.characterId })
    .from(profileTexts)
    .innerJoin(characterProfiles, eq(characterProfiles.entityId, profileTexts.profileEntityId))
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId));
}

export function createLoreRepository(db) {
  return {
    async withPublishLock(fn) {
      return db.transaction(async (tx) => {
        const result = await tx.execute(sql`select pg_try_advisory_xact_lock(${lorePublishLockKey}) as locked`);
        const row = Array.isArray(result) ? result[0] : result.rows?.[0]; // same shape handling as db/client.mjs
        return row?.locked ? fn(tx) : { status: 'busy' };
      }, { isolationLevel: 'repeatable read' }); // one snapshot for every read that builds the document
    },
    async loadPublishProfiles(tx) {
      return resolveAllProfiles(await loadProfileContext(tx), { shape: 'v2' });
    },
    // game.<hash>.json input (server/game/game-document.mjs): the whole game catalogue, its texts and every build.
    async loadGameDocumentInput(tx) {
      return {
        refs: await tx.select().from(gameReferences),
        texts: await tx.select().from(gameTexts),
        builds: await tx.select({ characterId: characters.characterId, position: characterBuilds.position, doc: characterBuilds.doc })
          .from(characterBuilds).innerJoin(characters, eq(characters.entityId, characterBuilds.characterEntityId)),
        tierLists: await tx.select({ slug: tierLists.slug, status: tierLists.status, position: tierLists.position, doc: tierLists.doc, updatedAt: tierLists.updatedAt }).from(tierLists),
      };
    },
    async loadBackupPayload(tx) {
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        characterProfiles: await tx.select().from(characterProfiles),
        profileTexts: await selectProfileTextsWithCharacterId(tx),
        loreTerms: await tx.select().from(loreTerms),
        lorePublishState: await tx.select().from(lorePublishState),
        // human-written game data (game_references are re-imported from MasterData, not backed up)
        characterBuilds: await tx.select().from(characterBuilds),
        gameTexts: await tx.select().from(gameTexts),
        tierLists: await tx.select().from(tierLists),
        editHistory: await tx.select().from(editHistory).where(inArray(editHistory.entityType, ['character_profile', 'lore_term', 'character_build', 'game_text', 'tier_list'])),
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
