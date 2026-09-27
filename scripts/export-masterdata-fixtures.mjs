// Copies the MasterData tables the Build feature needs (spec docs/superpowers/specs/2026-09-26-character-build-design.md §3)
// from the local NeoArtifacts checkout into scripts/fixtures/masterdata/, trimmed to the referenced rows, so work that has no
// NeoArtifacts (e.g. a cloud session) can write and test the importer/normaliser against real data.
// Run locally after a game update: node scripts/export-masterdata-fixtures.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILD_TABLES, FULL_TABLES, selectBuildTables } from './lib/game-ref-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = resolve(ROOT, '..', 'NeoArtifacts', 'MasterData', 'json');
const ICONS = resolve(ROOT, '..', 'NeoArtifacts', 'Assets', 'ItemIcons');
const OUT = join(ROOT, 'scripts', 'fixtures', 'masterdata');

const sources = {};
const load = (name) => {
  const buffer = readFileSync(join(MASTER, name));
  sources[name] = createHash('sha256').update(buffer).digest('hex');
  return JSON.parse(buffer.toString('utf8'));
};

// Same selection as scripts/import-game-references.mjs (selectBuildTables), so the fixtures are what the importer reads.
const full = Object.fromEntries(Object.entries(FULL_TABLES).map(([key, name]) => [key, load(name)]));
const tables = selectBuildTables(full, (id) => existsSync(join(ICONS, `itemicon_${id}.png`)));

mkdirSync(OUT, { recursive: true });
const files = Object.fromEntries(BUILD_TABLES.map((name) => [`${name}.json`, tables[name]]));
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, name), `${JSON.stringify(data, null, 1)}\n`);
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify({
  exportedAt: new Date().toISOString(),
  source: 'NeoArtifacts/MasterData/json (+ Assets/ItemIcons for weaponIconsPresent)',
  sourceSha256: sources,
  counts: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])),
}, null, 1)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]))));
