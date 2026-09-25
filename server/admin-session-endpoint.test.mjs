// api/admin/session.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const handler = createRequire(import.meta.url)('../api/admin/session.js');
const response = () => {
  const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

test('without auth configured (e.g. a Vercel env with no DB vars) it answers "not signed in", not 500', async () => {
  const saved = { db: process.env.DATABASE_URL, secret: process.env.BETTER_AUTH_SECRET };
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  // A deployment has no .env.local; run where the handler cannot find one.
  const cwd = process.cwd();
  const empty = mkdtempSync(join(tmpdir(), 'whmx-noenv-'));
  process.chdir(empty);
  try {
    const r = response();
    await handler({ method: 'GET', headers: {} }, r);
    assert.equal(r.code, 200);
    assert.deepEqual(r.body, { authenticated: false });
  } finally {
    process.chdir(cwd);
    rmSync(empty, { recursive: true, force: true });
    if (saved.db !== undefined) process.env.DATABASE_URL = saved.db;
    if (saved.secret !== undefined) process.env.BETTER_AUTH_SECRET = saved.secret;
  }
});
