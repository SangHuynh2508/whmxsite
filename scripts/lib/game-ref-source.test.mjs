import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BUILD_TABLES, GAME_TEXT_KINDS, normalizeGameReferences, selectBuildTables } from './game-ref-source.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/masterdata/${name}.json`, import.meta.url), 'utf8'));
const raw = () => Object.fromEntries(BUILD_TABLES.map((name) => [name, fixture(name)]));
const byKind = (rows, kind) => rows.filter((r) => r.kind === kind);
const ref = (out, kind, code) => out.refs.find((r) => r.kind === kind && r.code === code);
const text = (out, key) => { const [kind, code] = key.split(':'); return out.texts.find((t) => t.kind === kind && t.code === code); };

test('fixtures: one ref per weapon / affix / style / column / character, one text per translatable name', () => {
  const out = normalizeGameReferences(raw());
  const count = (rows) => Object.fromEntries(['weapon', 'weapon_affix', 'job_style', 'style_sector', 'character_style', ...GAME_TEXT_KINDS].map((k) => [k, byKind(rows, k).length]).filter(([, n]) => n));
  assert.deepEqual(count(out.refs), { weapon: 110, weapon_affix: 24, job_style: 15, style_sector: 60, character_style: 143 });
  assert.deepEqual(count(out.texts), { weapon: 110, weapon_skill: 114, weapon_affix: 24, job_style: 15, style_sector: 60, style_talent: 428 });
  assert.deepEqual(out.problems, []);
  // 22 weapons per job
  const perJob = {};
  for (const w of byKind(out.refs, 'weapon')) perJob[w.data.job] = (perJob[w.data.job] ?? 0) + 1;
  assert.deepEqual(perJob, { 1: 22, 2: 22, 3: 22, 4: 22, 5: 22 });
});

test('weapon: job, rarity, skills and icon key; its name is a game text; its skill text is resolved', () => {
  const out = normalizeGameReferences(raw());
  assert.deepEqual(ref(out, 'weapon', '30111').data, { job: 1, rare: 3, series: 10, skillIds: ['ED2031'], icon: 'itemicon_30111' });
  assert.deepEqual(text(out, 'weapon:30111'), { kind: 'weapon', code: '30111', nameCn: '路边物件盾', detailCn: '', sourceHash: text(out, 'weapon:30111').sourceHash });
  const skill = text(out, 'weapon_skill:ED2031');
  assert.equal(skill.nameCn, '路障庇护');
  assert.equal(skill.detailCn, '装备者常击造成的伤害提高10%/11%/12%/13%/14%/15%。');
});

test('weapon without an icon file → icon null; equipment that is not an itemMap type-9 row is skipped', () => {
  const tables = raw();
  const noIcon = tables.equipments.find((w) => !tables.weaponIconsPresent.includes(String(w.id)));
  assert.equal(ref(normalizeGameReferences(tables), 'weapon', String(noIcon.id)).data.icon, null);
  tables.weaponItems = tables.weaponItems.filter((i) => i.id !== '30111');
  const out = normalizeGameReferences(tables);
  assert.equal(ref(out, 'weapon', '30111'), undefined);
  assert.equal(text(out, 'weapon:30111'), undefined);
  assert.deepEqual(out.skipped, ['equipments:30111 (no itemMap type 9 row)']);
});

test('深造: a style has a job (from the characters that list it), 4 columns; a column has 7 points of talents', () => {
  const out = normalizeGameReferences(raw());
  assert.deepEqual(ref(out, 'job_style', '101').data, { job: 1, styleTalent: ['DB_1001'], sectorIds: ['D1_01', 'D1_02', 'D1_03', 'D1_04'], icon: 'Speciality_101' });
  assert.equal(text(out, 'job_style:101').nameCn, '迅疾');
  const column = ref(out, 'style_sector', 'A1_01').data;
  assert.equal(column.talentIds.length, 7);
  assert.deepEqual(column.talentIds[0], ['A10101']);
  assert.equal(text(out, 'style_sector:A1_01').nameCn, '重峦');
  assert.equal(text(out, 'style_talent:A10101').nameCn, '瞄准伤害+10%');
});

