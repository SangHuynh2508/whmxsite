// scripts/seed-lore-admin-vi.mjs — one-time VI seeds approved in spec §4 (2026-09-25).
// Usage: node [--env-file=.env.production.local] scripts/seed-lore-admin-vi.mjs --part=titles|orgs [--apply]
// Without --apply nothing is written; the printout is what the owner approves.
import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import { characters } from '../db/schema/character-skin.mjs';
import { managedEntities } from '../db/schema/core.mjs';
import { characterProfiles } from '../db/schema/profile.mjs';
import { listLoreTerms, saveLoreTerm, saveLoreTexts } from '../server/profile/lore-admin.mjs';
import { DEPARTMENT_VI } from '../server/profile/profile-code-maps.mjs';
import { selectProfileTextsWithCharacterId } from '../server/profile/lore-repository.mjs';
import { planOrgSeed, planTitleSeed } from './lib/lore-seed.mjs';

const part = process.argv.find((a) => a.startsWith('--part='))?.split('=')[1];
const apply = process.argv.includes('--apply');
if (!['titles', 'orgs'].includes(part)) throw new Error('--part=titles|orgs is required');

const db = getDb();
console.log(`database: ${new URL(process.env.DATABASE_URL).hostname.split('.')[0]} · part: ${part} · ${apply ? 'APPLY' : 'plan only'}`);

async function ownerId() {
  const owners = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'owner'), eq(users.status, 'active')));
  if (owners.length !== 1) throw new Error(`expected exactly one active owner, found ${owners.length}`);
  return owners[0].id;
}

if (part === 'titles') {
  const rows = (await selectProfileTextsWithCharacterId(db)).filter((r) => r.sourcePresent);
  const plan = planTitleSeed(rows);
  console.log(JSON.stringify({ writes: plan.writes.length, replacedLegacy: plan.replacedLegacy.length, keptAdmin: plan.keptAdmin.length, unknownCn: plan.unknownCn.length }));
  for (const w of plan.writes) console.log(`write   ${w.characterId} ${w.unitKey} → ${w.vi}`);
  for (const r of plan.replacedLegacy) console.log(`legacy  ${r.characterId} ${r.unitKey}: "${r.vi}" will be replaced`);
  for (const r of plan.keptAdmin) console.log(`kept    ${r.characterId} ${r.unitKey}: admin text "${r.vi}" is left as is`);
  for (const r of plan.unknownCn) console.log(`unknown ${r.characterId} ${r.unitKey}: CN "${r.sourceCn}" has no approved VI`);
  if (apply) {
    const actorUserId = await ownerId();
    const revisions = new Map((await db.select({ id: characters.characterId, revision: managedEntities.revision })
      .from(characterProfiles)
      .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
      .innerJoin(managedEntities, eq(managedEntities.id, characterProfiles.entityId))).map((r) => [r.id, r.revision]));
    const byCharacter = Map.groupBy(plan.writes, (w) => w.characterId);
    const result = { written: 0, conflicts: [] };
    for (const [characterId, writes] of byCharacter) {
      try {
        const r = await saveLoreTexts(db, characterId, { expectedRevision: revisions.get(characterId), texts: Object.fromEntries(writes.map((w) => [w.unitKey, w.vi])), actorUserId });
        if (r.changed) result.written += writes.length;
      } catch (error) {
        if (error?.status !== 409) throw error;
        result.conflicts.push(characterId); // someone saved meanwhile: re-run the plan, never overwrite blindly
      }
    }
    console.log(JSON.stringify(result));
  }
}

if (part === 'orgs') {
  const terms = await listLoreTerms(db);
  const plan = planOrgSeed(terms, DEPARTMENT_VI);
  console.log(JSON.stringify({ writes: plan.writes.length, alreadyOfficial: plan.alreadyOfficial, unmapped: plan.unmapped }));
  const byCode = new Map(terms.map((t) => [t.code, t]));
  for (const w of plan.writes) console.log(`write   ${w.code} ${byCode.get(w.code).nameCn} → ${w.nameVi} (used by ${byCode.get(w.code).usedBy.length})`);
  if (apply) {
    const actorUserId = await ownerId();
    const result = { written: 0, conflicts: [] };
    for (const w of plan.writes) {
      const t = byCode.get(w.code);
      try {
        const r = await saveLoreTerm(db, w.code, { expectedRevision: t.revision, nameVi: w.nameVi, detailVi: t.detailVi, actorUserId });
        if (r.changed) result.written += 1;
      } catch (error) {
        if (error?.status !== 409) throw error;
        result.conflicts.push(w.code);
      }
    }
    console.log(JSON.stringify(result));
  }
}
process.exit(0);
