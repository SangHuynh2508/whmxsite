import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `vercel dev` injects `.env` but not `.env.local`, where the local DB/auth vars live.
// The session check must load `.env.local` before deciding auth is "not configured",
// otherwise a signed-in owner is told "not signed in" locally.
test('reads auth config from .env.local before answering', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'whmx-session-'));
  const cwd = process.cwd();
  writeFileSync(join(dir, '.env.local'), 'DATABASE_URL=postgres://u:p@127.0.0.1:9/none\nBETTER_AUTH_SECRET=test-secret-test-secret-test-secret\n');
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  process.chdir(dir);
  try {
    const handler = createRequire(import.meta.url)('../api/admin/session.js');
    const r = { setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
    await handler({ method: 'GET', headers: {} }, r);
    assert.equal(process.env.DATABASE_URL, 'postgres://u:p@127.0.0.1:9/none');
    assert.notDeepEqual(r.body, { authenticated: false }, 'must not short-circuit as "auth not configured"');
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
