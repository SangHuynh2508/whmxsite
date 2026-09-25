import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCharacters } from './listFilter.mts';

const c = (characterId: string, nameVi: string | null, nameCn: string) => ({ characterId, nameCn, nameVi: { value: nameVi }, fullnameVi: { value: null } });
const items = [c('A1', 'Lộc Giác', '鹿角'), c('A2', 'Thiên Cầu', '天球'), c('A3', null, '无名')];
const progress = { A1: { total: 4, done: 4, legacy: 0, changed: 0 }, A2: { total: 4, done: 1, legacy: 2, changed: 1 } };

test('search matches ID, VI and CN; filters use lore progress', () => {
  assert.deepEqual(filterCharacters(items, progress, { query: 'lộc', filter: 'all' }).map((x) => x.characterId), ['A1']);
  assert.deepEqual(filterCharacters(items, progress, { query: '天', filter: 'all' }).map((x) => x.characterId), ['A2']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'unfinished' }).map((x) => x.characterId), ['A2', 'A3']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'legacy' }).map((x) => x.characterId), ['A2']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'changed' }).map((x) => x.characterId), ['A2']);
});
