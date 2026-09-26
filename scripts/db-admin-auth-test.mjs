import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { eq, sql } from 'drizzle-orm';

import { cleanupFailed } from './lib/cleanup.mjs';

// A process-only test secret keeps the real local/deployed secret out of this
// proof. It is never persisted or printed.
process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString('base64url');
process.env.BETTER_AUTH_ALLOWED_HOSTS ??= 'localhost:5173,localhost:3000';

const marker = `d1-auth-${randomUUID()}`;
const ownerEmail = `${marker}-owner@d1.invalid`;
const ownerPassword = randomBytes(24).toString('base64url');
const editorPassword = randomBytes(24).toString('base64url');

function requestFor(path, body, cookie) {
  return new Request(`http://localhost:5173${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function cookieFrom(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = cookies[0] || response.headers.get('set-cookie');
  assert.ok(raw, 'successful sign-in must set an HttpOnly session cookie');
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Lax/i);
  return raw.split(';')[0];
}

function responseCapture() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; },
  };
}

function nodeLoginRequest(email, password) {
  return Object.assign(Readable.from([Buffer.from(JSON.stringify({ email, password }))]), {
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: {
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
    },
  });
}

let db;
try {
  const [{ auth, internalAuthHeaders, provisioningAuth }, { getDb, closeDb }, { accounts, adminAccountAudits, users }, accountDomain, { authenticatedUser }, sessionRoute, authRoute, previewDomain] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/auth.mjs'),
    import('../server/admin/accounts/admin-account-domain.mjs'),
    import('../server/admin-api.mjs'),
    import('../api/admin/session.js'),
    import('../api/auth/[...].js'),
    import('../server/preview-characters/preview-character-domain.mjs'),
  ]);
  db = getDb();
  const { bootstrapFirstOwner, provisionAdminAccount, updateAdminAccount, AdminAccountDomainError } = accountDomain;

  const existingOwners = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner'));
  const hasExistingOwner = existingOwners.length > 0;
  let owner;
  if (hasExistingOwner) {
    // A shared development database may already have a real owner. Keep it
    // untouched and create an isolated credential fixture for the remaining
    // role/session regression coverage.
    const created = await provisioningAuth.api.signUpEmail({
      body: { name: `${marker}-owner`, email: ownerEmail, password: ownerPassword },
      headers: internalAuthHeaders(),
    });
    [owner] = await db
      .update(users)
      .set({ role: 'owner', status: 'active', updatedAt: new Date() })
      .where(eq(users.id, created.user.id))
      .returning();
  } else {
    owner = await bootstrapFirstOwner({
      name: `${marker}-owner`,
      email: ownerEmail,
      password: ownerPassword,
      requestId: randomUUID(),
    });
  }
  assert.equal(owner.role, 'owner');
  const [credential] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(eq(accounts.userId, owner.id));
  assert.ok(credential?.password && credential.password !== ownerPassword, 'password must be stored only as a Better Auth hash');

  const bridgedLoginResponse = responseCapture();
  await authRoute.default(nodeLoginRequest(ownerEmail, ownerPassword), bridgedLoginResponse);
  assert.equal(bridgedLoginResponse.statusCode, 200, 'the deployed Node auth route must forward normal Better Auth login');

  const selfSignup = await auth.handler(requestFor('/api/auth/sign-up/email', {
    name: 'Public signup attempt',
    email: `${marker}-public@d1.invalid`,
    password: ownerPassword,
  }));
  assert.ok(selfSignup.status >= 400, 'public self-signup must remain unavailable');

  const badLogin = await auth.handler(requestFor('/api/auth/sign-in/email', { email: ownerEmail, password: 'wrong-password' }));
  assert.equal(badLogin.status, 401, 'invalid password must fail');

  const login = await auth.handler(requestFor('/api/auth/sign-in/email', { email: ownerEmail, password: ownerPassword }));
  assert.equal(login.status, 200, 'valid owner login must succeed');
  const ownerCookie = cookieFrom(login);
  const ownerSession = await authenticatedUser({
    headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: ownerCookie },
  });
  assert.equal(ownerSession.id, owner.id);
  assert.equal(ownerSession.role, 'owner');

  const sessionResponse = responseCapture();
  await sessionRoute.default({ method: 'GET', headers: { host: 'localhost:5173', cookie: ownerCookie } }, sessionResponse);
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(sessionResponse.payload.user.role, 'owner');
  assert.equal(JSON.stringify(sessionResponse.payload).includes('token'), false, 'session endpoint must not return a token');
  const unauthenticatedSessionResponse = responseCapture();
  await sessionRoute.default({ method: 'GET', headers: { host: 'localhost:5173' } }, unauthenticatedSessionResponse);
  // Since c8188ed (2026-09-24) "not signed in" is a normal answer, not a 401.
  assert.equal(unauthenticatedSessionResponse.statusCode, 200);
  assert.deepEqual(unauthenticatedSessionResponse.payload, { authenticated: false }, 'session endpoint must not expose anything to unauthenticated callers');

  const editor = await provisionAdminAccount({
    actorUserId: owner.id,
    name: `${marker}-editor`,
    email: `${marker}-editor@d1.invalid`,
    password: editorPassword,
    requestId: randomUUID(),
  });
  assert.equal(editor.role, 'editor', 'provisioning defaults to editor');
  const secondOwner = await provisionAdminAccount({
    actorUserId: owner.id,
    name: `${marker}-second-owner`,
    email: `${marker}-second-owner@d1.invalid`,
    password: editorPassword,
    role: 'owner',
    requestId: randomUUID(),
  });
  assert.equal(secondOwner.role, 'owner');

  await assert.rejects(
    () => provisionAdminAccount({
      actorUserId: editor.id,
      name: `${marker}-forbidden`,
      email: `${marker}-forbidden@d1.invalid`,
      password: editorPassword,
    }),
    (error) => error instanceof AdminAccountDomainError && error.code === 'FORBIDDEN',
  );
  await assert.rejects(
    () => provisionAdminAccount({
      actorUserId: owner.id,
      name: `${marker}-duplicate`,
      email: editor.email,
      password: editorPassword,
    }),
    (error) => error instanceof AdminAccountDomainError && error.code === 'DUPLICATE_EMAIL',
  );
  await assert.rejects(
    () => provisionAdminAccount({
      actorUserId: owner.id,
      name: `${marker}-invalid-role`,
      email: `${marker}-invalid-role@d1.invalid`,
      password: editorPassword,
      role: 'admin',
    }),
  );

  const editorLogin = await auth.handler(requestFor('/api/auth/sign-in/email', { email: editor.email, password: editorPassword }));
  assert.equal(editorLogin.status, 200);
  const editorCookie = cookieFrom(editorLogin);
  await updateAdminAccount({ actorUserId: owner.id, subjectUserId: editor.id, status: 'disabled', requestId: randomUUID() });
  await assert.rejects(
    () => authenticatedUser({ headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: editorCookie } }),
    (error) => error.code === 'UNAUTHORIZED' || error.code === 'ACCOUNT_DISABLED',
  );
  const disabledLoginResponse = responseCapture();
  await authRoute.default(nodeLoginRequest(editor.email, editorPassword), disabledLoginResponse);
  assert.equal(disabledLoginResponse.statusCode, 401, 'disabled users must not obtain a new session');

  await assert.rejects(
    () => previewDomain.createPreviewCharacter(db, {
      actorUserId: editor.id,
      requestId: randomUUID(),
      nameVi: `${marker}-must-not-create`,
    }),
    (error) => error.code === 'FORBIDDEN',
  );
  await updateAdminAccount({ actorUserId: owner.id, subjectUserId: editor.id, status: 'active', requestId: randomUUID() });

  await updateAdminAccount({ actorUserId: owner.id, subjectUserId: secondOwner.id, role: 'editor', requestId: randomUUID() });
  if (!hasExistingOwner) {
    await assert.rejects(
      () => updateAdminAccount({ actorUserId: owner.id, subjectUserId: owner.id, status: 'disabled', requestId: randomUUID() }),
      (error) => error instanceof AdminAccountDomainError && error.code === 'LAST_ACTIVE_OWNER_PROTECTED',
    );
  }

  const logout = await auth.handler(requestFor('/api/auth/sign-out', {}, ownerCookie));
  assert.equal(logout.status, 200, 'logout must succeed');
  await assert.rejects(
    () => authenticatedUser({ headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: ownerCookie } }),
    (error) => error.code === 'UNAUTHORIZED',
  );

  const audit = await db.select({ count: sql`count(*)::int` }).from(adminAccountAudits).where(eq(adminAccountAudits.subjectUserId, editor.id));
  assert.ok(Number(audit[0].count) >= 3, 'provision, disable, and re-enable must be audited');
  console.log('DB_ADMIN_AUTH_D1_TEST=PASS');
} finally {
  if (db) {
    await db.execute(sql`
      delete from admin_account_audits
      where actor_user_id in (select id from users where email like ${`${marker}%`})
         or subject_user_id in (select id from users where email like ${`${marker}%`})
    `).catch(cleanupFailed);
    await db.execute(sql`delete from users where email like ${`${marker}%`}`).catch(cleanupFailed);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
