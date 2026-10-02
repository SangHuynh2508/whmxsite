import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTierListHash, tierListHref } from './tierRoute.mts';

test('tier list URLs', () => {
  assert.deepEqual(parseTierListHash('#/tier-list'), { slug: '', tab: 'characters' });
  assert.deepEqual(parseTierListHash('#/tier-list/'), { slug: '', tab: 'characters' });
  assert.deepEqual(parseTierListHash('#/tier-list/tong-hop'), { slug: 'tong-hop', tab: 'characters' });
  assert.deepEqual(parseTierListHash('#/tier-list/tong-hop/teams'), { slug: 'tong-hop', tab: 'teams' });
  assert.deepEqual(parseTierListHash('#/tier-list/tong-hop/xyz'), { slug: 'tong-hop', tab: 'characters' });
  assert.equal(parseTierListHash('#/tier-lists'), null);
  assert.equal(parseTierListHash('#/characters/a/build'), null);
  assert.equal(tierListHref(), '#/tier-list');
  assert.equal(tierListHref('tong-hop'), '#/tier-list/tong-hop');
  assert.equal(tierListHref('tong-hop', 'characters'), '#/tier-list/tong-hop');
  assert.equal(tierListHref('tong-hop', 'info'), '#/tier-list/tong-hop/info');
});
