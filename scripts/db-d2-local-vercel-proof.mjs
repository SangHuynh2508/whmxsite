import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';

import { cleanupFailed } from './lib/cleanup.mjs';

const baseUrl = process.env.D2_BASE_URL || 'http://localhost:3003';
const marker = `d2-http-${randomUUID()}`;
const email = `${marker}@d2.invalid`;
const password = randomBytes(24).toString('base64url');
let db;
let fixtureUserId;
let characterId;
let originalRevision;
let originalOverrides = [];
let entityId;
let schema;

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init });
}

function cookieFrom(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = cookies[0] || response.headers.get('set-cookie');
  assert.ok(raw);
  return raw.split(';')[0];
}

try {
  const [{ provisioningAuth, internalAuthHeaders }, { getDb, closeDb }, loadedSchema] = await Promise.all([
    import('../server/auth.mjs'),
    import('../db/client.mjs'),
    import('../db/schema/index.mjs'),
  ]);
  schema = loadedSchema;
  db = getDb();
  const created = await provisioningAuth.api.signUpEmail({ body: { name: marker, email, password }, headers: internalAuthHeaders() });
  fixtureUserId = created.user.id;

  const login = await request('/api/auth/sign-in/email', { method: 'POST', headers: { origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const authHeaders = { cookie };
  const list = await request('/api/admin/characters', { headers: authHeaders });
  assert.equal(list.status, 200);
  const listPayload = await list.json();
  assert.equal(listPayload.characters.length, 133);
  characterId = listPayload.characters[0].characterId;
  const detail = await request(`/api/admin/characters/${characterId}`, { headers: authHeaders });
  assert.equal(detail.status, 200);
  const payload = await detail.json();
  originalRevision = payload.character.revision;
  const [managed] = await db.select({ id: schema.managedEntities.id }).from(schema.managedEntities).where(and(eq(schema.managedEntities.entityType, 'character'), eq(schema.managedEntities.sourceKey, characterId)));
  entityId = managed.id;
  originalOverrides = await db.select().from(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, entityId));

  const unauthenticated = await request(`/api/admin/characters/${characterId}`, { method: 'PATCH', headers: { origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: originalRevision, changes: { nameVi: 'must reject' } }) });
  assert.equal(unauthenticated.status, 401);
  const write = await request(`/api/admin/characters/${characterId}`, { method: 'PATCH', headers: { ...authHeaders, origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: originalRevision, changes: { nameVi: `${marker} override` } }) });
  assert.equal(write.status, 200);
  const fresh = await request(`/api/admin/characters/${characterId}`, { headers: authHeaders });
  const freshPayload = await fresh.json();
  assert.equal(freshPayload.character.nameVi.value, `${marker} override`);
  const stale = await request(`/api/admin/characters/${characterId}`, { method: 'PATCH', headers: { ...authHeaders, origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: originalRevision, changes: { nameVi: 'stale' } }) });
  assert.equal(stale.status, 409);
  const selfAssert = await request(`/api/admin/characters/${characterId}`, { method: 'PATCH', headers: { ...authHeaders, origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: freshPayload.character.revision, changes: { nameVi: 'role-bypass' }, role: 'owner' }) });
  assert.equal(selfAssert.status, 422);
  const protectedField = await request(`/api/admin/characters/${characterId}`, { method: 'PATCH', headers: { ...authHeaders, origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: freshPayload.character.revision, changes: { characterId: 'forbidden' } }) });
  assert.equal(protectedField.status, 422);
  const spa = await request('/#/admin/characters');
  assert.equal(spa.status, 200);
  assert.match(await spa.text(), /Character Calculator/);
  console.log(JSON.stringify({ test: 'd2-local-vercel-proof', status: 'PASS', characters: listPayload.characters.length, staleStatus: stale.status, selfAssertStatus: selfAssert.status, protectedStatus: protectedField.status, spaStatus: spa.status }));
} finally {
  if (db && entityId) {
    await db.delete(schema.fieldOverrides).where(eq(schema.fieldOverrides.entityId, entityId)).catch(cleanupFailed);
    if (originalOverrides.length) await db.insert(schema.fieldOverrides).values(originalOverrides).catch(cleanupFailed);
    await db.update(schema.managedEntities).set({ revision: originalRevision, editedByUserId: null, updatedAt: new Date() }).where(eq(schema.managedEntities.id, entityId)).catch(cleanupFailed);
  }
  if (db && fixtureUserId) {
    await db.execute(sql`delete from edit_history where actor_user_id = ${fixtureUserId}`).catch(cleanupFailed);
    await db.delete((await import('../db/schema/auth.mjs')).users).where(eq((await import('../db/schema/auth.mjs')).users.id, fixtureUserId)).catch(cleanupFailed);
  }
  const { closeDb } = await import('../db/client.mjs');
  await closeDb();
}
