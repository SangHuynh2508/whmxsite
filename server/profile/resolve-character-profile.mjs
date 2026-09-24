// server/profile/resolve-character-profile.mjs
// Per-entity resolver (engineering principles §2). Batch callers load one context and loop.
import { eq } from 'drizzle-orm';

import { characters } from '../../db/schema/character-skin.mjs';
import { characterProfiles, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { shapeCharacterProfile } from './shape-character-profile.mjs';

export async function loadProfileContext(db) {
  const rows = await db.select({ characterId: characters.characterId, profile: characterProfiles })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .where(eq(characterProfiles.sourcePresent, true));
  const entries = new Map(rows.map((r) => [r.characterId, { profile: r.profile, texts: new Map() }]));
  const byEntity = new Map(rows.map((r) => [r.profile.entityId, r.characterId]));
  for (const text of await db.select().from(profileTexts).where(eq(profileTexts.sourcePresent, true))) {
    const id = byEntity.get(text.profileEntityId);
    if (id) entries.get(id).texts.set(text.unitKey, text);
  }
  const terms = new Map((await db.select().from(loreTerms)).map((t) => [t.code, t]));
  return { entries, terms };
}

export function resolveCharacterProfile(characterId, ctx, { shape }) {
  const entry = ctx.entries.get(characterId);
  return entry ? shapeCharacterProfile(entry, ctx.terms, { shape }) : null;
}

export function resolveAllProfiles(ctx, { shape }) {
  return [...ctx.entries.keys()].sort().map((id) => [id, resolveCharacterProfile(id, ctx, { shape })]);
}
