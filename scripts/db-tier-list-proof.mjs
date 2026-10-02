// scripts/db-tier-list-proof.mjs — exercises the Tier List domain against the DB in .env.local (development).
// Leaves no tier_lists row (the proof list is deleted at the end); its managed entity + edit_history stay by design.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import { createTierList, deleteTierList, getTierList, listTierLists, saveTierList } from '../server/tier-lists/tier-list-admin.mjs';

const db = getDb();
const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1);
assert.ok(owner, 'needs an owner account');
const slug = `zz-proof-${randomUUID().slice(0, 8)}`;
const expectStatus = async (promise, status) => { await assert.rejects(promise, (e) => e.status === status); };

const created = await createTierList(db, { slug, title: 'Proof', actorUserId: owner.id });
assert.equal(created.status, 'draft');
await expectStatus(createTierList(db, { slug, title: 'Again', actorUserId: owner.id }), 409); // SLUG_TAKEN
await expectStatus(createTierList(db, { slug: 'Bad Slug', title: 'x', actorUserId: owner.id }), 422);

const doc = { ...created.doc, solo: { note: '', tiers: [{ label: 'S', description: 'Top', joinAbove: false, entries: [{ characterId: 'W0182', zhizhi: 1 }] }] } };
const saved = await saveTierList(db, slug, { expectedRevision: created.revision, doc, status: 'published', actorUserId: owner.id });
assert.equal(saved.revision, created.revision + 1);
assert.deepEqual(saved.doc.solo.tiers[0].entries, [{ characterId: 'W0182', zhizhi: 1 }]);
await expectStatus(saveTierList(db, slug, { expectedRevision: created.revision, doc, actorUserId: owner.id }), 409); // stale
await expectStatus(saveTierList(db, slug, { expectedRevision: saved.revision, doc: { ...doc, title: '' }, actorUserId: owner.id }), 422);
assert.ok((await listTierLists(db)).some((l) => l.slug === slug && l.title === 'Proof'));
await expectStatus(deleteTierList(db, slug, { expectedRevision: saved.revision, actorUserId: owner.id, actorRole: 'editor' }), 403);
await deleteTierList(db, slug, { expectedRevision: saved.revision, actorUserId: owner.id, actorRole: 'owner' });
await expectStatus(getTierList(db, slug), 404);
console.log('tier list proof: ok', slug);
process.exit(0);
