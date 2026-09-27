import assert from 'node:assert/strict';
import test from 'node:test';

import { buildValidationContext, shapeBuildEditor } from './build-editor.mjs';

const ref = (kind, code, data, sourcePresent = true) => ({ kind, code, data, sourcePresent });
const txt = (kind, code, nameCn, nameVi = null, detailCn = '') => ({ kind, code, nameCn, nameVi, detailCn, detailVi: null });
const refs = [
  ref('weapon', '30111', { job: 1, rare: 3, skillIds: ['ED2031'], icon: 'itemicon_30111' }),
  ref('weapon', '30150', { job: 1, rare: 5, skillIds: [], icon: null }),
  ref('weapon', '30211', { job: 2, rare: 5, skillIds: [], icon: null }),
  ref('weapon', '30999', { job: 1, rare: 2, skillIds: [], icon: null }, false),
  ref('weapon_affix', 'AA001001', { percent: false, jobs: [1, 2] }),
  ref('weapon_affix', 'AA009001', { percent: true, jobs: [3] }),
  ref('job_style', '102', { sectorIds: ['D2_01'] }),
  ref('style_sector', 'D2_01', { talentIds: [['D20101'], ['D20102', 'D20103']] }),
];
const texts = [
  txt('weapon', '30111', '路边物件盾', 'Khiên'), txt('weapon', '30150', '盾'), txt('weapon_skill', 'ED2031', '路障庇护', null, '提高10%'),
  txt('weapon_affix', 'AA001001', '生命值'), txt('job_style', '102', '固防'), txt('style_sector', 'D2_01', '重峦'),
  txt('style_talent', 'D20101', '护盾+15%'), txt('style_talent', 'D20102', 'a'), txt('style_talent', 'D20103', 'b'),
];
const characterStyle = { job: 1, styleIds: ['101', '102', '103'], recommendedStyleId: '102' };

test('editor payload: builds in position order; weapons and affixes of the character\'s job only (present ones), rarest first', () => {
  const out = shapeBuildEditor({
    characterId: 'D0017', characterStyle, refs, texts,
    builds: [{ entityId: 'b2', position: 1, revision: 3, doc: { name: 'Boss', deepen: { styleId: '102', points: [7, 4, 0, 0] } } }, { entityId: 'b1', position: 0, revision: 1, doc: { name: 'Chuẩn' } }],
  });
  assert.deepEqual(out.character, { id: 'D0017', job: 1, styleIds: ['101', '102', '103'], recommendedStyleId: '102' });
  assert.deepEqual(out.builds.map((b) => [b.id, b.revision, b.doc.name]), [['b1', 1, 'Chuẩn'], ['b2', 3, 'Boss']]);
  assert.deepEqual(out.builds[1].doc.deepens, [{ label: '', styleId: '102', points: [7, 4, 0, 0] }]); // saved before multi-深造
  assert.deepEqual(out.catalogue.weapons.map((w) => w.id), ['30150', '30111']);
  assert.deepEqual(out.catalogue.weapons[1], { id: '30111', rare: 3, icon: 'itemicon_30111', name: { cn: '路边物件盾', vi: 'Khiên' }, skills: [{ id: 'ED2031', name: { cn: '路障庇护', vi: null }, detail: { cn: '提高10%', vi: null } }] });
  assert.deepEqual(out.catalogue.affixes, [{ id: 'AA001001', percent: false, name: { cn: '生命值', vi: null } }]);
});

test('editor payload: the character\'s 3 styles with their columns and talents per point (a style without data keeps its id)', () => {
  const { styles } = shapeBuildEditor({ characterId: 'D0017', characterStyle, refs, texts, builds: [] }).catalogue;
  assert.deepEqual(styles.map((s) => s.id), ['101', '102', '103']);
  assert.deepEqual(styles[0], { id: '101', name: { cn: '101', vi: null }, sectors: [] });
  assert.deepEqual(styles[1].sectors[0].talents[1], [{ id: 'D20102', text: { cn: 'a', vi: null } }, { id: 'D20103', text: { cn: 'b', vi: null } }]);
});

test('no character_style row (e.g. a character not in MasterData) → no styles, job from the character row', () => {
  const out = shapeBuildEditor({ characterId: 'X1', characterStyle: null, job: 2, refs, texts, builds: [] });
  assert.deepEqual(out.character, { id: 'X1', job: 2, styleIds: [], recommendedStyleId: null });
  assert.deepEqual(out.catalogue.weapons.map((w) => w.id), ['30211']);
});

test('validation context: present weapons/affixes, the character\'s styles and skills, existing characters', () => {
  const ctx = buildValidationContext({ characterId: 'D0017', characterStyle, refs, skillIds: ['D001701'], characterIds: ['D0017', 'A0001'] });
  assert.deepEqual(ctx.character, { id: 'D0017', job: 1, styleIds: ['101', '102', '103'], skillIds: ['D001701'] });
  assert.deepEqual([...ctx.weapons.keys()], ['30111', '30150', '30211']);
  assert.deepEqual(ctx.affixes.get('AA009001'), { jobs: [3] });
  assert.ok(ctx.characterIds.has('A0001'));
});
