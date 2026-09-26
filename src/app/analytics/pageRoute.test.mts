import assert from 'node:assert/strict';
import test from 'node:test';

import { pageForHash } from './pageRoute.mts';

test('hash routes become analytics pages: real path + grouped route, no query string', () => {
  assert.deepEqual(pageForHash(''), { path: '/', route: '/' });
  assert.deepEqual(pageForHash('#/'), { path: '/', route: '/' });
  assert.deepEqual(pageForHash('#/characters'), { path: '/characters', route: '/characters' });
  assert.deepEqual(pageForHash('#/characters/loc-giac-lap-hac'), { path: '/characters/loc-giac-lap-hac', route: '/characters/[slug]' });
  assert.deepEqual(pageForHash('#/characters/loc-giac-lap-hac/lore'), { path: '/characters/loc-giac-lap-hac/lore', route: '/characters/[slug]/lore' });
  assert.deepEqual(pageForHash('#/skins/A0001002'), { path: '/skins/A0001002', route: '/skins/[id]' });
  assert.deepEqual(pageForHash('#calc?char=W0182'), { path: '/calc', route: '/calc' });
  assert.deepEqual(pageForHash('#/admin/characters/A0001/lore'), { path: '/admin/characters/A0001/lore', route: '/admin/characters/[id]/lore' });
  assert.deepEqual(pageForHash('#/admin/characters/terms'), { path: '/admin/characters/terms', route: '/admin/characters/terms' });
});
