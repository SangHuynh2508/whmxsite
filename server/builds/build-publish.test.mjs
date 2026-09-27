import assert from 'node:assert/strict';
import test from 'node:test';

import { shapePublishedBuilds } from './build-publish.mjs';

const refs = new Map([
  ['weapon|30111', { job: 1, rare: 3, series: 10, skillIds: ['ED2031'], icon: 'itemicon_30111' }],
  ['weapon|30112', { job: 1, rare: 4, series: 10, skillIds: ['ED2032'], icon: null }],
  ['weapon_affix|AA001001', { addAttr: 'Hp_FIX', percent: false, jobs: [1], rareValues: {} }],
  ['job_style|102', { job: 1, styleTalent: ['DK_1002'], sectorIds: ['D2_01'], icon: 'Speciality_102' }],
  ['style_sector|D2_01', { talentIds: [['D20101'], ['D20102', 'D20103']], icon: 'Core_D2_01' }],
]);
const t = (code, nameCn, extra = {}) => [code, { code, nameCn, detailCn: '', nameVi: null, detailVi: null, viOrigin: null, state: 'ok', ...extra }];
const terms = new Map([
  t('weapon:30111', '路边物件盾', { nameVi: 'Khiên Vật Ven Đường', viOrigin: 'admin' }),
  t('weapon_skill:ED2031', '路障庇护', { detailCn: '提高10%/15%' }),
  t('weapon_affix:AA001001', '生命值', { nameVi: 'Máu', viOrigin: 'legacy_workbook' }),
  t('job_style:102', '固防'),
  t('style_sector:D2_01', '重峦'),
  t('style_talent:D20101', '护盾+15%'), t('style_talent:D20102', 'a'), t('style_talent:D20103', 'b'),
]);
const doc = {
  name: 'Chuẩn', rating: 'S', summary: '', weapons: [{ weaponId: '30111', label: 'Chịu đòn' }],
  affixes: { noReroll: true, groups: [{ label: '', affixIds: ['AA001001'] }] },
  deepen: { styleId: '102', points: [7, 4, 0, 0] }, rotations: [], tips: [], teams: [], teamOther: '',
};

test('no build → null (the lore document stays as it is)', () => {
  assert.equal(shapePublishedBuilds({ builds: [], refs, terms }), null);
});

test('builds grouped per character in position order; refs hold only what the builds use, CN + published VI', () => {
  const out = shapePublishedBuilds({
    builds: [{ characterId: 'D0017', position: 1, doc: { ...doc, name: 'Boss' } }, { characterId: 'D0017', position: 0, doc }],
    refs, terms,
  });
  assert.deepEqual(out.builds.D0017.map((b) => b.name), ['Chuẩn', 'Boss']);
  assert.deepEqual(Object.keys(out.refs.weapons), ['30111']); // 30112 is not used by any build
  assert.deepEqual(out.refs.weapons['30111'], { name: { cn: '路边物件盾', vi: 'Khiên Vật Ven Đường', detail: '', detail_vi: null }, rare: 3, job: 1, icon: 'itemicon_30111', skillIds: ['ED2031'] });
  assert.deepEqual(out.refs.weaponSkills.ED2031, { name: { cn: '路障庇护', vi: null, detail: '提高10%/15%', detail_vi: null } });
  // a legacy (not admin) VI is withheld, like every lore term
  assert.deepEqual(out.refs.affixes.AA001001, { name: { cn: '生命值', vi: null, detail: '', detail_vi: null }, percent: false });
  assert.deepEqual(out.refs.styles['102'], { name: { cn: '固防', vi: null, detail: '', detail_vi: null }, icon: 'Speciality_102', sectorIds: ['D2_01'] });
  assert.deepEqual(out.refs.sectors.D2_01.talentIds, [['D20101'], ['D20102', 'D20103']]);
  assert.deepEqual(Object.keys(out.refs.talents).sort(), ['D20101', 'D20102', 'D20103']);
  assert.equal(out.refs.talents.D20101.cn, '护盾+15%');
});

test('a reference missing from the DB is left out instead of failing the publish', () => {
  const out = shapePublishedBuilds({ builds: [{ characterId: 'D0017', position: 0, doc: { ...doc, weapons: [{ weaponId: '99999', label: '' }] } }], refs, terms });
  assert.deepEqual(out.refs.weapons, {});
  assert.equal(out.builds.D0017[0].weapons[0].weaponId, '99999');
});
