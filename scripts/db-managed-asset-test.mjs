import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';
import sharp from 'sharp';

import { closeDb, getDb } from '../db/client.mjs';
import {
  assetObjects,
  assetUploadIntents,
  characterPublicationStates,
  editHistory,
  entityAssetMappings,
  managedEntities,
  previewCharacters,
  users,
} from '../db/schema/index.mjs';
import {
  activateEntityAssetMapping,
  createPreviewCharacter,
  PreviewDomainError,
} from '../server/preview-character-domain.mjs';
import {
  finalizeManagedAssetUpload,
  issueManagedAssetUploadIntent,
} from '../server/assets/managed-asset-domain.mjs';
import { ManagedAssetError } from '../server/assets/r2-managed-assets.mjs';

class FakeStorage {
  constructor() {
    this.prefix = 'admin-dev';
    this.publicBaseUrl = 'https://managed-assets.invalid';
    this.objects = new Map();
  }

  async presignPut({ key }) {
    return `https://upload.invalid/${encodeURIComponent(key)}`;
  }

  async head(key) {
    const body = this.objects.get(key);
    if (!body) throw new Error('not found');
    return { ContentLength: body.length, ContentType: key.endsWith('.webp') ? 'image/webp' : 'image/png' };
  }

  async get(key) {
    const body = this.objects.get(key);
    if (!body) throw new Error('not found');
    return { Body: (async function* stream() { yield body; })() };
  }

  async put({ key, body }) {
    assert.equal(this.objects.has(key), false, 'delivery keys must never overwrite an existing object');
    this.objects.set(key, Buffer.from(body));
  }

  async remove(key) {
    this.objects.delete(key);
  }
}

function requestId() {
  return randomUUID();
}

async function insertUser(tx, marker, role) {
  const id = randomUUID();
  await tx.insert(users).values({
    id,
    name: `${marker}-${role}`,
    email: `${id}@d0b.invalid`,
    role,
    status: 'active',
  });
  return id;
}

async function expectDomainError(action, code) {
  await assert.rejects(
    action,
    (error) => (error instanceof PreviewDomainError || error instanceof ManagedAssetError) && error.code === code,
  );
}

async function cleanupFixture(db, { ownerId, editorId, entityId }) {
  if (!db) return;
  await db.transaction(async (tx) => {
    if (entityId) {
      await tx.delete(entityAssetMappings).where(eq(entityAssetMappings.entityId, entityId));
      await tx.delete(assetUploadIntents).where(eq(assetUploadIntents.entityId, entityId));
      await tx.delete(editHistory).where(eq(editHistory.entityId, entityId));
      await tx.delete(characterPublicationStates).where(eq(characterPublicationStates.entityId, entityId));
      await tx.delete(previewCharacters).where(eq(previewCharacters.entityId, entityId));
      await tx.delete(managedEntities).where(eq(managedEntities.id, entityId));
    }
    if (ownerId) await tx.delete(assetObjects).where(eq(assetObjects.createdByUserId, ownerId));
    if (ownerId) await tx.delete(users).where(eq(users.id, ownerId));
    if (editorId) await tx.delete(users).where(eq(users.id, editorId));
  });
}

