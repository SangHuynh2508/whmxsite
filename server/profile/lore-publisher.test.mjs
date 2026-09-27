// server/profile/lore-publisher.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { publishLore, repointLore } from './lore-publisher.mjs';

function fakes({ locked = true, publishedHash = null, failPointer = false, livePointerFile = null, liveGameFile = null, builds = [] } = {}) {
  const writes = [];
  let state = { publishedHash };
  const repo = {
    withPublishLock: async (fn) => (locked ? fn('tx') : { status: 'busy' }),
    loadPublishProfiles: async () => [['A0001', { record_id: '1' }]],
    loadGameDocumentInput: async () => ({ refs: [], texts: [], builds }),
    loadBackupPayload: async () => ({ version: 1, profileTexts: [] }),
    readState: async () => state,
    writeState: async (_tx, patch) => { state = { ...state, ...patch }; writes.push(['state', patch]); },
  };
  const storage = {
    envName: 'development',
    readPointerFile: async (name) => (name === 'game.pointer.json' ? liveGameFile : livePointerFile),
    publicFileExists: async (name) => name === 'lore.aaaaaaaaaaaa.json',
    putPublic: async (name, body, opts) => { if (failPointer && name === 'lore.pointer.json') throw new Error('R2 down'); writes.push(['public', name, opts.cacheControl, body, opts.contentEncoding]); },
    putBackup: async (key, buffer) => writes.push(['backup', key, JSON.parse(gunzipSync(buffer).toString())]),
  };
  return { repo, storage, writes, getState: () => state };
}
const now = new Date('2026-09-24T10:00:00Z');

test('publishes content, then pointer, then state; always writes the backup', async () => {
  const f = fakes();
  const result = await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u1', now });
  assert.equal(result.status, 'published');
  assert.deepEqual(f.writes.map((w) => (w[0] === 'public' ? w[1].replace(/\.[0-9a-f]{12}\./, '.<hash>.') : w[0])), [
    'backup', 'lore.<hash>.json', 'lore.pointer.json', 'game.<hash>.json', 'game.pointer.json', 'state',
  ]);
  assert.deepEqual(f.writes.filter((w) => w[0] === 'public').map((w) => w[2]), ['public, max-age=31536000, immutable', 'public, max-age=60', 'public, max-age=31536000, immutable', 'public, max-age=60']);
  assert.equal(f.writes[0][1], 'backups/lore/development/2026-09-24.json.gz');
  assert.equal(f.getState().publishedByUserId, 'u1');
});

test('unchanged content writes the backup and marks the live file current (clears the unpublished hint)', async () => {
  const first = fakes();
  const { file, game } = await publishLore({ repo: first.repo, storage: first.storage, now });
  const f = fakes({ publishedHash: first.getState().publishedHash, livePointerFile: file, liveGameFile: game });
  assert.equal((await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u2', now })).status, 'unchanged');
  assert.deepEqual(f.writes.map((w) => w[0]), ['backup', 'state']);
  assert.equal(f.getState().publishedAt, now);
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

test('a new environment is published even when the DB state already has this hash (review #3)', async () => {
  const first = fakes();
  const { file } = await publishLore({ repo: first.repo, storage: first.storage, now });
  const f = fakes({ publishedHash: first.getState().publishedHash, livePointerFile: null });
  assert.equal((await publishLore({ repo: f.repo, storage: f.storage, now })).status, 'published');
  assert.ok(f.writes.some((w) => w[0] === 'public' && w[1] === file));
});

test('repoint rolls back under the lock, only to an existing file, and marks live as not current (review #6)', async () => {
  const f = fakes();
  await assert.rejects(repointLore({ repo: f.repo, storage: f.storage, fileName: 'lore.bbbbbbbbbbbb.json', now }), /not found/);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(await repointLore({ repo: f.repo, storage: f.storage, fileName: 'lore.aaaaaaaaaaaa.json', now }), { status: 'repointed', file: 'lore.aaaaaaaaaaaa.json' });
  assert.deepEqual(f.writes.map((w) => w[0] === 'public' ? w[1] : w[0]), ['lore.pointer.json', 'state']);
  assert.deepEqual(f.getState(), { publishedHash: 'aaaaaaaaaaaa', publishedFile: 'lore.aaaaaaaaaaaa.json', publishedAt: null, publishedByUserId: null });
  const busy = fakes({ locked: false });
  assert.deepEqual(await repointLore({ repo: busy.repo, storage: busy.storage, fileName: 'lore.aaaaaaaaaaaa.json', now }), { status: 'busy' });
});

test('the content file is uploaded gzip-encoded (1.8 MB of JSON → a fraction); the pointer stays plain', async () => {
  const f = fakes();
  await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u1', now });
  const content = f.writes.find((w) => w[0] === 'public' && !w[1].startsWith('lore.pointer'));
  const pointer = f.writes.find((w) => w[0] === 'public' && w[1].startsWith('lore.pointer'));
  assert.equal(content[4], 'gzip');
  assert.deepEqual(JSON.parse(gunzipSync(content[3]).toString()).characters, { A0001: { record_id: '1' } });
  assert.equal(pointer[4], undefined);
  assert.equal(JSON.parse(pointer[3]).file, content[1]);
});

test('the game document (game.<hash>.json: catalogue + texts + builds) is published next to lore; only a changed file is uploaded', async () => {
  const first = fakes();
  const { file } = await publishLore({ repo: first.repo, storage: first.storage, now });
  // lore is live and unchanged; a saved build changes only the game file
  const f = fakes({ livePointerFile: file, builds: [{ characterId: 'D0017', position: 0, doc: { name: 'Chuẩn', weapons: [], affixes: { groups: [] }, deepen: null } }] });
  const result = await publishLore({ repo: f.repo, storage: f.storage, now });
  assert.equal(result.status, 'published');
  const names = f.writes.filter((w) => w[0] === 'public').map((w) => w[1]);
  assert.deepEqual(names.map((n) => n.replace(/\.[0-9a-f]{12}\./, '.<hash>.')), ['game.<hash>.json', 'game.pointer.json']);
  const content = f.writes.find((w) => w[0] === 'public' && w[1] === result.game);
  assert.deepEqual(JSON.parse(gunzipSync(content[3]).toString()).builds.D0017[0].name, 'Chuẩn');
  assert.equal(f.getState().publishedFile, file); // the admin's "published" state follows lore as before
});
