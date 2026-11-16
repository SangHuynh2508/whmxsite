import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV, currentSection } from './nav.mts';

const at = (hash: string) => { (globalThis as { location?: { hash: string } }).location = { hash }; return currentSection(); };

test('#/admin and unknown admin hashes open Khí Giả (Preview was removed 2026-11-17)', () => {
  assert.equal(at('#/admin'), 'characters');
  assert.equal(at('#/admin/nothing'), 'characters');
  assert.equal(at('#/admin/dictionary/lore'), 'dictionary');
  assert.ok(!NAV.some((entry) => (entry.id as string) === 'preview'));
});
