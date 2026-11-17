import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchBlob, loadImage } from './loadImage.mts';

const body = (sizes: number[]) => new ReadableStream<Uint8Array>({ start(c) { for (const n of sizes) c.enqueue(new Uint8Array(n)); c.close(); } });
const res = (sizes: number[], headers: Record<string, string> = {}, status = 200) => new Response(body(sizes), { status, headers });

test('progress from content-length, ending at 1', async () => {
  const seen: number[] = [];
  const blob = await fetchBlob('u', (p) => seen.push(p), async () => res([2, 2], { 'content-length': '4', 'content-type': 'image/webp' }));
  assert.deepEqual(seen, [0.5, 1]);
  assert.equal(blob.size, 4);
  assert.equal(blob.type, 'image/webp');
});

test('no content-length: one "unknown" (-1), still the whole body', async () => {
  const seen: number[] = [];
  assert.equal((await fetchBlob('u', (p) => seen.push(p), async () => res([3]))).size, 3);
  assert.deepEqual(seen, [-1]);
});

test('an HTTP error rejects (the viewer says so, "Tải ảnh" stays)', async () => {
  await assert.rejects(fetchBlob('u', () => {}, async () => res([], {}, 404)), /HTTP 404/);
});

test('one fetch per url; a failed load is not kept', async () => {
  let calls = 0;
  const ok = async () => { calls += 1; return res([1], { 'content-length': '1' }); };
  const [x, y] = await Promise.all([loadImage('https://r2/a.webp', () => {}, ok), loadImage('https://r2/a.webp', () => {}, ok)]);
  assert.equal(x, y);
  assert.equal(calls, 1);
  assert.match(x, /^blob:/);
  let n = 0;
  const bad = async () => { n += 1; return res([], {}, 500); };
  await assert.rejects(loadImage('https://r2/b.webp', () => {}, bad));
  await assert.rejects(loadImage('https://r2/b.webp', () => {}, bad));
  assert.equal(n, 2);
});

test('fetch blocked (no CORS on R2, a proxy): the <img> loads it, progress unknown', async () => {
  const seen: number[] = [];
  (globalThis as any).Image = class { onload = () => {}; onerror = () => {}; set src(_v: string) { queueMicrotask(() => this.onload()); } };
  try {
    const src = await loadImage('https://r2/c.webp', (p) => seen.push(p), async () => { throw new TypeError('Failed to fetch'); });
    assert.equal(src, 'https://r2/c.webp');
    assert.deepEqual(seen, [-1]);
  } finally {
    delete (globalThis as any).Image;
  }
});
