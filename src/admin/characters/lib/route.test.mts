import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCharactersRoute, recordHref } from './route.mts';

test('parses list, record and module hashes', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters'), { view: 'list' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001'), { view: 'record', id: 'A0001', module: 'overview' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001/skins'), { view: 'record', id: 'A0001', module: 'skins' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001/nope'), { view: 'record', id: 'A0001', module: 'overview' });
  assert.equal(recordHref('A0001', 'history'), '#/admin/characters/A0001/history');
  assert.equal(recordHref('A0001'), '#/admin/characters/A0001');
});

test('a malformed %-escape falls back to the list instead of throwing', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters/%E0'), { view: 'list' });
});
