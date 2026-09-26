import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

import { eq, or } from 'drizzle-orm';

import { auth, internalAuthHeaders, provisioningAuth } from '../server/auth.mjs';
import { authenticatedUser } from '../server/admin-api.mjs';
import sessionRoute from '../api/admin/session.js';
import { closeDb, getDb } from '../db/client.mjs';
import { accounts, adminAccountAudits, sessions, users, verifications } from '../db/schema/auth.mjs';

import { cleanupFailed } from './lib/cleanup.mjs';

const marker = `d1-password-reset-${randomUUID()}`;
const email = `${marker}@d1.invalid`;
const missingEmail = `${marker}-missing@d1.invalid`;
const oldPassword = randomBytes(24).toString('base64url');
const newPassword = randomBytes(24).toString('base64url');

function authRequest(path, body, cookie) {
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
  assert.ok(raw, 'a successful login must set a session cookie');
  return raw.split(';')[0];
}

function responseCapture() {
  return {
    statusCode: 200,
    payload: undefined,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; },
  };
}

function runReset(targetEmail, password) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/admin-reset-password.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADMIN_PASSWORD_RESET_EMAIL: targetEmail,
        ADMIN_PASSWORD_RESET_NEW_PASSWORD: password,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function cleanupFixture(db, userId) {
  if (!userId) return;
  await db.delete(adminAccountAudits).where(or(
    eq(adminAccountAudits.actorUserId, userId),
    eq(adminAccountAudits.subjectUserId, userId),
  )).catch(cleanupFailed);
  await db.delete(verifications).where(eq(verifications.value, userId)).catch(cleanupFailed);
  await db.delete(users).where(eq(users.id, userId)).catch(cleanupFailed);
}

let db;
let userId;
try {
  db = getDb();
  const created = await provisioningAuth.api.signUpEmail({
    body: { name: marker, email, password: oldPassword },
    headers: internalAuthHeaders(),
  });
  userId = created.user.id;

  const [before] = await db
    .select({ name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  assert.deepEqual(before, { name: marker, email, role: 'editor', status: 'active' });
  const [credentialBefore] = await db.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, userId));
  assert.ok(credentialBefore?.password && credentialBefore.password !== oldPassword);

  const oldLogin = await auth.handler(authRequest('/api/auth/sign-in/email', { email, password: oldPassword }));
  assert.equal(oldLogin.status, 200);
  const oldCookie = cookieFrom(oldLogin);
  await authenticatedUser({ headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: oldCookie } });
  const oldSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  assert.ok(oldSessions.length >= 1);

  const tooShort = await runReset(email, 'short');
  assert.equal(tooShort.exitCode, 1);
  assert.equal(tooShort.stdout, '');
  assert.equal(tooShort.stderr, 'ADMIN_PASSWORD_RESET_FAILED');

  const unknown = await runReset(missingEmail, newPassword);
  assert.equal(unknown.exitCode, 1);
  assert.equal(unknown.stdout, '');
  assert.equal(unknown.stderr, 'ADMIN_PASSWORD_RESET_USER_NOT_FOUND');

  const reset = await runReset(email, newPassword);
  assert.equal(reset.exitCode, 0);
  assert.equal(reset.stdout, 'ADMIN_PASSWORD_RESET_COMPLETED');
  assert.equal(reset.stderr, '');

  const revokedSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  assert.equal(revokedSessions.length, 0, 'password reset must revoke all existing sessions');
  await assert.rejects(
    () => authenticatedUser({ headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: oldCookie } }),
    (error) => error?.code === 'UNAUTHORIZED',
  );
  const rejectedOldLogin = await auth.handler(authRequest('/api/auth/sign-in/email', { email, password: oldPassword }));
  assert.equal(rejectedOldLogin.status, 401);

  const newLogin = await auth.handler(authRequest('/api/auth/sign-in/email', { email, password: newPassword }));
  assert.equal(newLogin.status, 200);
  const newCookie = cookieFrom(newLogin);
  const sessionResponse = responseCapture();
  await sessionRoute({ method: 'GET', headers: { host: 'localhost:5173', cookie: newCookie } }, sessionResponse);
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(sessionResponse.payload?.user?.role, 'editor');

  const [after] = await db
    .select({ name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  assert.deepEqual(after, before, 'password reset must preserve account identity and authorization state');
  const [credentialAfter] = await db.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, userId));
  assert.ok(credentialAfter?.password && credentialAfter.password !== oldPassword && credentialAfter.password !== newPassword);

  console.log('DB_ADMIN_PASSWORD_RESET_D1_PROOF=PASS');
} finally {
  if (db) await cleanupFixture(db, userId);
  await closeDb();
}
