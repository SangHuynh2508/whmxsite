import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

import { eq, or } from 'drizzle-orm';

import { internalAuthHeaders, provisioningAuth, auth } from '../server/auth.mjs';
import { AdminAccountDomainError, bootstrapFirstOwner } from '../server/admin/accounts/admin-account-domain.mjs';
import { authenticatedUser } from '../server/admin-api.mjs';
import sessionRoute from '../api/admin/session.js';
import { closeDb, getDb } from '../db/client.mjs';
import { accounts, adminAccountAudits, sessions, users, verifications } from '../db/schema/auth.mjs';

import { cleanupFailed } from './lib/cleanup.mjs';

const marker = `d1-bootstrap-proof-${randomUUID()}`;
const candidateEmail = `${marker}-candidate@d1.invalid`;
const ownerEmail = `${marker}-owner@d1.invalid`;
const password = randomBytes(24).toString('base64url');

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
  assert.ok(raw, 'the login response must set a session cookie');
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

function runBootstrap(name, email) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/admin-bootstrap-owner.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADMIN_BOOTSTRAP_NAME: name,
        ADMIN_BOOTSTRAP_EMAIL: email,
        ADMIN_BOOTSTRAP_PASSWORD: password,
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

async function cleanupUser(db, userId, email) {
  if (userId) {
    await db.delete(adminAccountAudits).where(or(
      eq(adminAccountAudits.actorUserId, userId),
      eq(adminAccountAudits.subjectUserId, userId),
    )).catch(cleanupFailed);
    await db.delete(users).where(eq(users.id, userId)).catch(cleanupFailed);
  }
  await db.delete(verifications).where(eq(verifications.identifier, email)).catch(cleanupFailed);
}

let db;
let candidateId;
let ownerId;
try {
  db = getDb();
  const owners = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner'));
  assert.equal(owners.length, 0, 'the first-owner proof requires no pre-existing owner');

  // This reproduces Better Auth's duplicate-email protection with generated
  // credentials only. It must not be mistaken for a newly persisted user.
  const candidate = await provisioningAuth.api.signUpEmail({
    body: { name: `${marker}-candidate`, email: candidateEmail, password },
    headers: internalAuthHeaders(),
  });
  candidateId = candidate.user.id;
  await assert.rejects(
    () => bootstrapFirstOwner({
      name: `${marker}-candidate`, email: candidateEmail, password, requestId: randomUUID(),
    }),
    (error) => error instanceof AdminAccountDomainError && error.code === 'DUPLICATE_EMAIL',
  );
  const [candidateRow] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, candidateId));
  assert.deepEqual(candidateRow, { role: 'editor', status: 'active' });
  await cleanupUser(db, candidateId, candidateEmail);
  candidateId = undefined;

  const firstBootstrap = await runBootstrap(`${marker}-owner`, ownerEmail);
  assert.equal(firstBootstrap.exitCode, 0);
  assert.equal(firstBootstrap.stdout, 'OWNER_BOOTSTRAP_COMPLETED');
  assert.equal(firstBootstrap.stderr, '');

  const [owner] = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.email, ownerEmail));
  assert.ok(owner?.id, 'the first bootstrap must create one credential user');
  ownerId = owner.id;
  assert.equal(owner.role, 'owner');
  assert.equal(owner.status, 'active');

  const [credential] = await db.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, ownerId));
  assert.ok(credential?.password && credential.password !== password, 'Better Auth must store a password hash');
  const bootstrapSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, ownerId));
  assert.equal(bootstrapSessions.length, 0, 'bootstrap must not create a session');

  const login = await auth.handler(authRequest('/api/auth/sign-in/email', { email: ownerEmail, password }));
  assert.equal(login.status, 200);
  const ownerCookie = cookieFrom(login);
  const authenticated = await authenticatedUser({
    headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: ownerCookie },
  });
  assert.equal(authenticated.id, ownerId);
  assert.equal(authenticated.role, 'owner');

  const sessionResponse = responseCapture();
  await sessionRoute({ method: 'GET', headers: { host: 'localhost:5173', cookie: ownerCookie } }, sessionResponse);
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(sessionResponse.payload?.user?.role, 'owner');

  const logout = await auth.handler(authRequest('/api/auth/sign-out', {}, ownerCookie));
  assert.equal(logout.status, 200);
  await assert.rejects(
    () => authenticatedUser({ headers: { host: 'localhost:5173', origin: 'http://localhost:5173', cookie: ownerCookie } }),
    (error) => error?.code === 'UNAUTHORIZED',
  );

  const secondBootstrap = await runBootstrap(`${marker}-owner`, ownerEmail);
  assert.equal(secondBootstrap.exitCode, 1);
  assert.equal(secondBootstrap.stdout, '');
  assert.equal(secondBootstrap.stderr, 'OWNER_BOOTSTRAP_REFUSED');

  console.log('DB_OWNER_BOOTSTRAP_D1_PROOF=PASS');
} finally {
  if (db) {
    await cleanupUser(db, candidateId, candidateEmail);
    await cleanupUser(db, ownerId, ownerEmail);
  }
  await closeDb();
}
