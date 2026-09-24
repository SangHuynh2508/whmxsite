// server/profile/lore-publisher.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { publishLore } from './lore-publisher.mjs';

function fakes({ locked = true, publishedHash = null, failPointer = false } = {}) {
  const writes = [];
  let state = { publishedHash };
  const repo = {
    withPublishLock: async (fn) => (locked ? fn('tx') : { status: 'busy' }),
    loadPublishProfiles: async () => [['A0001', { record_id: '1' }]],
    loadBackupPayload: async () => ({ version: 1, profileTexts: [] }),
    readState: async () => state,
    writeState: async (_tx, patch) => { state = { ...state, ...patch }; writes.push(['state', patch]); },
  };
  const storage = {
    envName: 'development',
    putPublic: async (name, body, opts) => { if (failPointer && name === 'lore.pointer.json') throw new Error('R2 down'); writes.push(['public', name, opts.cacheControl, body]); },
    putBackup: async (key, buffer) => writes.push(['backup', key, JSON.parse(gunzipSync(buffer).toString())]),
  };
  return { repo, storage, writes, getState: () => state };
}
const now = new Date('2026-09-24T10:00:00Z');

test('publishes content, then pointer, then state; always writes the backup', async () => {
  const f = fakes();
  const result = await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u1', now });
  assert.equal(result.status, 'published');
  assert.deepEqual(f.writes.map((w) => w[0] === 'public' ? `${w[1].startsWith('lore.pointer') ? 'pointer' : 'content'}:${w[2]}` : w[0]), [
    'backup', 'content:public, max-age=31536000, immutable', 'pointer:public, max-age=60', 'state',
  ]);
  assert.equal(f.writes[0][1], 'backups/lore/development/2026-09-24.json.gz');
  assert.equal(f.getState().publishedByUserId, 'u1');
});

test('unchanged content writes only the backup', async () => {
  const first = fakes();
  await publishLore({ repo: first.repo, storage: first.storage, now });
  const f = fakes({ publishedHash: first.getState().publishedHash });
  assert.equal((await publishLore({ repo: f.repo, storage: f.storage, now })).status, 'unchanged');
  assert.deepEqual(f.writes.map((w) => w[0]), ['backup']);
});

test('a concurrent publish returns busy and writes nothing', async () => {
  const f = fakes({ locked: false });
  assert.deepEqual(await publishLore({ repo: f.repo, storage: f.storage, now }), { status: 'busy' });
  assert.equal(f.writes.length, 0);
});

test('a pointer failure leaves state untouched so the old version stays live', async () => {
  const f = fakes({ failPointer: true });
  await assert.rejects(publishLore({ repo: f.repo, storage: f.storage, now }), /R2 down/);
  assert.equal(f.writes.some((w) => w[0] === 'state'), false);
});
