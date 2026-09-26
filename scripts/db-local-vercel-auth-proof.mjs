import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

import { cleanupFailed } from './lib/cleanup.mjs';

const baseUrl = 'http://localhost:3000';
const marker = `local-vercel-auth-${randomUUID()}`;
const email = `${marker}@d1.invalid`;
const password = randomBytes(24).toString('base64url');

function cookieFrom(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = cookies[0] || response.headers.get('set-cookie');
  assert.ok(raw, 'successful HTTP sign-in must issue a session cookie');
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Lax/i);
  return raw.split(';')[0];
}

async function jsonRequest(path, { body, cookie, origin = baseUrl, method = 'POST' } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      origin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
  });
}

async function errorCode(response) {
  const payload = await response.json();
  return payload?.code;
}

let db;
let fixtureUserId;
let users;
let adminAccountAudits;
try {
  const [{ provisioningAuth, internalAuthHeaders }, { getDb, closeDb }, authSchema] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/auth.mjs'),
  ]);
  ({ adminAccountAudits, users } = authSchema);
  db = getDb();

  const created = await provisioningAuth.api.signUpEmail({
    body: { name: marker, email, password },
    headers: internalAuthHeaders(),
  });
  fixtureUserId = created.user.id;

  const login = await jsonRequest('/api/auth/sign-in/email', { body: { email, password } });
  assert.equal(login.status, 200, 'the browser sign-in path must succeed through Vercel Dev');
  const cookie = cookieFrom(login);

  const session = await jsonRequest('/api/admin/session', { cookie, method: 'GET' });
  assert.equal(session.status, 200, 'an HTTP session must reach the admin session function');
  const sessionPayload = await session.json();
  assert.equal(sessionPayload.authenticated, true);
  assert.equal(sessionPayload.user.id, fixtureUserId);

  const logout = await jsonRequest('/api/auth/sign-out', { body: {}, cookie });
  assert.equal(logout.status, 200, 'HTTP logout must succeed');
  const revokedSession = await jsonRequest('/api/admin/session', { cookie, method: 'GET' });
  assert.equal(revokedSession.status, 401, 'logout must invalidate the HTTP session');

  const invalidLogin = await jsonRequest('/api/auth/sign-in/email', {
    body: { email, password: randomBytes(24).toString('base64url') },
  });
  assert.equal(invalidLogin.status, 401);
  assert.equal(await errorCode(invalidLogin), 'INVALID_EMAIL_OR_PASSWORD');

  const unknownLogin = await jsonRequest('/api/auth/sign-in/email', {
    body: { email: `${marker}-missing@d1.invalid`, password },
  });
  assert.equal(unknownLogin.status, 401);
  assert.equal(await errorCode(unknownLogin), 'INVALID_EMAIL_OR_PASSWORD');

  const rejectedOrigin = await jsonRequest('/api/auth/sign-in/email', {
    body: { email, password },
    origin: 'http://localhost:3001',
  });
  assert.ok(rejectedOrigin.status >= 400, 'untrusted localhost origin must be rejected');
  assert.notEqual(rejectedOrigin.status, 200);

  const publicSignup = await jsonRequest('/api/auth/sign-up/email', {
    body: { name: marker, email: `${marker}-signup@d1.invalid`, password },
  });
  assert.ok(publicSignup.status >= 400, 'public sign-up must remain disabled');
  assert.equal(publicSignup.headers.get('set-cookie'), null, 'public sign-up must not create a session');

  const missingApi = await fetch(`${baseUrl}/api/not-a-real-route`);
  assert.equal(missingApi.status, 404, 'unknown API paths must not fall through to the SPA');
  assert.doesNotMatch(missingApi.headers.get('content-type') || '', /text\/html/i);

  const spa = await fetch(`${baseUrl}/#/admin`);
  assert.equal(spa.status, 200, 'normal SPA paths must still load');
  assert.match(spa.headers.get('content-type') || '', /text\/html/i);

  console.log('LOCAL_VERCEL_AUTH_PROOF=PASS');
} finally {
  if (db && fixtureUserId) {
    await db.execute(sql`delete from admin_account_audits where actor_user_id = ${fixtureUserId} or subject_user_id = ${fixtureUserId}`).catch(cleanupFailed);
    await db.delete(users).where(eq(users.id, fixtureUserId)).catch(cleanupFailed);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
