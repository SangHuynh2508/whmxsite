// scripts/lib/game-ref-source.mjs
// Pure: MasterData → game reference rows (structure) + translatable terms, for the Build feature
// (spec docs/superpowers/specs/2026-09-26-character-build-design.md §3–§4). No I/O, no DB.
// Relations come from the data (itemMap type 9, styleTalent, JobStyle lists), never from the shape of an id.
import { hashValue } from './profile-source.mjs';
import { resolveSkillText } from './weapon-skill-text.mjs';

// The tables the normaliser reads = the files in scripts/fixtures/masterdata/ (without .json).
export const BUILD_TABLES = [
  'equipments', 'equipmentSkills', 'equipmentFiles', 'additionalAttrs', 'jobStyleMap', 'sectorMap',
  'talentBankMap', 'characterStyles', 'weaponItems', 'weaponIconsPresent',
];
// Full MasterData files (NeoArtifacts/MasterData/json) that selectBuildTables reads.
export const FULL_TABLES = {
  equipments: 'equipments.json', equipmentSkills: 'equipmentSkills.json', equipmentFiles: 'equipmentFiles.json',
  additionalAttrs: 'additionalAttrs.json', jobStyleMap: 'jobStyleMap.json', sectorMap: 'sectorMap.json',
  talentBankMap: 'talentBankMap.json', characterTable: 'characterTable.json', itemMap: 'itemMap.json',
};
// lore_terms kinds owned by the game-reference importer (the profile importer owns the others).
export const GAME_REF_TERM_KINDS = ['weapon', 'weapon_skill', 'weapon_affix', 'job_style', 'style_sector', 'style_talent'];

const rows = (json) => (Array.isArray(json) ? json : Object.values(json ?? {}));
const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

// Full MasterData tables (+ an icon check) → the trimmed tables above. Shared by the importer and
// scripts/export-masterdata-fixtures.mjs, so the fixtures are exactly what the importer normalises.
export function selectBuildTables(full, iconExists) {
  const equipments = rows(full.equipments);
  const weaponIds = new Set(equipments.map((w) => String(w.id)));
  const skillGroups = new Set(equipments.flatMap((w) => w.equipSkill ?? []));
  // equipmentSkills.json: { "<n>": { GroupId, Level, … } } rows — keep every level of the referenced groups
  const equipmentSkills = rows(full.equipmentSkills).flatMap((r) => (r && r.GroupId ? [r] : Object.values(r ?? {}))).filter((r) => skillGroups.has(r?.GroupId));
  const jobStyleMap = rows(full.jobStyleMap);
  const sectorMap = rows(full.sectorMap);
  const talentIds = new Set([...jobStyleMap.flatMap((s) => s.styleTalent ?? []), ...sectorMap.flatMap((s) => (s.sectorTalent ?? []).flat())]);
  return {
    equipments,
    equipmentSkills,
    equipmentFiles: rows(full.equipmentFiles).filter((f) => weaponIds.has(String(f.id))),
    additionalAttrs: rows(full.additionalAttrs),
    jobStyleMap,
    sectorMap,
    talentBankMap: rows(full.talentBankMap).filter((t) => talentIds.has(t.id)),
    characterStyles: rows(full.characterTable).filter((c) => c.JobStyle)
      .map((c) => ({ id: c.id, job: c.job ?? c.Job ?? null, JobStyle: c.JobStyle, TalentRecommend: c.TalentRecommend ?? null })),
    weaponItems: rows(full.itemMap).filter((i) => i.type === 9)
      .map((i) => ({ id: String(i.id), type: i.type, rare: i.rare, nameLanText: i.nameLanText, DescriptionLanText: i.DescriptionLanText })),
    weaponIconsPresent: [...weaponIds].filter((id) => iconExists(id)).sort(),
  };
}

