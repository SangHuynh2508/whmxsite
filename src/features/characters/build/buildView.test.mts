import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildViews } from './buildView.mts';

const game = {
  version: 1 as const,
  refs: {
    weapon: { 30111: { job: 1, rare: 3, skillIds: ['ED2031'], icon: 'itemicon_30111' } },
    weapon_affix: { AA001001: { percent: false, jobs: [1] } },
    job_style: { 102: { sectorIds: ['D2_01'] } },
    style_sector: { D2_01: { talentIds: [['D20101'], ['D20102', 'D20103']] } },
  },
  texts: {
    weapon: { 30111: { cn: '路边物件盾', vi: 'Khiên Ven Đường', detail: '', detail_vi: null } },
    weapon_skill: { ED2031: { cn: '路障庇护', vi: null, detail: '提高10%', detail_vi: null } },
    weapon_affix: { AA001001: { cn: '生命值', vi: 'Máu', detail: '', detail_vi: null } },
    job_style: { 102: { cn: '固防', vi: 'Cố Phòng', detail: '', detail_vi: null } },
    style_sector: { D2_01: { cn: '重峦', vi: null, detail: '', detail_vi: null } },
    style_talent: { D20101: { cn: '护盾+15%', vi: 'Khiên +15%', detail: '', detail_vi: null } },
  },
  builds: {},
};
const characters = {
  D0017: { id: 'D0017', slug: 'D0017', name_vi: 'Bát', icon: 'assets/characters/avatars/D0017.png', skills: [{ group_id: 'D001701', levels: [{ name_vi: 'Bát Dứu', icon: 'assets/skills/a.png' }] }] },
  A0001: { id: 'A0001', slug: 'A0001', name_cn: '山水', icon: 'assets/characters/avatars/A0001.png', skills: [] },
};
const doc = {
  name: 'Chuẩn', rating: 'S', summary: 'Tốt',
  weapons: [{ weaponId: '30111', label: 'Chịu đòn' }, { weaponId: '99999', label: '' }],
  affixes: { noReroll: true, groups: [{ label: 'Ưu tiên', affixIds: ['AA001001'] }] },
  deepen: { styleId: '102', points: [2, 0, 0, 0] },
  rotations: [{ label: '0 dupe', skillIds: ['D001701', 'X'] }],
  tips: ['Mở khiên'], teams: [{ label: 'Chính', characterIds: ['A0001'], note: '' }], teamOther: '',
};

test('names: VI when published, else CN marked untranslated; unknown ids are left out', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.weapons, [{
    id: '30111', label: 'Chịu đòn', rare: 3, name: { text: 'Khiên Ven Đường', untranslated: false },
    skills: [{ name: { text: '路障庇护', untranslated: true }, text: { text: '提高10%', untranslated: true } }],
  }]);
  assert.deepEqual(v.affixes.groups[0].items, [{ text: 'Máu', untranslated: false }]);
  assert.equal(v.affixes.noReroll, true);
});

test('深造: style, each column with its points and the talents reached so far', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.deepen?.style, { text: 'Cố Phòng', untranslated: false });
  assert.equal(v.deepen?.total, 2);
  const column = v.deepen!.columns[0];
  assert.equal(column.points, 2);
  assert.deepEqual(column.talents.map((t) => [t.point, t.reached, t.text.text]), [[1, true, 'Khiên +15%'], [2, true, 'D20102 / D20103']]);
});

test('rotations use the character\'s own skills (name + icon); teams link to existing characters', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.rotations, [{ label: '0 dupe', skills: [{ id: 'D001701', name: 'Bát Dứu', icon: '/assets/skills/a.png' }] }]);
  assert.deepEqual(v.teams, [{ label: 'Chính', note: '', members: [{ id: 'A0001', name: '山水', icon: '/assets/characters/avatars/A0001.png', href: '#/characters/A0001' }] }]);
});

test('no builds → empty list (the tab keeps its empty state)', () => {
  assert.deepEqual(buildViews([], game, characters, 'D0017'), []);
});
