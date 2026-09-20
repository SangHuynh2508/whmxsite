import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString('base64url');
process.env.BETTER_AUTH_ALLOWED_HOSTS ??= 'localhost:5173,localhost:3000';

function capture() {
  return { statusCode: 200, body: undefined, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function bodyRequest(method, body, cookie, query = {}) {
  return { method, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', ...(cookie ? { cookie } : {}) }, body, query };
}

const marker = `d0c-api-${randomUUID()}`;
const email = `${marker}@d0c.invalid`;
const password = 'D0C-API-Fixture-Password-Only';
let db;
let owner;
let entityId;
try {
  const [{ auth, internalAuthHeaders, provisioningAuth }, dbClient, schema, accountDomain, previewRoute, detailRoute, adminApi] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/index.mjs'),
    import('../server/admin/accounts/admin-account-domain.mjs'),
    import('../api/admin/previews/index.js'),
    import('../api/admin/previews/[id].js'),
    import('../server/admin-api.mjs'),
  ]);
  db = dbClient.getDb();
  const existingOwners = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'owner'));
  if (existingOwners.length) {
    const created = await provisioningAuth.api.signUpEmail({
      body: { name: marker, email, password },
      headers: internalAuthHeaders(),
    });
    [owner] = await db
      .update(schema.users)
      .set({ role: 'owner', status: 'active', updatedAt: new Date() })
      .where(eq(schema.users.id, created.user.id))
      .returning();
  } else {
    owner = await accountDomain.bootstrapFirstOwner({ name: marker, email, password, requestId: randomUUID() });
  }
  const login = await auth.handler(new Request('http://localhost:5173/api/auth/sign-in/email', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
    body: JSON.stringify({ email, password }),
  }));
  assert.equal(login.status, 200);
  const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [];
  const cookieHeader = (cookies[0] || login.headers.get('set-cookie')).split(';')[0];

  const createResponse = capture();
  await previewRoute.default(await bodyRequest('POST', { nameVi: `${marker}-preview`, claimedRawId: 'CLAIM-01', claimedRawIdEvidence: { note: 'fixture' } }, cookieHeader), createResponse);
  assert.equal(createResponse.statusCode, 201);
  entityId = createResponse.body.entityId;
  assert.equal(createResponse.body.revision, 1);

  const listResponse = capture();
  await previewRoute.default(await bodyRequest('GET', undefined, cookieHeader, { q: marker }), listResponse);
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.previews.length, 1);
  assert.equal(listResponse.body.previews[0].origin, 'manual_preview');

  const detailResponse = capture();
  await detailRoute.default(await bodyRequest('GET', undefined, cookieHeader, { id: entityId }), detailResponse);
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.body.preview.revision, 1);

  const firstEditResponse = capture();
  await detailRoute.default(await bodyRequest('PATCH', { expectedRevision: 1, patch: { nameVi: `${marker}-edited` }, requestId: randomUUID() }, cookieHeader, { id: entityId }), firstEditResponse);
  assert.equal(firstEditResponse.statusCode, 200);
  const staleResponse = capture();
  await detailRoute.default(await bodyRequest('PATCH', { expectedRevision: 1, patch: { nameVi: 'must not win' }, requestId: randomUUID() }, cookieHeader, { id: entityId }), staleResponse);
  assert.equal(staleResponse.statusCode, 409);

  const stateResponse = capture();
  await detailRoute.default(await bodyRequest('PATCH', { expectedRevision: 2, lifecycle: 'unreleased', visibility: 'preview', requestId: randomUUID() }, cookieHeader, { id: entityId }), stateResponse);
  assert.equal(stateResponse.statusCode, 200);
  console.log('DB_PREVIEW_ADMIN_API_D0C_TEST=PASS');
} finally {
  if (db && entityId) {
    await db.execute(sql`delete from edit_history where entity_id = ${entityId}`).catch(() => undefined);
    await db.execute(sql`delete from character_publication_states where entity_id = ${entityId}`).catch(() => undefined);
    await db.execute(sql`delete from preview_characters where entity_id = ${entityId}`).catch(() => undefined);
    await db.execute(sql`delete from managed_entities where id = ${entityId}`).catch(() => undefined);
  }
  if (db && owner) {
    await db.execute(sql`delete from admin_account_audits where actor_user_id = ${owner.id} or subject_user_id = ${owner.id}`).catch(() => undefined);
    await db.execute(sql`delete from users where id = ${owner.id}`).catch(() => undefined);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
