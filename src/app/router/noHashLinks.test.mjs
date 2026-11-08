// Public links are paths since 2026-11-09 (spec seo-path-urls §3). A '#/' link would still work (legacy redirect)
// but costs a history entry and skips the prerendered page, so none may come back outside the admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (n === 'admin' ? [] : walk(p)) : [p];
});

test('no "#/" link outside src/admin', () => {
  const hits = walk('src')
    .filter((p) => /\.(js|mjs|mts|ts|tsx)$/.test(p) && !/\.test\./.test(p))
    .flatMap((p) => readFileSync(p, 'utf8').split(/\r?\n/).map((l, i) => [p, i + 1, l]))
    .map(([p, n, l]) => [p, n, l.replace(/\s\/\/ .*$/, '')]) // a trailing comment may quote an old URL
    .filter(([, , l]) => /(href=|`|'|")#\/(?!admin|login)/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.deepEqual(hits.map(([p, n]) => `${p}:${n}`), []);
});
