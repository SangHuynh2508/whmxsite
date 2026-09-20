import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { eq, sql } from 'drizzle-orm';

const baseUrl = process.env.PERF_BASE_URL || 'http://localhost:3000';
const marker = `perf-local-${randomUUID()}`;
const email = `${marker}@perf.invalid`;
const password = randomBytes(24).toString('base64url');

async function timed(label, path, init = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init });
  const body = await response.arrayBuffer();
  const ms = performance.now() - started;
  console.log(`${label};status=${response.status};bytes=${body.byteLength};ms=${ms.toFixed(1)}`);
  return { response, ms };
}

function cookieFrom(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = cookies[0] || response.headers.get('set-cookie');
  assert.ok(raw, 'sign-in must issue a cookie');
  return raw.split(';')[0];
}

let db;
let fixtureUserId;
try {
  const [{ auth, provisioningAuth, internalAuthHeaders }, { getDb, closeDb }, schema, previewRead, accountDomain] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/auth.mjs'),
    import('../server/preview-characters/preview-character-read-domain.mjs'),
    import('../server/admin/accounts/admin-account-domain.mjs'),
  ]);
  db = getDb();
  const created = await provisioningAuth.api.signUpEmail({
    body: { name: marker, email, password },
    headers: internalAuthHeaders(),
  });
  fixtureUserId = created.user.id;
  await db.update(schema.users).set({ role: 'owner', status: 'active', updatedAt: new Date() }).where(eq(schema.users.id, fixtureUserId));

  let started = performance.now();
  const directLogin = await auth.handler(new Request(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST', headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
  console.log(`direct-sign-in;status=${directLogin.status};ms=${(performance.now() - started).toFixed(1)}`);
  started = performance.now();
  await previewRead.listPreviewCharacters({ limit: '25' });
  console.log(`direct-preview-list;ms=${(performance.now() - started).toFixed(1)}`);
  started = performance.now();
  await accountDomain.listAdminAccounts(fixtureUserId);
  console.log(`direct-user-list;ms=${(performance.now() - started).toFixed(1)}`);

  const headers = { origin: baseUrl, 'content-type': 'application/json' };
  const login = await timed('admin-sign-in', '/api/auth/sign-in/email', {
    method: 'POST', headers, body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200);
  const cookie = cookieFrom(login.response);
  const authHeaders = { cookie };
  await timed('admin-session', '/api/admin/session', { headers: authHeaders });
  await timed('admin-previews', '/api/admin/previews?limit=25', { headers: authHeaders });
  await timed('admin-users', '/api/admin/users', { headers: authHeaders });
  const serialStart = performance.now();
  const serialPreview = await fetch(`${baseUrl}/api/admin/previews?limit=25`, { headers: authHeaders });
  await serialPreview.arrayBuffer();
  const serialUsers = await fetch(`${baseUrl}/api/admin/users`, { headers: authHeaders });
  await serialUsers.arrayBuffer();
  console.log(`admin-serial;status=${serialPreview.status}/${serialUsers.status};ms=${(performance.now() - serialStart).toFixed(1)}`);
  const parallelStart = performance.now();
  const [preview, users] = await Promise.all([
    fetch(`${baseUrl}/api/admin/previews?limit=25`, { headers: authHeaders }),
    fetch(`${baseUrl}/api/admin/users`, { headers: authHeaders }),
  ]);
  await Promise.all([preview.arrayBuffer(), users.arrayBuffer()]);
  console.log(`admin-parallel;status=${preview.status}/${users.status};ms=${(performance.now() - parallelStart).toFixed(1)}`);
} finally {
  if (db && fixtureUserId) {
    await db.execute(sql`delete from admin_account_audits where actor_user_id = ${fixtureUserId} or subject_user_id = ${fixtureUserId}`).catch(() => undefined);
    await db.delete((await import('../db/schema/auth.mjs')).users).where(eq((await import('../db/schema/auth.mjs')).users.id, fixtureUserId)).catch(() => undefined);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