let db;
let ownerId;
let editorId;
let entityId;
try {
  db = getDb();
  const marker = `d0b-managed-${randomUUID()}`;
  const storage = new FakeStorage();
  const pngA = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 220, g: 30, b: 30 } } }).png().toBuffer();
  const pngB = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 30, g: 70, b: 220 } } }).png().toBuffer();
  const beforeSource = await db.execute(sql`select count(*)::int as count from asset_objects where provenance = 'source_extracted'`);
  const beforeSkinMappings = await db.execute(sql`select count(*)::int as count from skin_asset_mappings`);
  let firstIntent;
  let firstAsset;
  let secondIntent;

  await db.transaction(async (tx) => {
    ownerId = await insertUser(tx, marker, 'owner');
    editorId = await insertUser(tx, marker, 'editor');
    const preview = await createPreviewCharacter(tx, {
      actorUserId: editorId,
      requestId: requestId(),
      nameVi: marker,
      manualMetadata: { proof: 'd0b' },
    });
    entityId = preview.entityId;
  });

  firstIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 1,
    assetRole: 'avatar',
    requestedFilename: '../../source-secret.png',
    requestedProvenance: 'manual_preview',
  });
  assert.match(firstIntent.quarantineObjectKey, /^admin-dev\/quarantine\/uploads\/[0-9a-f-]{36}\/original$/i);
  assert.equal(firstIntent.quarantineObjectKey.includes('source-secret'), false);
  storage.objects.set(firstIntent.quarantineObjectKey, pngA);

  await expectDomainError(
    () => issueManagedAssetUploadIntent(storage, {
      actorUserId: randomUUID(),
      requestId: requestId(),
      entityId,
      expectedRevision: 1,
      assetRole: 'avatar',
      requestedProvenance: 'manual_preview',
    }),
    'FORBIDDEN',
  );

  await expectDomainError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: editorId, requestId: requestId(), intentId: firstIntent.id }),
    'FORBIDDEN',
  );
  assert.equal(storage.objects.has(firstIntent.quarantineObjectKey), true, 'editor rejection must not consume quarantine object');

  const missingIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 1,
    assetRole: 'avatar',
    requestedProvenance: 'manual_preview',
  });
  await expectDomainError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: missingIntent.id }),
    'OBJECT_NOT_FOUND',
  );

  const badIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 1,
    assetRole: 'avatar',
    requestedFilename: 'fake.png',
    requestedProvenance: 'manual_preview',
  });
  storage.objects.set(badIntent.quarantineObjectKey, Buffer.from('<html>not an image</html>'));
  await expectDomainError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: badIntent.id }),
    'OBJECT_INVALID',
  );
  const [rejectedBadIntent] = await db.select({ status: assetUploadIntents.status }).from(assetUploadIntents).where(eq(assetUploadIntents.id, badIntent.id));
  assert.equal(rejectedBadIntent.status, 'rejected');

  const firstResult = await finalizeManagedAssetUpload(storage, {
    actorUserId: ownerId,
    requestId: requestId(),
    intentId: firstIntent.id,
  });
  firstAsset = firstResult.assetId;
  assert.match(firstResult.objectKey, /^admin-dev\/manual\/previews\/characters\//);
  assert.equal(storage.objects.has(firstIntent.quarantineObjectKey), false, 'successful finalize cleans only its quarantine object');
  assert.equal(storage.objects.has(firstResult.objectKey), true);

  const pendingAssetId = randomUUID();
  await db.insert(assetObjects).values({
    id: pendingAssetId,
    storageProvider: 'r2',
    objectKey: `admin-dev/quarantine/proof/${pendingAssetId}`,
    contentHash: '0'.repeat(64),
    provenance: 'manual_preview',
    storageTier: 'public_delivery',
    verificationState: 'pending',
    createdByUserId: ownerId,
    metadata: { proof: marker },
  });
  await expectDomainError(
    () => activateEntityAssetMapping(db, {
      actorUserId: ownerId,
      requestId: requestId(),
      entityId,
      expectedRevision: firstResult.revision,
      assetRole: 'card',
      assetId: pendingAssetId,
      sourceState: 'no_source',
      selectionMode: 'manual',
    }),
    'ASSET_NOT_VERIFIED',
  );

  await expectDomainError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: firstIntent.id }),
    'UPLOAD_NOT_PENDING',
  );

  secondIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: firstResult.revision,
    assetRole: 'avatar',
    requestedFilename: 'replacement.webp',
    requestedProvenance: 'manual_preview',
  });
  storage.objects.set(secondIntent.quarantineObjectKey, pngB);
  const secondResult = await finalizeManagedAssetUpload(storage, {
    actorUserId: ownerId,
    requestId: requestId(),
    intentId: secondIntent.id,
  });
  assert.notEqual(secondResult.objectKey, firstResult.objectKey, 'replacement must use an immutable new key');
  assert.equal(storage.objects.has(firstResult.objectKey), true, 'old delivery object remains retained');
  assert.equal(storage.objects.has(secondResult.objectKey), true);

  const [mapping] = await db
    .select({ activeAssetId: entityAssetMappings.activeAssetId })
    .from(entityAssetMappings)
    .where(and(eq(entityAssetMappings.entityId, entityId), eq(entityAssetMappings.assetRole, 'avatar')));
  assert.equal(mapping.activeAssetId, secondResult.assetId);
  const assets = await db.select({ id: assetObjects.id, key: assetObjects.objectKey, state: assetObjects.verificationState }).from(assetObjects).where(eq(assetObjects.createdByUserId, ownerId));
  assert.equal(assets.some((asset) => asset.id === firstAsset), true);
  assert.equal(assets.some((asset) => asset.id === secondResult.assetId), true);
  const auditRows = await db.select({ fieldName: editHistory.fieldName }).from(editHistory).where(and(eq(editHistory.entityId, entityId), eq(editHistory.actorUserId, ownerId)));
  assert.equal(auditRows.filter((row) => row.fieldName === 'entity_asset_mapping.active_asset').length, 2);
  const [entity] = await db.select({ revision: managedEntities.revision }).from(managedEntities).where(eq(managedEntities.id, entityId));
  assert.equal(entity.revision, 3);

  const oversizedIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 3,
    assetRole: 'avatar',
    requestedProvenance: 'manual_preview',
  });
  storage.objects.set(oversizedIntent.quarantineObjectKey, Buffer.alloc(4 * 1024 * 1024 + 1, 1));
  await expectDomainError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: oversizedIntent.id }),
    'OBJECT_TOO_LARGE',
  );

  const staleIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 2,
    assetRole: 'card',
    requestedProvenance: 'manual_preview',
  }).catch((error) => error);
  assert.equal(staleIntent.code, 'VERSION_CONFLICT');

  const [sourceAfter] = await db.execute(sql`select count(*)::int as count from asset_objects where provenance = 'source_extracted'`);
  const [skinMappingsAfter] = await db.execute(sql`select count(*)::int as count from skin_asset_mappings`);
  assert.equal(Number(sourceAfter.count), Number(beforeSource[0].count));
  assert.equal(Number(skinMappingsAfter.count), Number(beforeSkinMappings[0].count));

  console.log(JSON.stringify({
    test: 'd0b-managed-asset-pipeline',
    status: 'PASS',
    realR2Put: false,
    fakeUploadIntent: true,
    immutableReplacement: true,
    oldAssetRetained: true,
    sourceAssetsUntouched: true,
    editorActivationRejected: true,
    malformedImageRejected: true,
    counts: { assetsCreated: 2, revisions: 3 },
  }));

} finally {
  if (db) {
    try {
      await cleanupFixture(db, { ownerId, editorId, entityId });
    } catch {
      // Preserve the primary proof failure; the cleanup issue is reported by the next scoped check.
    }
  }
  await closeDb();
}
