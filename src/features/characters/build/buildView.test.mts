import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildViews, variantOf } from './buildView.mts';

const game = {
  version: 1 as const,
  refs: {
    weapon: { 30111: { job: 1, rare: 3, skillIds: ['ED2031'], icon: 'itemicon_30111' } },
    weapon_affix: { AA001001: { percent: false, jobs: [1] }, AA001002: { percent: true, jobs: [1] } },
    job_style: { 102: { sectorIds: ['D2_01'], icon: 'Speciality_102' } },
    style_sector: { D2_01: { talentIds: [['D20101'], ['D20102', 'D20103']] } },
  },
  texts: {
    weapon: { 30111: { cn: '路边物件盾', vi: 'Khiên Ven Đường', detail: '', detail_vi: null } },
    weapon_skill: { ED2031: { cn: '路障庇护', vi: null, detail: '提高10%', detail_vi: null } },
    weapon_affix: { AA001001: { cn: '生命值', vi: 'Máu', detail: '', detail_vi: null }, AA001002: { cn: '生命值', vi: null, detail: '', detail_vi: null } },
    job_style: { 102: { cn: '固防', vi: 'Cố Phòng', detail: '', detail_vi: null } },
    style_sector: { D2_01: { cn: '重峦', vi: null, detail: '', detail_vi: null } },
    style_talent: { D20101: { cn: '护盾+15%', vi: 'Khiên +15%', detail: '', detail_vi: null } },
  },
  builds: {},
};
const characters = {
  D0017: { id: 'D0017', slug: 'D0017', name_vi: 'Bát', icon: 'assets/characters/avatars/D0017.png', skills: [
    { group_id: 'D001701', slot: 'skill1', levels: [{ name_vi: 'Bát Dứu', icon: 'assets/skills/a.png', type: 'Đánh Thường' }] },
    { group_id: 'D001702', slot: 'skill6', levels: [{ name_vi: 'Hộ', icon: '', type: 'Kỹ Năng Nghề' }] },
  ] },
  A0001: { id: 'A0001', slug: 'A0001', name_cn: '山水', icon: 'assets/characters/avatars/A0001.png', skills: [] },
};
const doc = {
  name: 'Chuẩn', rating: 'S', summary: 'Tốt',
  weapons: [{ weaponId: '30111', label: 'Chịu đòn' }, { weaponId: '99999', label: '' }],
  affixes: { noReroll: true, groups: [{ label: 'Ưu tiên', affixIds: ['AA001001', 'AA001002'] }] },
  deepens: [{ label: 'Chuẩn', styleId: '102', points: [2, 0, 0, 0] }, { label: 'Lục Trí', styleId: '102', points: [0, 7, 0, 0] }],
  rotations: [{ label: '0 dupe', skillIds: ['D001701', 'X'] }],
  tips: ['Mở khiên', ''], teams: [{ label: 'Chính', characterIds: ['A0001'], note: '' }], teamOther: '',
};

test('names: VI when published, else CN marked untranslated; unknown ids are left out', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.weapons, [{
    id: '30111', label: 'Chịu đòn', rare: 3, frame: '/assets/frames/itemRare3.png', variant: '', labelRest: 'Chịu đòn', icon: '/assets/items/itemicon_30111.png', name: { text: 'Khiên Ven Đường', untranslated: false },
    skills: [{ name: { text: '路障庇护', untranslated: true }, text: { text: '提高10%', untranslated: true } }],
  }]);
  // HP and HP% share the name 生命值: the % must show, like the admin picker
  assert.deepEqual(v.affixes.groups[0].items, [{ text: 'Máu', untranslated: false }, { text: '生命值 %', untranslated: true }]);
  assert.equal(v.affixes.noReroll, true);
});

test('深造: every suggestion (up to 3) with its label, style, columns, points and the talents reached so far', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.deepens.map((d) => [d.label, d.style.text, d.total]), [['Chuẩn', 'Cố Phòng', 2], ['Lục Trí', 'Cố Phòng', 7]]);
  const column = v.deepens[0].columns[0];
  assert.equal(column.points, 2);
  assert.deepEqual(column.talents.map((t) => [t.point, t.reached, t.text.text]), [[1, true, 'Khiên +15%'], [2, true, 'D20102 / D20103']]);
});

test('深造: a game document published before 2026-09-27 (one `deepen`) still shows it', () => {
  const { deepens, ...rest } = doc;
  const [v] = buildViews([{ ...rest, deepen: { styleId: '102', points: [2, 0, 0, 0] } }], game, characters, 'D0017');
  assert.deepEqual(v.deepens.map((d) => [d.label, d.total]), [['', 2]]);
});

test('teams link to existing characters', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.teams, [{ label: 'Chính', note: '', members: [{ id: 'A0001', name: '山水', icon: '/assets/characters/avatars/A0001.png', href: '#/characters/A0001' }] }]);
});

