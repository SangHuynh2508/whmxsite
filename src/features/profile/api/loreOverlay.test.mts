// src/features/profile/api/loreOverlay.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLoreOverlay, mergeLoreOverlay } from './loreOverlay.mts';

const POINTER = 'https://cdn.example/lore/production/lore.pointer.json';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test('loads pointer then content relative to the pointer', async () => {
  const seen: string[] = [];
  const fetchImpl = async (url: string) => {
    seen.push(url);
    return url.endsWith('pointer.json') ? ok({ file: 'lore.0123456789ab.json' }) : ok({ version: 1, characters: { A0001: { record_id: '1' } } });
  };
  const overlay = await loadLoreOverlay(POINTER, fetchImpl as typeof fetch);
  assert.deepEqual(seen, [POINTER, 'https://cdn.example/lore/production/lore.0123456789ab.json']);
  assert.deepEqual(overlay?.characters, { A0001: { record_id: '1' } });
});

test('returns null on 404, bad pointer, bad version, or missing URL', async () => {
  assert.equal(await loadLoreOverlay(undefined), null);
  assert.equal(await loadLoreOverlay(POINTER, (async () => new Response('', { status: 404 })) as typeof fetch), null);
  assert.equal(await loadLoreOverlay(POINTER, (async () => ok({ file: '../evil.json' })) as typeof fetch), null);
  const wrongVersion = async (url: string) => (url.endsWith('pointer.json') ? ok({ file: 'lore.0123456789ab.json' }) : ok({ version: 2, characters: {} }));
  assert.equal(await loadLoreOverlay(POINTER, wrongVersion as typeof fetch), null);
});

test('times out instead of blocking the page', async () => {
  const hang = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })) as typeof fetch;
  const started = Date.now();
  assert.equal(await loadLoreOverlay(POINTER, hang, 50), null);
  assert.ok(Date.now() - started < 1000);
});

test('merge replaces only known characters', () => {
  const data = { characters: { A0001: { profile: { record_id: 'old' } }, A0002: { profile: { record_id: 'keep' } } } };
  const count = mergeLoreOverlay(data, { version: 1, characters: { A0001: { record_id: 'new' }, Z9999: { record_id: 'x' } } });
  assert.equal(count, 1);
  assert.deepEqual(data.characters.A0001.profile, { record_id: 'new' });
  assert.deepEqual(data.characters.A0002.profile, { record_id: 'keep' });
});

test('the pointer is always revalidated (no-cache): a reload right after a publish must not reuse the old pointer', async () => {
  const init: (RequestInit | undefined)[] = [];
  const fetchImpl = async (url: string, options?: RequestInit) => {
    init.push(options);
    return url.endsWith('pointer.json') ? ok({ file: 'lore.0123456789ab.json' }) : ok({ version: 1, characters: {} });
  };
  await loadLoreOverlay(POINTER, fetchImpl as typeof fetch);
  assert.equal(init[0]?.cache, 'no-cache');
});
