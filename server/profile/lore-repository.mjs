// server/profile/lore-repository.mjs
import { eq, getTableColumns, inArray, sql } from 'drizzle-orm';

import { characterBuilds, gameReferences } from '../../db/schema/build.mjs';
import { characters } from '../../db/schema/character-skin.mjs';
import { editHistory } from '../../db/schema/core.mjs';
import { characterProfiles, lorePublishLockKey, lorePublishState, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { shapePublishedBuilds } from '../builds/build-publish.mjs';
import { loadProfileContext, resolveAllProfiles } from './resolve-character-profile.mjs';

// Profile texts carry their character ID so a backup can be matched against a rebuilt DB.
export function selectProfileTextsWithCharacterId(db) {
  return db.select({ ...getTableColumns(profileTexts), characterId: characters.characterId })
    .from(profileTexts)
    .innerJoin(characterProfiles, eq(characterProfiles.entityId, profileTexts.profileEntityId))
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId));
}

const firstRow = (result) => (Array.isArray(result) ? result[0] : result.rows?.[0]); // same shape handling as db/client.mjs

// The Build tables arrive with migration 0007; until it is applied, lore publishing and backups carry on without them.
async function hasBuildTables(tx) {
  return Boolean(firstRow(await tx.execute(sql`select to_regclass('public.character_builds') is not null as present`))?.present);
}

export function createLoreRepository(db) {
  return {
    async withPublishLock(fn) {
      return db.transaction(async (tx) => {
        const result = await tx.execute(sql`select pg_try_advisory_xact_lock(${lorePublishLockKey}) as locked`);
        return firstRow(result)?.locked ? fn(tx) : { status: 'busy' };
      }, { isolationLevel: 'repeatable read' }); // one snapshot for every read that builds the document
    },
    async loadPublishProfiles(tx) {
      return resolveAllProfiles(await loadProfileContext(tx), { shape: 'v2' });
    },
    // Build tab: saved builds + the game references they use (null when there is no build yet).
    async loadPublishBuilds(tx) {
      if (!(await hasBuildTables(tx))) return null;
      const builds = await tx.select({ characterId: characters.characterId, position: characterBuilds.position, doc: characterBuilds.doc })
        .from(characterBuilds).innerJoin(characters, eq(characters.entityId, characterBuilds.characterEntityId));
      if (!builds.length) return null;
      const refs = new Map((await tx.select().from(gameReferences)).map((r) => [`${r.kind}|${r.code}`, r.data]));
      const terms = new Map((await tx.select().from(loreTerms)).map((t) => [t.code, t]));
      return shapePublishedBuilds({ builds, refs, terms });
    },
    async loadBackupPayload(tx) {
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        characterProfiles: await tx.select().from(characterProfiles),
        profileTexts: await selectProfileTextsWithCharacterId(tx),
        loreTerms: await tx.select().from(loreTerms),
        lorePublishState: await tx.select().from(lorePublishState),
        characterBuilds: (await hasBuildTables(tx)) ? await tx.select().from(characterBuilds) : [],
        editHistory: await tx.select().from(editHistory).where(inArray(editHistory.entityType, ['character_profile', 'lore_term', 'character_build'])),
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
