import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWeapons, statRows, weaponList } from './weaponsView.mts';

const game = {
  version: 1 as const,
  refs: { weapon: {
    '1': { rare: 4, job: 1, skillIds: ['S1'], icon: 'itemicon_1' },
    '2': { rare: 5, job: 3, skillIds: [], icon: null },
    '3': { rare: 5, job: 1, skillIds: [], icon: null },
  } },
  texts: {
    weapon: { '1': { cn: '盾', vi: 'Khiên', detail: '', detail_vi: null }, '2': { cn: '弓', vi: null, detail: '', detail_vi: null }, '3': { cn: '剑', vi: 'Kiếm', detail: '', detail_vi: null } },
    weapon_skill: { S1: { cn: '技', vi: null, detail: '描述', detail_vi: null } },
  },
  builds: { A1: [{ weapons: [{ weaponId: '1' }] }, { weapons: [{ weaponId: '1' }] }], ZZ: [{ weapons: [{ weaponId: '2' }] }] },
};
const chars = { A1: { id: 'A1', slug: 'a-mot', name_vi: 'A Một', icon: 'assets/a.png' } };

test('rarest first, then job; names VI or CN flagged; users once per character, unknown characters dropped', () => {
  const list = weaponList(game, chars);
  assert.deepEqual(list.map((w) => w.id), ['3', '2', '1']);
  assert.deepEqual(list[1].name, { text: '弓', untranslated: true });
  assert.equal(list[2].icon, '/assets/items/itemicon_1.png');
  assert.deepEqual(list[2].skills, [{ name: { text: '技', untranslated: true }, text: { text: '描述', untranslated: true } }]);
  assert.deepEqual(list[2].users, [{ id: 'A1', href: '/characters/a-mot', name: 'A Một', icon: '/assets/a.png' }]);
  assert.deepEqual(list[1].users, []);
});

test('filter by search (shown or CN name), job and rarity', () => {
  const list = weaponList(game, chars);
  const f = (q: string, jobs: number[] = [], rares: number[] = []) => filterWeapons(list, { q, jobs: new Set(jobs), rares: new Set(rares) }).map((w) => w.id);
  assert.deepEqual(f('kiếm'), ['3']);
  assert.deepEqual(f('弓'), ['2']);
  assert.deepEqual(f('', [1]), ['3', '1']);
  assert.deepEqual(f('', [1], [4]), ['1']);
});

test('stat rows: each grade at Lv.1, then Lv.60 from the top grade (30321: 1849 + 59 × 22 = 3147)', () => {
  const rows = statRows({ tags: [], series: null, grades: [{ hp: 500, atk: 1 }, { hp: 1849, atk: 2 }], grow: { hp: 22, atk: 3 }, file: {} });
  assert.deepEqual(rows.at(-1), { grade: 1, level: 60, hp: 3147, atk: 179 });
  assert.equal(rows.length, 3);
  assert.deepEqual(statRows(undefined), []);
});

test('file fields: VI draft when there, else CN flagged; weight and batch are never "untranslated"', () => {
  const extras = { version: 1 as const, weapons: { '1': { tags: [], series: null, grades: [], grow: null, file: { maker: '琢磨·宿卫', text: '古人', weight: '25.5KG' } } } };
  const vi = { version: 1 as const, weapons: { '1': { maker: 'Trác Ma · Túc Vệ' } } };
  const w = weaponList(game, chars, extras, vi).find((x) => x.id === '1')!;
  assert.deepEqual(w.file, { maker: { text: 'Trác Ma · Túc Vệ', untranslated: false }, text: { text: '古人', untranslated: true }, weight: { text: '25.5KG', untranslated: false } });
});
