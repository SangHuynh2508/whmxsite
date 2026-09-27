// server/profile/lore-document.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

test('same profiles give the same immutable file name', () => {
  const a = buildLoreDocument([['A0001', { record_id: '1' }]]);
  assert.equal(a.fileName, buildLoreDocument([['A0001', { record_id: '1' }]]).fileName);
  assert.match(a.fileName, /^lore\.[0-9a-f]{12}\.json$/);
  assert.notEqual(a.fileName, buildLoreDocument([['A0001', { record_id: '2' }]]).fileName);
  assert.deepEqual(JSON.parse(a.body), { version: 1, characters: { A0001: { record_id: '1' } } });
});

test('pointer and backup key', () => {
  const now = new Date('2026-09-24T23:59:00Z');
  assert.deepEqual(JSON.parse(buildPointer('lore.abc.json', now)), { file: 'lore.abc.json', publishedAt: '2026-09-24T23:59:00.000Z' });
  assert.equal(backupKey('production', now), 'backups/lore/production/2026-09-24.json.gz');
});

test('builds: a document without builds is byte-identical to before (same file name); with builds it gains builds + refs', () => {
  const profiles = [['A0001', { record_id: '1' }]];
  const before = buildLoreDocument(profiles);
  assert.equal(buildLoreDocument(profiles, null).body, before.body);
  const withBuilds = buildLoreDocument(profiles, { builds: { A0001: [{ name: 'Chuẩn' }] }, refs: { weapons: {} } });
  assert.deepEqual(JSON.parse(withBuilds.body), { version: 1, characters: { A0001: { record_id: '1' } }, builds: { A0001: [{ name: 'Chuẩn' }] }, refs: { weapons: {} } });
  assert.notEqual(withBuilds.fileName, before.fileName);
});
