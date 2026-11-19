// server/profile/voice-document.mjs
// Pure: published voice-line VI → voice.<hash>.json (spec 2026-11-19-voice-translation §5). Its own file, loaded only
// by the Lồng Tiếng tab: once translated it can pass 1 MB, and the lore file is loaded on every page.
//   { version: 1, unlock: { <cn>: <vi> }, characters: { <ID>: { "<skin>.<type>[.<lang>]": <vi> } } }
import { createHash } from 'node:crypto';

import { publishableVi } from './shape-character-profile.mjs';

export function buildVoiceDocument({ texts, unlocks }) {
  const characters = {};
  for (const t of [...texts].sort((a, b) => a.characterId.localeCompare(b.characterId) || a.unitKey.localeCompare(b.unitKey))) {
    const vi = t.sourcePresent && t.unitKey.startsWith('voice.') ? publishableVi(t) : null;
    if (vi) (characters[t.characterId] ??= {})[t.unitKey.slice('voice.'.length)] = vi;
  }
  const unlock = {};
  for (const u of [...unlocks].sort((a, b) => a.nameCn.localeCompare(b.nameCn))) {
    const vi = u.sourcePresent ? publishableVi(u, 'nameVi') : null;
    if (vi) unlock[u.nameCn] = vi;
  }
  const body = JSON.stringify({ version: 1, unlock, characters });
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return { body, hash, fileName: `voice.${hash}.json` };
}
