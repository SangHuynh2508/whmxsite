import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from './parseRoute.mts';

// 2026-11-10: the language switch adds ?lang=vi; the slug became "kim-si-dieu?lang=vi" → "Không tìm thấy nhân vật".
test('a query (?lang=, ?fbclid=) never ends up in a slug or id', () => {
  assert.deepEqual(parseRoute('#/characters/kim-si-dieu?lang=vi'), { view: 'character', slug: 'kim-si-dieu', subtab: 'overview' });
  assert.deepEqual(parseRoute('#/characters/kim-si-dieu/build?lang=cn&fbclid=x'), { view: 'character', slug: 'kim-si-dieu', subtab: 'build' });
  assert.deepEqual(parseRoute('#/skins/W0097002?lang=vi'), { view: 'skin-detail', skinId: 'W0097002', slug: '', subtab: '' });
  assert.equal(parseRoute('#/characters?lang=cn').view, 'catalog');
  assert.equal(parseRoute('#/gallery?lang=cn').view, 'gallery');
  assert.equal(parseRoute('#/weapons?lang=cn').view, 'weapons');
  assert.equal(parseRoute('#/banners?lang=cn').view, 'banners');
  assert.deepEqual(parseRoute('#/tier-list/a/teams?lang=cn'), { view: 'tier-list', slug: 'a', subtab: 'teams' });
});

test('calculator keeps its own query; aliases report a redirect', () => {
  assert.deepEqual(parseRoute('#/calculator?char=W0182&lang=cn'), { view: 'calculator', characterId: 'W0182', subtab: '' });
  assert.deepEqual(parseRoute('#/data'), { view: 'weapons', slug: '', subtab: '', redirect: '/weapons' });
  assert.deepEqual(parseRoute('#/gallery-demo?lang=vi'), { view: 'gallery', slug: '', subtab: '', redirect: '/gallery' });
  assert.equal(parseRoute('#/admin/characters/A0001').view, 'admin');
  assert.equal(parseRoute('#/login').view, 'admin');
  assert.equal(parseRoute('#/').view, 'home');
});
