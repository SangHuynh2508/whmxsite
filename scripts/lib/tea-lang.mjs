// scripts/lib/tea-lang.mjs
// Tea comments are language keys. refresh_masterdata.py decodes the language table of each capture
// (captures/<run>/lang/<v>_cn.json, from that run's .bin) and the newest launch provenance names it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function teaLangFile(masterDataDir) {
  const dir = join(masterDataDir, 'provenance');
  const newest = readdirSync(dir).filter((f) => /^launch_.*\.json$/.test(f)).sort().at(-1);
  if (!newest) throw new Error(`no launch provenance in ${dir}`);
  const rel = JSON.parse(readFileSync(join(dir, newest), 'utf8')).language_decoded_path;
  if (!rel) throw new Error(`${newest} has no language_decoded_path`);
  return join(masterDataDir, rel);
}

export const teaLangKeys = (lang) => Object.fromEntries(Object.entries(lang).filter(([key]) => key.startsWith('highteaLan_hightea_comment')));
