// Copies the MasterData tables the Build feature needs (spec docs/superpowers/specs/2026-09-26-character-build-design.md §3)
// from the local NeoArtifacts checkout into scripts/fixtures/masterdata/, trimmed to the referenced rows, so work that has no
// NeoArtifacts (e.g. a cloud session) can write and test the importer/normaliser against real data.
// Run locally after a game update: node scripts/export-masterdata-fixtures.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const rows = (json) => (Array.isArray(json) ? json : Object.values(json));

const equipments = rows(load('equipments.json'));
const weaponIds = new Set(equipments.map((w) => String(w.id)));
const skillGroups = new Set(equipments.flatMap((w) => w.equipSkill ?? []));
// equipmentSkills.json: { "<n>": { GroupId, Level, … } } rows — keep every level of the referenced groups
const equipmentSkills = rows(load('equipmentSkills.json')).flatMap((r) => (r && r.GroupId ? [r] : Object.values(r ?? {}))).filter((r) => skillGroups.has(r?.GroupId));
const additionalAttrs = rows(load('additionalAttrs.json'));
const jobStyleMap = rows(load('jobStyleMap.json'));
const sectorMap = rows(load('sectorMap.json'));
const talentIds = new Set([
  ...jobStyleMap.flatMap((s) => s.styleTalent ?? []),
  ...sectorMap.flatMap((s) => (s.sectorTalent ?? []).flat()),
]);
const talentBankMap = rows(load('talentBankMap.json')).filter((t) => talentIds.has(t.id));
const characterStyles = rows(load('characterTable.json'))
  .filter((c) => c.JobStyle)
  .map((c) => ({ id: c.id, job: c.job ?? c.Job ?? null, JobStyle: c.JobStyle, TalentRecommend: c.TalentRecommend ?? null }));
const weaponItems = rows(load('itemMap.json'))
  .filter((i) => i.type === 9)
  .map((i) => ({ id: String(i.id), type: i.type, rare: i.rare, nameLanText: i.nameLanText, DescriptionLanText: i.DescriptionLanText }));
const equipmentFiles = rows(load('equipmentFiles.json')).filter((f) => weaponIds.has(String(f.id)));
const weaponIconsPresent = [...weaponIds].filter((id) => existsSync(join(ICONS, `itemicon_${id}.png`))).sort();

mkdirSync(OUT, { recursive: true });
const files = {
  'equipments.json': equipments,
  'equipmentSkills.json': equipmentSkills,
  'equipmentFiles.json': equipmentFiles,
  'additionalAttrs.json': additionalAttrs,
  'jobStyleMap.json': jobStyleMap,
  'sectorMap.json': sectorMap,
  'talentBankMap.json': talentBankMap,
  'characterStyles.json': characterStyles,
  'weaponItems.json': weaponItems,
  'weaponIconsPresent.json': weaponIconsPresent,
};
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, name), `${JSON.stringify(data, null, 1)}\n`);
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify({
  exportedAt: new Date().toISOString(),
  source: 'NeoArtifacts/MasterData/json (+ Assets/ItemIcons for weaponIconsPresent)',
  sourceSha256: sources,
  counts: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])),
}, null, 1)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]))));
