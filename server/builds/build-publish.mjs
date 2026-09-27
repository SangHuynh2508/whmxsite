// server/builds/build-publish.mjs
// Pure: saved builds + game references → the `builds` and `refs` parts of the published lore document
// (spec docs/superpowers/specs/2026-09-26-character-build-design.md §4 "Publish"). Refs hold only what the builds use,
// names as { cn, vi, detail, detail_vi } with the same publish rule as every lore term (termPair / publishableVi).
import { termPair } from '../profile/shape-character-profile.mjs';

// builds: [{ characterId, position, doc }]; refs: Map "kind|code" → data; terms: Map code → lore_terms row.
export function shapePublishedBuilds({ builds, refs, terms }) {
  if (!builds.length) return null;
  const out = { weapons: {}, weaponSkills: {}, affixes: {}, styles: {}, sectors: {}, talents: {} };
  const ref = (kind, code) => refs.get(`${kind}|${code}`);
  const name = (kind, code) => termPair(terms, `${kind}:${code}`);

  const byCharacter = {};
  for (const { characterId, doc } of [...builds].sort((a, b) => a.characterId.localeCompare(b.characterId) || a.position - b.position)) {
    (byCharacter[characterId] ??= []).push(doc);
    for (const { weaponId } of doc.weapons) {
      const weapon = ref('weapon', weaponId);
      if (!weapon) continue;
      out.weapons[weaponId] = { name: name('weapon', weaponId), rare: weapon.rare, job: weapon.job, icon: weapon.icon, skillIds: weapon.skillIds };
      for (const skillId of weapon.skillIds) out.weaponSkills[skillId] = { name: name('weapon_skill', skillId) };
    }
    for (const affixId of doc.affixes.groups.flatMap((g) => g.affixIds)) {
      const affix = ref('weapon_affix', affixId);
      if (affix) out.affixes[affixId] = { name: name('weapon_affix', affixId), percent: affix.percent };
    }
    const style = doc.deepen ? ref('job_style', doc.deepen.styleId) : null;
    if (!style) continue;
    out.styles[doc.deepen.styleId] = { name: name('job_style', doc.deepen.styleId), icon: style.icon, sectorIds: style.sectorIds };
    for (const sectorId of style.sectorIds) {
      const sector = ref('style_sector', sectorId);
      if (!sector) continue;
      out.sectors[sectorId] = { name: name('style_sector', sectorId), icon: sector.icon, talentIds: sector.talentIds };
      for (const talentId of sector.talentIds.flat()) out.talents[talentId] = name('style_talent', talentId);
    }
  }
  return { builds: byCharacter, refs: out };
}