test('character style: its 3 styles + the game recommendation, matched through styleTalent (D0017 → 102 固防)', () => {
  const out = normalizeGameReferences(raw());
  assert.deepEqual(ref(out, 'character_style', 'D0017').data, { job: 1, styleIds: ['101', '102', '103'], recommendedStyleId: '102' });
  assert.equal(text(out, 'job_style:102').nameCn, '固防');
  // no TalentRecommend → no recommendation
  assert.equal(ref(out, 'character_style', 'ES013').data.recommendedStyleId, null);
});

test('a recommendation that points at another character\'s style is not used, and is reported', () => {
  const tables = raw();
  const row = tables.characterStyles.find((c) => c.id === 'D0017');
  row.TalentRecommend = [[tables.jobStyleMap.find((s) => s.id === 301).styleTalent[0]]];
  const out = normalizeGameReferences(tables);
  assert.equal(ref(out, 'character_style', 'D0017').data.recommendedStyleId, null);
  assert.deepEqual(out.problems, ['characterTable:D0017 recommends style 301, not one of its own']);
});

test('affix: attribute, % display, allowed jobs and values per rarity', () => {
  const out = normalizeGameReferences(raw());
  const affix = ref(out, 'weapon_affix', 'AA001001').data;
  assert.deepEqual({ ...affix, rareValues: undefined }, { addAttr: 'Hp_FIX', percent: false, jobs: [1, 2, 3, 4, 5], rareValues: undefined });
  assert.deepEqual(affix.rareValues['5'], { initValue: 189, growValue: 320 });
  assert.equal(text(out, 'weapon_affix:AA001001').nameCn, '生命值');
});

test('sourceHash does not depend on key order, and changes with the content', () => {
  const a = normalizeGameReferences(raw());
  const tables = raw();
  tables.equipments = tables.equipments.map((w) => Object.fromEntries(Object.entries(w).reverse()));
  const b = normalizeGameReferences(tables);
  assert.equal(ref(a, 'weapon', '30111').sourceHash, ref(b, 'weapon', '30111').sourceHash);
  tables.equipments.find((w) => w.id === '30111').rare = 4;
  assert.notEqual(ref(normalizeGameReferences(tables), 'weapon', '30111').sourceHash, ref(a, 'weapon', '30111').sourceHash);
});

test('selectBuildTables: full MasterData tables → the trimmed tables the normaliser reads', () => {
  const full = {
    equipments: [{ id: '1', job: 1, rare: 2, Series: 0, equipSkill: ['S1'], NameLanText: 'w' }],
    equipmentSkills: { a: { GroupId: 'S1', Level: 1 }, b: { GroupId: 'S9', Level: 1 } },
    additionalAttrs: [{ id: 'AA' }],
    jobStyleMap: [{ id: 101, styleTalent: ['T0'], sector: ['X'] }],
    sectorMap: [{ id: 'X', sectorTalent: [['T1']] }],
    talentBankMap: [{ id: 'T0' }, { id: 'T1' }, { id: 'T9' }],
    characterTable: [{ id: 'C1', job: 1, JobStyle: ['101'], TalentRecommend: [['T0']] }, { id: 'N1' }],
    itemMap: { 1: { id: 1, type: 9, rare: 2, nameLanText: 'w', DescriptionLanText: 'd' }, 2: { id: 2, type: 1 } },
    equipmentFiles: [{ id: '1' }, { id: '9' }],
  };
  const out = selectBuildTables(full, (id) => id === '1');
  assert.deepEqual(out.equipmentSkills.map((s) => s.GroupId), ['S1']);
  assert.deepEqual(out.talentBankMap.map((t) => t.id), ['T0', 'T1']);
  assert.deepEqual(out.characterStyles, [{ id: 'C1', job: 1, JobStyle: ['101'], TalentRecommend: [['T0']] }]);
  assert.deepEqual(out.weaponItems, [{ id: '1', type: 9, rare: 2, nameLanText: 'w', DescriptionLanText: 'd' }]);
  assert.deepEqual(out.equipmentFiles, [{ id: '1' }]);
  assert.deepEqual(out.weaponIconsPresent, ['1']);
});
