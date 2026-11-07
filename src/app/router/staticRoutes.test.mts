import assert from 'node:assert/strict';
import test from 'node:test';

import { musicTrackId, staticView } from './staticRoutes.mts';

test('home and banners routes', () => {
  for (const h of ['', '#', '#/', '/']) assert.equal(staticView(h), 'home');
  assert.equal(staticView('#/banners'), 'banners');
  assert.equal(staticView('#/banners/'), 'banners');
  assert.equal(staticView('#/characters'), null);
  assert.equal(staticView('#/bannersx'), null);
  assert.equal(staticView('#/banners?char=A0184&year=2024'), 'banners'); // archive filters live in the query
  assert.equal(staticView('#/info'), 'info');
});

test('music routes', () => {
  assert.equal(staticView('#/music'), 'music');
  assert.equal(staticView('#/music/'), 'music');
  assert.equal(staticView('#/music/Bgm_Map'), 'music');
  assert.equal(staticView('#/musicx'), null);
  assert.equal(musicTrackId('#/music'), '');
  assert.equal(musicTrackId('#/music/Bgm_Map'), 'bgm_map');
  assert.equal(musicTrackId('#/music/a/b'), '');
  assert.equal(musicTrackId('#/banners'), '');
  assert.equal(musicTrackId('#/music/%'), '');
});