test('rotations: steps with their slot tag, type, icon and notes; a rotation note is kept', () => {
  const rotations = [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [
    { skillId: 'D001702', note: 'dùng lên Thố Động' }, { skillId: 'X', note: '' }, { skillId: 'D001701', note: '' }, { skillId: 'D001702', note: '' }] }];
  const [v] = buildViews([{ ...doc, rotations }], game, characters, 'D0017');
  assert.deepEqual(v.rotations, [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [
    { id: 'D001702', name: 'Hộ', type: 'Kỹ Năng Nghề', tag: 'SKILL', icon: '', note: 'dùng lên Thố Động' },
    { id: 'D001701', name: 'Bát Dứu', type: 'Đánh Thường', tag: 'ATK', icon: '/assets/skills/a.png', note: '' },
    { id: 'D001702', name: 'Hộ', type: 'Kỹ Năng Nghề', tag: 'SKILL', icon: '', note: '' },
  ] }]);
});

test('rotations published before 2026-09-28 (`skillIds`) show as steps without notes', () => {
  const [v] = buildViews([doc], game, characters, 'D0017'); // doc.rotations = [{ label: '0 dupe', skillIds: ['D001701', 'X'] }]
  assert.deepEqual(v.rotations, [{ label: '0 dupe', note: '', steps: [{ id: 'D001701', name: 'Bát Dứu', type: 'Đánh Thường', tag: 'ATK', icon: '/assets/skills/a.png', note: '' }] }]);
});

test('深造 emblem + serial; a style without an icon gets no image; empty tips are dropped', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.deepens.map((d) => [d.icon, d.serial]), [['/assets/styles/Speciality_102.png', '2000'], ['/assets/styles/Speciality_102.png', '0700']]);
  const noIcon = { ...game, refs: { ...game.refs, job_style: { 102: { sectorIds: ['D2_01'] } } } };
  assert.equal(buildViews([doc], noIcon, characters, 'D0017')[0].deepens[0].icon, '');
  assert.deepEqual(v.tips, ['Mở khiên']);
});

test('variantOf: a weapon label names a 深造 variant exactly or as a prefix + separator; longest wins', () => {
  const v = ['Chuẩn', 'Lục Trí', 'Lục Trí 2'];
  assert.deepEqual(variantOf('Lục Trí, đơn mục tiêu', v), { variant: 'Lục Trí', rest: 'đơn mục tiêu' });
  assert.deepEqual(variantOf('Chuẩn', v), { variant: 'Chuẩn', rest: '' });
  assert.deepEqual(variantOf('Lục Trí 2 | hồi năng', v), { variant: 'Lục Trí 2', rest: 'hồi năng' });
  assert.deepEqual(variantOf('Tốc độ | Sát thương', v), { variant: '', rest: 'Tốc độ | Sát thương' });
  assert.deepEqual(variantOf('Chuẩnxác', v), { variant: '', rest: 'Chuẩnxác' }); // no separator → not a variant
  assert.deepEqual(variantOf('Lục Trí', []), { variant: '', rest: 'Lục Trí' });
  assert.deepEqual(variantOf('Chuẩn (dự phòng)', v), { variant: 'Chuẩn', rest: 'dự phòng' }); // no stray ")" (final review)
});

test('weapons carry their variant chip; 深造 are variants; empty weapon skills are dropped', () => {
  const w = { ...game.refs.weapon[30111], skillIds: ['ED2031', 'EMPTY'] };
  const g = { ...game, refs: { ...game.refs, weapon: { 30111: w } }, texts: { ...game.texts, weapon_skill: { ...game.texts.weapon_skill, EMPTY: { cn: '', vi: null, detail: '', detail_vi: null } } } };
  const [v] = buildViews([{ ...doc, weapons: [{ weaponId: '30111', label: 'Lục Trí, đơn mục tiêu' }] }], g, characters, 'D0017');
  assert.deepEqual([v.weapons[0].variant, v.weapons[0].labelRest, v.weapons[0].skills.length], ['Lục Trí', 'đơn mục tiêu', 1]);
  assert.deepEqual(v.deepens.map((d) => d.variant), ['Chuẩn', 'Lục Trí']);
});

test('weapon frame: itemRare{2..5}, itemRareK for anything else', () => {
  const odd = { ...game, refs: { ...game.refs, weapon: { 30111: { ...game.refs.weapon[30111], rare: 7 } } } };
  assert.equal(buildViews([doc], odd, characters, 'D0017')[0].weapons[0].frame, '/assets/frames/itemRareK.png');
});

test('no builds → empty list (the tab keeps its empty state)', () => {
  assert.deepEqual(buildViews([], game, characters, 'D0017'), []);
});