export function normalizeGameReferences(tables) {
  const refs = [];
  const terms = [];
  const skipped = [];
  const problems = [];
  const addRef = (kind, code, data) => refs.push({ kind, code: String(code), data, sourceHash: hashValue(data) });
  const addTerm = (kind, code, nameCn, detailCn = '') => {
    const row = { nameCn: text(nameCn), detailCn: text(detailCn) };
    terms.push({ code: `${kind}:${code}`, kind, ...row, sourceHash: hashValue(row) });
  };

  // Weapons: equipments rows that are itemMap type-9 rows (all weapons are; anything else is not a weapon).
  const weaponItemIds = new Set(rows(tables.weaponItems).filter((i) => i.type === 9).map((i) => String(i.id)));
  const icons = new Set(rows(tables.weaponIconsPresent).map(String));
  const skillLevels = new Map();
  for (const level of rows(tables.equipmentSkills)) {
    if (!skillLevels.has(level.GroupId)) skillLevels.set(level.GroupId, []);
    skillLevels.get(level.GroupId).push(level);
  }
  const skillIds = new Set();
  for (const weapon of rows(tables.equipments)) {
    const id = String(weapon.id);
    if (!weaponItemIds.has(id)) { skipped.push(`equipments:${id} (no itemMap type 9 row)`); continue; }
    const ids = (weapon.equipSkill ?? []).map(String);
    for (const skillId of ids) {
      if (skillLevels.has(skillId)) skillIds.add(skillId);
      else problems.push(`equipments:${id} skill ${skillId} not in equipmentSkills`);
    }
    addRef('weapon', id, { job: weapon.job, rare: weapon.rare, series: weapon.Series ?? null, skillIds: ids, icon: icons.has(id) ? `itemicon_${id}` : null });
    addTerm('weapon', id, weapon.NameLanText);
  }
  for (const skillId of [...skillIds].sort()) {
    const levels = skillLevels.get(skillId).slice().sort((a, b) => a.Level - b.Level);
    addTerm('weapon_skill', skillId, levels[0].NameLanText, resolveSkillText(levels));
  }

  for (const affix of rows(tables.additionalAttrs)) {
    addRef('weapon_affix', affix.id, { addAttr: affix.addAttr, percent: affix.attrDisplayType === '%', jobs: affix.job ?? [], rareValues: affix.rareAttrs ?? {} });
    addTerm('weapon_affix', affix.id, affix.NameLanText);
  }

  // 深造: a style's job = the job of the characters that list it in JobStyle.
  const characters = rows(tables.characterStyles);
  const styleJobs = new Map();
  for (const c of characters) for (const styleId of c.JobStyle.map(String)) {
    if (!styleJobs.has(styleId)) styleJobs.set(styleId, new Set());
    styleJobs.get(styleId).add(c.job);
  }
  const styles = new Map(rows(tables.jobStyleMap).map((s) => [String(s.id), s]));
  const sectors = new Map(rows(tables.sectorMap).map((s) => [String(s.id), s]));
  const talents = new Map(rows(tables.talentBankMap).map((t) => [String(t.id), t]));
  for (const [id, style] of styles) {
    const jobs = [...(styleJobs.get(id) ?? [])];
    if (jobs.length !== 1) problems.push(`jobStyleMap:${id} is listed by characters of ${jobs.length} jobs`);
    for (const sectorId of style.sector ?? []) if (!sectors.has(String(sectorId))) problems.push(`jobStyleMap:${id} column ${sectorId} not in sectorMap`);
    addRef('job_style', id, { job: jobs.length === 1 ? jobs[0] : null, styleTalent: style.styleTalent ?? [], sectorIds: (style.sector ?? []).map(String), icon: style.styleIcon ?? null });
    addTerm('job_style', id, style.styleNameLanText || style.styleName);
  }
  const usedTalents = new Set();
  for (const [id, sector] of sectors) {
    const talentIds = (sector.sectorTalent ?? []).map((point) => point.map(String));
    for (const talentId of talentIds.flat()) {
      if (talents.has(talentId)) usedTalents.add(talentId);
      else problems.push(`sectorMap:${id} talent ${talentId} not in talentBankMap`);
    }
    addRef('style_sector', id, { talentIds, icon: sector.sectorIcon ?? null });
    addTerm('style_sector', id, sector.branchNameLanText || sector.branchName);
  }
  for (const id of [...usedTalents].sort()) addTerm('style_talent', id, talents.get(id).DescriptionLanText);

  // The game's recommendation: TalentRecommend[0][0] is a styleTalent; only one of the character's own styles counts.
  for (const c of characters) {
    const styleIds = c.JobStyle.map(String);
    const wanted = Array.isArray(c.TalentRecommend) ? c.TalentRecommend[0]?.[0] : undefined;
    let recommendedStyleId = null;
    if (wanted) {
      const match = [...styles].find(([, s]) => (s.styleTalent ?? []).includes(wanted))?.[0];
      if (match && styleIds.includes(match)) recommendedStyleId = match;
      else problems.push(`characterTable:${c.id} recommends ${match ? `style ${match}, not one of its own` : `${wanted}, which is no style`}`);
    }
    addRef('character_style', c.id, { job: c.job, styleIds, recommendedStyleId });
  }

  const order = (a, b) => (a.kind === b.kind ? a.code.localeCompare(b.code) : a.kind.localeCompare(b.kind));
  return { refs: refs.sort(order), terms: terms.sort(order), skipped, problems };
}
