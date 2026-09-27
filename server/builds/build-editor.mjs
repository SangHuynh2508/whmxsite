// server/builds/build-editor.mjs
// Pure: DB rows → what the admin Build module needs (the character's builds + the game data it may pick from),
// and the context validateBuild checks a save against. Names are { cn, vi } with the current VI (admins see drafts).

import { withDeepens } from './build-validate.mjs';

function lookup(refs, texts) {
  const refOf = new Map(refs.map((r) => [`${r.kind}|${r.code}`, r]));
  const textOf = new Map(texts.map((t) => [`${t.kind}|${t.code}`, t]));
  const name = (kind, code) => { const t = textOf.get(`${kind}|${code}`); return { cn: t?.nameCn ?? String(code), vi: t?.nameVi ?? null }; };
  const detail = (kind, code) => { const t = textOf.get(`${kind}|${code}`); return { cn: t?.detailCn ?? '', vi: t?.detailVi ?? null }; };
  return { ref: (kind, code) => refOf.get(`${kind}|${code}`)?.data ?? null, name, detail };
}

const present = (refs, kind) => refs.filter((r) => r.kind === kind && r.sourcePresent);

// characterStyle = the character's game_references character_style data (null when the character has none);
// job falls back to the character row's raw job then.
export function shapeBuildEditor({ characterId, characterStyle, job = null, refs, texts, builds }) {
  const { ref, name, detail } = lookup(refs, texts);
  const characterJob = characterStyle?.job ?? job;
  const styleIds = characterStyle?.styleIds ?? [];
  return {
    character: { id: characterId, job: characterJob, styleIds, recommendedStyleId: characterStyle?.recommendedStyleId ?? null },
    builds: [...builds].sort((a, b) => a.position - b.position).map((b) => ({ id: b.entityId, revision: b.revision, doc: withDeepens(b.doc) })),
    catalogue: {
      weapons: present(refs, 'weapon').filter((r) => r.data.job === characterJob)
        .sort((a, b) => b.data.rare - a.data.rare || a.code.localeCompare(b.code))
        .map((r) => ({
          id: r.code, rare: r.data.rare, icon: r.data.icon, name: name('weapon', r.code),
          skills: r.data.skillIds.map((id) => ({ id, name: name('weapon_skill', id), detail: detail('weapon_skill', id) })),
        })),
      affixes: present(refs, 'weapon_affix').filter((r) => r.data.jobs.includes(characterJob))
        .map((r) => ({ id: r.code, percent: r.data.percent, name: name('weapon_affix', r.code) })),
      styles: styleIds.map((id) => ({
        id, name: name('job_style', id),
        sectors: (ref('job_style', id)?.sectorIds ?? []).map((sectorId) => ({
          id: sectorId, name: name('style_sector', sectorId),
          talents: (ref('style_sector', sectorId)?.talentIds ?? []).map((point) => point.map((t) => ({ id: t, text: name('style_talent', t) }))),
        })),
      })),
    },
  };
}

// skillIds / characterIds come from public/data.json (the site's own character data), see build-admin.mjs.
export function buildValidationContext({ characterId, characterStyle, job = null, refs, skillIds, characterIds }) {
  return {
    character: { id: characterId, job: characterStyle?.job ?? job, styleIds: characterStyle?.styleIds ?? [], skillIds },
    weapons: new Map(present(refs, 'weapon').map((r) => [r.code, { job: r.data.job }])),
    affixes: new Map(present(refs, 'weapon_affix').map((r) => [r.code, { jobs: r.data.jobs }])),
    characterIds: new Set(characterIds),
  };
}
