// Files the deployed functions import must not be excluded by .vercelignore: locally everything is on
// disk, so an ignored import only fails on Vercel (ERR_MODULE_NOT_FOUND, 2026-09-26: the asset manifest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignored = readFileSync(join(root, '.vercelignore'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const isIgnored = (path) => ignored.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry));

test('nothing the server or api code imports is excluded from the deployment', () => {
  const files = ['server', 'api', 'db'].flatMap((dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => join(dir, f)))
    .filter((f) => /\.(m?js)$/.test(f) && !/\.test\.m?js$/.test(f));
  const missing = [];
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const [, spec] of source.matchAll(/(?:from\s+|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = relative(root, resolve(root, dirname(file), spec)).replace(/\\/g, '/');
      if (isIgnored(target)) missing.push(`${file.replace(/\\/g, '/')} → ${target}`);
    }
  }
  assert.deepEqual(missing, []);
});
