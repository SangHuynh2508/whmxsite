// server/game/game-document.mjs
// Pure: game database + builds → the public game document game.<hash>.json (owner 2026-09-27: its own file on R2,
// separate from lore; read by the Build tab now and later by popups and the weapon / team pages).
//   { version: 1,
//     refs:  { <kind>: { <code>: data } },                      // game_references, the whole catalogue
//     texts: { <kind>: { <code>: { cn, vi, detail, detail_vi } } }, // game_texts, VI only when published (lore rule)
//     builds: { <characterId>: [doc, …] } }                     // character_builds in position order
// Objects gone from MasterData (source_present = false) are published only while a build still uses them.
import { createHash } from 'node:crypto';

import { withDeepens } from '../builds/build-validate.mjs';
import { publishableVi } from '../profile/shape-character-profile.mjs';

const byKindCode = (a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code);

// Codes a build points at, as "kind|code" (the kinds shared by game_references and game_texts).
function usedByBuilds(builds) {
  const used = new Set();
  for (const { doc } of builds) {
    for (const w of doc.weapons ?? []) used.add(`weapon|${w.weaponId}`);
    for (const g of doc.affixes?.groups ?? []) for (const id of g.affixIds ?? []) used.add(`weapon_affix|${id}`);
    for (const d of withDeepens(doc).deepens ?? []) used.add(`job_style|${d.styleId}`);
  }
  return used;
}

export function buildGameDocument({ refs, texts, builds }) {
  const used = usedByBuilds(builds);
  const published = (row) => row.sourcePresent || used.has(`${row.kind}|${row.code}`);

  const outRefs = {};
  for (const row of [...refs].sort(byKindCode)) if (published(row)) (outRefs[row.kind] ??= {})[row.code] = row.data;
  const outTexts = {};
  for (const row of [...texts].sort(byKindCode)) {
    if (!published(row)) continue;
    (outTexts[row.kind] ??= {})[row.code] = { cn: row.nameCn, vi: publishableVi(row, 'nameVi'), detail: row.detailCn ?? '', detail_vi: publishableVi(row, 'detailVi') };
  }
  const outBuilds = {};
  for (const { characterId, doc } of [...builds].sort((a, b) => a.characterId.localeCompare(b.characterId) || a.position - b.position)) {
    (outBuilds[characterId] ??= []).push(withDeepens(doc));
  }

  const body = JSON.stringify({ version: 1, refs: outRefs, texts: outTexts, builds: outBuilds });
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return { body, hash, fileName: `game.${hash}.json` };
}
