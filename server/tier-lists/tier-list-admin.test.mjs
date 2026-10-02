import assert from 'node:assert/strict';
import test from 'node:test';

import { createTierList, deleteTierList, saveTierList } from './tier-list-admin.mjs';

// Guards that run before any DB access (db = null proves it).
test('only the owner deletes a tier list', async () => {
  await assert.rejects(deleteTierList(null, 'tong-hop', { expectedRevision: 1, actorUserId: 'u', actorRole: 'editor' }), (e) => e.status === 403 && e.code === 'FORBIDDEN');
});

test('a bad slug, status or position is refused before the DB', async () => {
  for (const slug of ['Tong Hop', 'a--b', 'x'.repeat(41), '']) {
    await assert.rejects(createTierList(null, { slug, title: 'T', actorUserId: 'u' }), (e) => e.status === 422 && e.code === 'INVALID_SLUG', slug);
  }
  await assert.rejects(saveTierList(null, 'a', { expectedRevision: 1, status: 'live', actorUserId: 'u' }), (e) => e.code === 'INVALID_STATUS');
  await assert.rejects(saveTierList(null, 'a', { expectedRevision: 1, position: -1, actorUserId: 'u' }), (e) => e.code === 'INVALID_POSITION');
});
