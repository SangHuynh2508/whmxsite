import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameTermHref, parseCharactersRoute, recordHref, termHref } from './route.mts';

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

test('terms page and lore module routes', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters/terms'), { view: 'terms' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/terms/K12'), { view: 'terms', code: 'K12' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0144/lore'), { view: 'record', id: 'A0144', module: 'lore' });
  assert.equal(termHref('ORG_3'), '#/admin/dictionary/lore/ORG_3');
});

test('game-text translation page and the Build module', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters/game-terms'), { view: 'gameTerms' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/game-terms/weapon%3A30111'), { view: 'gameTerms', code: 'weapon:30111' });
  assert.equal(gameTermHref('weapon:30111'), '#/admin/dictionary/weapons/weapon%3A30111');
  assert.deepEqual(parseCharactersRoute('#/admin/characters/D0017/build'), { view: 'record', id: 'D0017', module: 'build' });
});
