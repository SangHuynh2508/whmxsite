import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCharacterHash } from './characterHash.mts';

const char = { id: 'W0182', slug: 'ly-tieu-hai-hang-lien' };

// 2026-09-28: #/characters/W0182 froze the tabs (route key by URL segment: ID and slug looked like two pages)
test('an ID URL becomes the slug URL, keeping the tab', () => {
  assert.equal(canonicalCharacterHash('W0182', 'build', char), '#/characters/ly-tieu-hai-hang-lien/build');
  assert.equal(canonicalCharacterHash('w0182', 'overview', char), '#/characters/ly-tieu-hai-hang-lien');
});

test('a slug URL, an unknown character or one without a slug is left alone', () => {
  assert.equal(canonicalCharacterHash('ly-tieu-hai-hang-lien', 'lore', char), null);
  assert.equal(canonicalCharacterHash('X9999', 'overview', null), null);
  assert.equal(canonicalCharacterHash('W0182', 'overview', { id: 'W0182' }), null);
});
