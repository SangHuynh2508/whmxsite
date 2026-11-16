// Split public/data.json (the source every tool and server module reads) into what the browser loads
// (owner 2026-11-14): data/index.json for every page, data/c/<id>.json only when a character is opened,
// data/buffs.json with the first character. Generated output in public/data/ (gitignored); runs before dev/build.
// See docs/DATA_SPLIT.md.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Fields loaded per character; everything else stays in the index. */
export const DETAIL_FIELDS = ['skills', 'talents', 'zhizhi', 'brilliant_skills', 'brilliant_info', 'profile'];
/** Profile bits the catalogue search needs before any detail is loaded. */
const PROFILE_BRIEF = ['department', 'record_id'];

export function splitData(data) {
  const { buff_registry: buffs = {}, characters = {}, ...rest } = data;
  const index = { ...rest, characters: {} };
  const details = {};
  for (const [id, char] of Object.entries(characters)) {
    const light = {};
    const heavy = {};
    for (const [k, v] of Object.entries(char)) (DETAIL_FIELDS.includes(k) ? heavy : light)[k] = v;
    if (char.profile) light.profile = Object.fromEntries(PROFILE_BRIEF.filter((k) => k in char.profile).map((k) => [k, char.profile[k]]));
    index.characters[id] = light;
    details[id] = heavy;
  }
  return { index, details, buffs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../public/', import.meta.url);
  const { index, details, buffs } = splitData(JSON.parse(readFileSync(new URL('data.json', root), 'utf8')));
  const out = new URL('data/', root);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(new URL('c/', out), { recursive: true });
  writeFileSync(new URL('index.json', out), JSON.stringify(index));
  writeFileSync(new URL('buffs.json', out), JSON.stringify(buffs));
  for (const [id, d] of Object.entries(details)) writeFileSync(new URL(`c/${id}.json`, out), JSON.stringify(d));
  console.log(`split_data: index + ${Object.keys(details).length} characters + buffs → public/data/`);
}
