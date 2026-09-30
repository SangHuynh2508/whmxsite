import assert from 'node:assert/strict';
import test from 'node:test';

import { staticView } from './staticRoutes.mts';

test('home and banners routes', () => {
  for (const h of ['', '#', '#/', '/']) assert.equal(staticView(h), 'home');
  assert.equal(staticView('#/banners'), 'banners');
  assert.equal(staticView('#/banners/'), 'banners');
  assert.equal(staticView('#/characters'), null);
  assert.equal(staticView('#/bannersx'), null);
  assert.equal(staticView('#/banners?char=A0184&year=2024'), 'banners'); // archive filters live in the query
});
