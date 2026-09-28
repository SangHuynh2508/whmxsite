// Every admin route imports admin-api.mjs (auth + error mapping). It must stay light: the heavy upload stack (sharp,
// AWS SDK) belongs only to the asset routes, or every cold admin request pays for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const env = { ...process.env, DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x', BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret' };

test('loading admin-api.mjs does not load sharp or the AWS SDK', () => {
  const script = `
    import { registerHooks } from 'node:module';
    const seen = [];
    registerHooks({ resolve(specifier, context, next) { const r = next(specifier, context); seen.push(r.url); return r; } });
    await import(${JSON.stringify(new URL('./admin-api.mjs', import.meta.url).href)});
    console.log(JSON.stringify(seen));`;
  const seen = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' }).trim().split('\n').pop());
  const heavy = seen.filter((url) => /\/node_modules\/(sharp|@aws-sdk)\//.test(url));
  assert.deepEqual(heavy, []);
});

test('domain errors still map to their HTTP status', async () => {
  Object.assign(process.env, { DATABASE_URL: env.DATABASE_URL, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET });
  const { sendAdminError } = await import('./admin-api.mjs');
  const { ManagedAssetError } = await import('./assets/r2-managed-assets.mjs');
  const { PreviewDomainError } = await import('./preview-characters/preview-character-domain.mjs');
  const { CharacterSkinDomainError } = await import('./character-skin-admin-domain.mjs');
  const { AdminAccountDomainError } = await import('./admin/accounts/admin-account-domain.mjs');
  const send = (error) => {
    const r = { status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
    sendAdminError(r, error);
    return [r.code, r.body.error.code];
  };
  assert.deepEqual(send(new ManagedAssetError('NOT_FOUND', 'x')), [404, 'NOT_FOUND']);
  assert.deepEqual(send(new PreviewDomainError('VERSION_CONFLICT', 'x')), [409, 'VERSION_CONFLICT']);
  assert.deepEqual(send(new CharacterSkinDomainError('FORBIDDEN', 403)), [403, 'FORBIDDEN']);
  assert.deepEqual(send(new AdminAccountDomainError('EMAIL_TAKEN', 409)), [409, 'EMAIL_TAKEN']);
  const log = console.error;
  console.error = () => {}; // the 500 path logs the error on purpose
  try { assert.deepEqual(send(new Error('boom')), [500, 'INTERNAL_ERROR']); } finally { console.error = log; }
});
