// Only Vite's hashed build output may be cached as immutable. public/assets/** keeps stable names
// (avatars/A0001.png…), so a corrected image must not stay stuck in browsers for a year.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { headers } = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
// The asset sources are plain regex groups, so they read the same as an anchored RegExp.
const cacheRules = headers
  .map((rule) => ({ re: new RegExp(`^${rule.source}$`), value: rule.headers.find((h) => h.key === 'Cache-Control')?.value }))
  .filter((rule) => rule.value);
const cacheFor = (url) => cacheRules.filter((rule) => rule.re.test(url)).map((rule) => rule.value);

test('stable-name public assets are never immutable and get exactly one cache rule', () => {
  const urls = readdirSync(join(root, 'public/assets'), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `/assets/${join(d.parentPath ?? d.path, d.name).slice(join(root, 'public/assets').length + 1).replace(/\\/g, '/')}`);
  assert.ok(urls.length > 1000);
  const bad = urls.filter((url) => cacheFor(url).length !== 1 || cacheFor(url)[0].includes('immutable'));
  assert.deepEqual(bad.slice(0, 5), []);
});

test('hashed build output stays immutable', () => {
  assert.deepEqual(cacheFor('/assets/index-NQD-zLxK.js'), ['public, max-age=31536000, immutable']);
});
