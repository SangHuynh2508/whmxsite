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
  finalizeManagedAssetUpload,
  issueManagedAssetUploadIntent,
} from '../server/assets/managed-asset-domain.mjs';
import {
  createPreviewCharacter,
  activateEntityAssetMapping,
  PreviewDomainError,
} from '../server/preview-character-domain.mjs';
import {
  createR2ManagedAssetStorage,
  ManagedAssetError,
  sha256,
} from '../server/assets/r2-managed-assets.mjs';

function requestId() {
  return randomUUID();
}

async function insertUser(tx, marker, role) {
  const id = randomUUID();
  await tx.insert(users).values({
    id,
    name: `${marker}-${role}`,
    email: `${id}@d0b-live.invalid`,
    role,
    status: 'active',
  });
  return id;
}

async function expectError(action, code) {
  await assert.rejects(
    action,
    (error) =>
      (error instanceof PreviewDomainError || error instanceof ManagedAssetError) && error.code === code,
  );
}

async function putViaPresignedUrl(uploadUrl, bytes) {
  const response = await fetch(uploadUrl, { method: 'PUT', body: bytes });
  if (!response.ok) throw new Error(`Presigned upload failed with HTTP ${response.status}.`);
}

async function bodyToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function cleanupDatabaseFixture(db, { ownerId, editorId, entityId }) {
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
let storage;
let ownerId;
let editorId;
let entityId;
const createdObjectKeys = new Set();
let publicDelivery = { reachable: false, status: null };

try {
  db = getDb();
  storage = createR2ManagedAssetStorage();
  assert.equal(storage.prefix, 'admin-dev', 'live proof must use the approved namespace');
  const marker = `d0b-live-${randomUUID()}`;
  const pngA = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 220, g: 30, b: 30 } },
  }).png().toBuffer();
  const pngB = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 30, g: 70, b: 220 } },
  }).png().toBuffer();
  const [before] = await db.execute(sql`
    select
      (select count(*)::int from asset_objects where provenance = 'source_extracted') as source_assets,
      (select count(*)::int from skin_asset_mappings) as skin_mappings
  `);

  await db.transaction(async (tx) => {
    ownerId = await insertUser(tx, marker, 'owner');
    editorId = await insertUser(tx, marker, 'editor');
    const preview = await createPreviewCharacter(tx, {
      actorUserId: editorId,
      requestId: requestId(),
      nameVi: marker,
      manualMetadata: { proof: 'd0b-live' },
    });
    entityId = preview.entityId;
  });

  const firstIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 1,
    assetRole: 'avatar',
    requestedFilename: '../../not-a-storage-key.png',
    requestedProvenance: 'manual_preview',
  });
  assert.match(firstIntent.quarantineObjectKey, /^admin-dev\/quarantine\/uploads\/[0-9a-f-]{36}\/original$/i);
  assert.equal(firstIntent.quarantineObjectKey.includes('not-a-storage-key'), false);
  createdObjectKeys.add(firstIntent.quarantineObjectKey);
  await putViaPresignedUrl(firstIntent.uploadUrl, pngA);

  const first = await finalizeManagedAssetUpload(storage, {
    actorUserId: ownerId,
    requestId: requestId(),
    intentId: firstIntent.id,
  });
  createdObjectKeys.add(first.objectKey);
  assert.match(first.objectKey, /^admin-dev\/manual\/previews\/characters\//);
  assert.equal(first.quarantineCleanup, 'deleted');
  const firstHead = await storage.head(first.objectKey);
  const firstObject = await storage.get(first.objectKey);
  const firstBytes = await bodyToBuffer(firstObject.Body);
  const firstMetadata = await sharp(firstBytes).metadata();
  assert.equal(firstMetadata.format, 'webp');
  assert.equal(firstBytes.length, Number(firstHead.ContentLength));
  assert.equal(new URL(first.publicUrl).search, '', 'delivery URL must not contain credentials');

  const [firstAsset] = await db
    .select({
      id: assetObjects.id,
      objectKey: assetObjects.objectKey,
      hash: assetObjects.contentHash,
      bytes: assetObjects.byteSize,
      mime: assetObjects.mimeType,
      detectedMime: assetObjects.detectedMimeType,
      width: assetObjects.width,
      height: assetObjects.height,
      state: assetObjects.verificationState,
      tier: assetObjects.storageTier,
    })
    .from(assetObjects)
    .where(eq(assetObjects.id, first.assetId));
  assert.equal(firstAsset.objectKey, first.objectKey);
  assert.equal(firstAsset.hash, sha256(firstBytes));
  assert.equal(firstAsset.bytes, firstBytes.length);
  assert.equal(firstAsset.mime, 'image/webp');
  assert.equal(firstAsset.detectedMime, 'image/png');
  assert.equal(firstAsset.width, firstMetadata.width);
  assert.equal(firstAsset.height, firstMetadata.height);
  assert.equal(firstAsset.state, 'verified');
  assert.equal(firstAsset.tier, 'public_delivery');

  try {
    const publicResponse = await fetch(first.publicUrl);
    publicDelivery = { reachable: publicResponse.ok, status: publicResponse.status };
    if (publicResponse.ok) {
      const publicBytes = Buffer.from(await publicResponse.arrayBuffer());
      assert.equal((await sharp(publicBytes).metadata()).format, 'webp');
    }
  } catch {
    publicDelivery = { reachable: false, status: null };
  }

  await expectError(
    () => activateEntityAssetMapping(db, {
      actorUserId: editorId,
      requestId: requestId(),
      entityId,
      expectedRevision: first.revision,
      assetRole: 'avatar',
      assetId: first.assetId,
      selectionMode: 'manual',
      sourceState: 'no_source',
    }),
    'FORBIDDEN',
  );

  const pendingAssetId = randomUUID();
  await db.insert(assetObjects).values({
    id: pendingAssetId,
    storageProvider: 'r2',
    objectKey: `admin-dev/quarantine/pending/${pendingAssetId}`,
    contentHash: '0'.repeat(64),
    provenance: 'manual_preview',
    storageTier: 'public_delivery',
    verificationState: 'pending',
    createdByUserId: ownerId,
    metadata: { proof: marker },
  });
  await expectError(
    () => activateEntityAssetMapping(db, {
      actorUserId: ownerId,
      requestId: requestId(),
      entityId,
      expectedRevision: first.revision,
      assetRole: 'card',
      assetId: pendingAssetId,
      selectionMode: 'manual',
      sourceState: 'no_source',
    }),
    'ASSET_NOT_VERIFIED',
  );

  const secondIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: first.revision,
    assetRole: 'avatar',
    requestedFilename: 'replacement.png',
    requestedProvenance: 'manual_preview',
  });
  createdObjectKeys.add(secondIntent.quarantineObjectKey);
  await putViaPresignedUrl(secondIntent.uploadUrl, pngB);
  const second = await finalizeManagedAssetUpload(storage, {
    actorUserId: ownerId,
    requestId: requestId(),
    intentId: secondIntent.id,
  });
  createdObjectKeys.add(second.objectKey);
  assert.notEqual(second.objectKey, first.objectKey);
  assert.equal((await storage.head(first.objectKey)).ContentLength, firstBytes.length, 'replacement must not overwrite old object');

  const [mapping] = await db
    .select({ activeAssetId: entityAssetMappings.activeAssetId })
    .from(entityAssetMappings)
    .where(and(eq(entityAssetMappings.entityId, entityId), eq(entityAssetMappings.assetRole, 'avatar')));
  assert.equal(mapping.activeAssetId, second.assetId);
  const [entity] = await db
    .select({ revision: managedEntities.revision })
    .from(managedEntities)
    .where(eq(managedEntities.id, entityId));
  assert.equal(entity.revision, 3);
  const auditRows = await db
    .select({ oldValue: editHistory.oldValue, newValue: editHistory.newValue })
    .from(editHistory)
    .where(and(eq(editHistory.entityId, entityId), eq(editHistory.fieldName, 'entity_asset_mapping.active_asset')));
  assert.equal(auditRows.length, 2);
  assert.equal(auditRows[1].oldValue.activeAssetId, first.assetId);
  assert.equal(auditRows[1].newValue.activeAssetId, second.assetId);

  await expectError(
    () => issueManagedAssetUploadIntent(storage, {
      actorUserId: editorId,
      requestId: requestId(),
      entityId,
      expectedRevision: 2,
      assetRole: 'card',
      requestedProvenance: 'manual_preview',
    }),
    'VERSION_CONFLICT',
  );
  await expectError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: firstIntent.id }),
    'UPLOAD_NOT_PENDING',
  );

  const malformedIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 3,
    assetRole: 'card',
    requestedFilename: 'fake.png',
    requestedProvenance: 'manual_preview',
  });
  createdObjectKeys.add(malformedIntent.quarantineObjectKey);
  await putViaPresignedUrl(malformedIntent.uploadUrl, Buffer.from('<html>not an image</html>'));
  await expectError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: malformedIntent.id }),
    'OBJECT_INVALID',
  );

  const wrongIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 3,
    assetRole: 'card',
    requestedProvenance: 'manual_preview',
  });
  const otherIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 3,
    assetRole: 'drawing',
    requestedProvenance: 'manual_preview',
  });
  createdObjectKeys.add(wrongIntent.quarantineObjectKey);
  createdObjectKeys.add(otherIntent.quarantineObjectKey);
  await putViaPresignedUrl(otherIntent.uploadUrl, pngA);
  await expectError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: wrongIntent.id }),
    'OBJECT_NOT_FOUND',
  );

  const expiredIntent = await issueManagedAssetUploadIntent(storage, {
    actorUserId: editorId,
    requestId: requestId(),
    entityId,
    expectedRevision: 3,
    assetRole: 'card',
    requestedProvenance: 'manual_preview',
  });
  await db
    .update(assetUploadIntents)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(assetUploadIntents.id, expiredIntent.id));
  await expectError(
    () => finalizeManagedAssetUpload(storage, { actorUserId: ownerId, requestId: requestId(), intentId: expiredIntent.id }),
    'UPLOAD_EXPIRED',
  );

  const [after] = await db.execute(sql`
    select
      (select count(*)::int from asset_objects where provenance = 'source_extracted') as source_assets,
      (select count(*)::int from skin_asset_mappings) as skin_mappings
  `);
  assert.equal(Number(after.source_assets), Number(before.source_assets));
  assert.equal(Number(after.skin_mappings), Number(before.skin_mappings));

  console.log(JSON.stringify({
    test: 'd0b-live-managed-asset-pipeline',
    status: 'PASS',
    bucketClass: 'shared_with_isolated_admin_dev_namespace',
    realPresignedPut: true,
    quarantineVerification: true,
    webpVerified: true,
    publicDelivery,
    immutableReplacement: true,
    revisionAndAudit: true,
    securityProofs: {
      malformedRejected: true,
      staleRevisionRejected: true,
      editorActivationRejected: true,
      finalizedIntentRejected: true,
      expiredIntentRejected: true,
      exactObjectBindingRejected: true,
      pendingAssetRejected: true,
    },
  }));
} finally {
  let objectCleanupFailure = false;
  if (storage) {
    for (const key of createdObjectKeys) {
      try {
        await storage.remove(key);
      } catch {
        objectCleanupFailure = true;
      }
    }
  }
  let databaseCleanupFailure = false;
  if (db) {
    try {
      await cleanupDatabaseFixture(db, { ownerId, editorId, entityId });
    } catch {
      databaseCleanupFailure = true;
    }
  }
  if (storage && !objectCleanupFailure) {
    for (const key of createdObjectKeys) {
      try {
        await storage.head(key);
        objectCleanupFailure = true;
      } catch (error) {
        if (Number(error?.$metadata?.httpStatusCode) !== 404) objectCleanupFailure = true;
      }
    }
  }
  await closeDb();
  if (objectCleanupFailure || databaseCleanupFailure) {
    throw new Error('D0B live proof cleanup did not complete.');
  }
}
