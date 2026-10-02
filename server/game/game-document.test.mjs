import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGameDocument } from './game-document.mjs';

const ref = (kind, code, data, sourcePresent = true) => ({ kind, code, data, sourcePresent });
const txt = (kind, code, nameCn, extra = {}) => ({ kind, code, nameCn, detailCn: '', nameVi: null, detailVi: null, viOrigin: null, state: 'ok', sourcePresent: true, ...extra });
const refs = [
  ref('weapon', '30111', { job: 1, rare: 3, series: 10, skillIds: ['ED2031'], icon: 'itemicon_30111' }),
  ref('weapon', '30999', { job: 1, rare: 2, series: 0, skillIds: [], icon: null }, false), // gone from MasterData
  ref('weapon_affix', 'AA001001', { addAttr: 'Hp_FIX', percent: false, jobs: [1], rareValues: {} }),
  ref('job_style', '102', { job: 1, styleTalent: ['DK_1002'], sectorIds: ['D2_01'], icon: 'Speciality_102' }),
  ref('style_sector', 'D2_01', { talentIds: [['D20101']], icon: 'Core_D2_01' }),
  ref('character_style', 'D0017', { job: 1, styleIds: ['101', '102', '103'], recommendedStyleId: '102' }),
];
const texts = [
  txt('weapon', '30111', '路边物件盾', { nameVi: 'Khiên Ven Đường', viOrigin: 'admin' }),
  txt('weapon', '30999', '旧盾', { sourcePresent: false }),
  txt('weapon_skill', 'ED2031', '路障庇护', { detailCn: '提高10%/15%', detailVi: 'Tăng 10%/15%', nameVi: 'Che Chắn', viOrigin: 'admin' }),
  txt('weapon_affix', 'AA001001', '生命值', { nameVi: 'Máu', viOrigin: 'admin', state: 'source_changed' }),
  txt('job_style', '102', '固防'),
  txt('style_sector', 'D2_01', '重峦'),
  txt('style_talent', 'D20101', '护盾+15%'),
];

test('the whole catalogue, grouped by kind as in the DB; texts with the lore publish rule', () => {
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds: [] }).body);
  assert.deepEqual(Object.keys(doc), ['version', 'refs', 'texts', 'builds', 'tierLists']);
  assert.deepEqual(doc.tierLists, []);
  assert.deepEqual(doc.refs.weapon, { 30111: refs[0].data }); // the absent 30999 is left out (no build uses it)
  assert.deepEqual(doc.refs.character_style.D0017.recommendedStyleId, '102');
  assert.deepEqual(doc.texts.weapon['30111'], { cn: '路边物件盾', vi: 'Khiên Ven Đường', detail: '', detail_vi: null });
  assert.deepEqual(doc.texts.weapon_skill.ED2031, { cn: '路障庇护', vi: 'Che Chắn', detail: '提高10%/15%', detail_vi: 'Tăng 10%/15%' });
  assert.equal(doc.texts.weapon_affix.AA001001.vi, null); // source_changed → VI withheld until re-saved
  assert.equal(doc.texts.weapon['30999'], undefined);
  assert.deepEqual(doc.builds, {});
});

test('an object gone from MasterData stays published while a build still uses it', () => {
  const builds = [{ characterId: 'D0017', position: 0, doc: { weapons: [{ weaponId: '30999', label: '' }], affixes: { groups: [] }, deepen: null } }];
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds }).body);
  assert.equal(doc.refs.weapon['30999'].rare, 2);
  assert.equal(doc.texts.weapon['30999'].cn, '旧盾');
});

test('a build saved before 2026-09-27 is published with `deepens`; its styles count as used', () => {
  const builds = [{ characterId: 'D0017', position: 0, doc: { name: 'Cũ', weapons: [], affixes: { groups: [] }, deepen: { styleId: '102', points: [7, 4, 0, 0] } } }];
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds }).body);
  assert.deepEqual(doc.builds.D0017[0].deepens, [{ label: '', styleId: '102', points: [7, 4, 0, 0] }]);
  assert.equal('deepen' in doc.builds.D0017[0], false);
});

test('builds grouped per character in position order', () => {
  const b = (name) => ({ name, weapons: [], affixes: { groups: [] }, deepen: null });
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds: [
    { characterId: 'D0017', position: 1, doc: b('Boss') }, { characterId: 'A0001', position: 0, doc: b('Chuẩn') }, { characterId: 'D0017', position: 0, doc: b('Chuẩn') },
  ] }).body);
  assert.deepEqual(Object.keys(doc.builds), ['A0001', 'D0017']);
  assert.deepEqual(doc.builds.D0017.map((x) => x.name), ['Chuẩn', 'Boss']);
});

test('immutable file name from the content: game.<12 hex>.json, stable for the same input', () => {
  const a = buildGameDocument({ refs, texts, builds: [] });
  assert.match(a.fileName, /^game\.[0-9a-f]{12}\.json$/);
  assert.equal(buildGameDocument({ refs: [...refs].reverse(), texts: [...texts].reverse(), builds: [] }).fileName, a.fileName);
  assert.notEqual(buildGameDocument({ refs: refs.slice(1), texts, builds: [] }).fileName, a.fileName);
});

test('a build saved before 2026-09-28 is published with rotation steps', () => {
  const builds = [{ characterId: 'D0017', position: 0, doc: { name: 'Cũ', weapons: [], affixes: { groups: [] }, deepens: [], rotations: [{ label: '0 dupe', skillIds: ['D001701'] }] } }];
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds }).body);
  assert.deepEqual(doc.builds.D0017[0].rotations, [{ label: '0 dupe', note: '', steps: [{ skillId: 'D001701', note: '' }] }]);
});

test('tier lists: drafts stay private, the rest by position then slug', () => {
  const at = new Date('2026-10-02T10:00:00Z');
  const list = (slug, status, position) => ({ slug, status, position, updatedAt: at, doc: { title: slug } });
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds: [], tierLists: [list('b', 'archived', 1), list('d', 'draft', 0), list('a', 'published', 1), list('c', 'published', 0)] }).body);
  assert.deepEqual(doc.tierLists.map((l) => [l.slug, l.status]), [['c', 'published'], ['a', 'published'], ['b', 'archived']]);
  assert.deepEqual(doc.tierLists[0], { slug: 'c', status: 'published', updatedAt: '2026-10-02T10:00:00.000Z', doc: { title: 'c' } });
});
