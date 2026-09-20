import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../../db/client.mjs';
import {
  assetObjects,
  assetUploadIntents,
  managedEntities,
  users,
} from '../../db/schema/index.mjs';
import {
  activateEntityAssetMapping,
  issueAssetUploadIntent,
  PreviewDomainError,
} from '../preview-characters/preview-character-domain.mjs';
import {
  ManagedAssetError,
  deliveryObjectKey,
  inspectAndOptimizeImage,
  newDeliveryAssetId,
  publicDeliveryUrl,
  quarantineObjectKey,
  readVerifiedUploadObject,
} from './r2-managed-assets.mjs';

const finalizeSchema = z.object({
  actorUserId: z.string().uuid(),
  requestId: z.string().uuid(),
  intentId: z.string().uuid(),
  acknowledgePublicPlaceholder: z.boolean().default(false),
});

export async function issueManagedAssetUploadIntent(storage, rawInput, db = getDb()) {
  let result;
  try {
    result = await db.transaction((tx) =>
      issueAssetUploadIntent(tx, rawInput, { quarantinePrefix: storage.prefix }),
    );
    const uploadUrl = await storage.presignPut({ key: result.quarantineObjectKey });
    return { ...result, uploadUrl, uploadUrlExpiresInSeconds: 900 };
  } catch (error) {
    if (result?.id) await markRejected(db, result.id, 'PRESIGN_FAILED');
    if (error instanceof ManagedAssetError || error instanceof PreviewDomainError) throw error;
    throw new ManagedAssetError('PRESIGN_FAILED', 'The upload permission could not be created.');
  }
}

function domainError(code, message) {
  throw new PreviewDomainError(code, message);
}

async function requireActiveActor(tx, actorUserId) {
  const [actor] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, actorUserId));
  if (!actor || actor.status !== 'active') domainError('FORBIDDEN', 'An active authenticated user is required.');
  return actor;
}

async function markRejected(db, intentId, reason) {
  try {
    await db
      .update(assetUploadIntents)
      .set({ status: 'rejected', failureReason: reason.slice(0, 120) })
      .where(and(eq(assetUploadIntents.id, intentId), eq(assetUploadIntents.status, 'issued')));
  } catch {
    // A failed cleanup/status update must not replace the generic upload error.
  }
}

export async function finalizeManagedAssetUpload(storage, rawInput, db = getDb()) {
  const input = finalizeSchema.parse(rawInput);
  let finalKey;
  let quarantineKey;
  try {
    const intent = await db.transaction(async (tx) => {
      const actor = await requireActiveActor(tx, input.actorUserId);
      if (actor.role !== 'owner') domainError('FORBIDDEN', 'Only an owner can finalize and activate a managed asset.');
      const [row] = await tx
        .select({
          id: assetUploadIntents.id,
          entityId: assetUploadIntents.entityId,
          entityType: assetUploadIntents.entityType,
          assetRole: assetUploadIntents.assetRole,
          requestedProvenance: assetUploadIntents.requestedProvenance,
          quarantineObjectKey: assetUploadIntents.quarantineObjectKey,
          maxBytes: assetUploadIntents.maxBytes,
          expectedRevision: assetUploadIntents.expectedRevision,
          status: assetUploadIntents.status,
          expiresAt: assetUploadIntents.expiresAt,
          createdByUserId: assetUploadIntents.createdByUserId,
          entityRevision: managedEntities.revision,
        })
        .from(assetUploadIntents)
        .innerJoin(managedEntities, eq(managedEntities.id, assetUploadIntents.entityId))
        .where(eq(assetUploadIntents.id, input.intentId));
      if (!row) domainError('NOT_FOUND', 'Upload intent was not found.');
      if (row.entityType !== 'preview_character') domainError('VALIDATION_ERROR', 'Only preview Character assets are supported in D0B.');
      if (row.status !== 'issued') domainError('UPLOAD_NOT_PENDING', 'The upload intent is no longer pending.');
      if (row.expiresAt <= new Date()) domainError('UPLOAD_EXPIRED', 'The upload intent has expired.');
      if (row.entityRevision !== row.expectedRevision) domainError('VERSION_CONFLICT', 'The preview Character changed after the upload intent was issued.');

      quarantineKey = quarantineObjectKey(storage.prefix, row.id);
      if (row.quarantineObjectKey !== quarantineKey) domainError('VALIDATION_ERROR', 'The upload intent namespace is invalid.');
      const { body } = await readVerifiedUploadObject(storage, quarantineKey, row.maxBytes);
      const inspected = await inspectAndOptimizeImage(body, row.assetRole);
      const assetId = newDeliveryAssetId();
      finalKey = deliveryObjectKey(storage.prefix, row.entityId, row.assetRole, assetId, inspected.outputHash);
      await storage.put({ key: finalKey, body: inspected.output, contentType: 'image/webp' });
      const finalObject = await readVerifiedUploadObject(storage, finalKey, inspected.outputBytes);
      if (finalObject.body.length !== inspected.outputBytes) {
        throw new ManagedAssetError('OBJECT_INVALID', 'The processed image failed storage verification.');
      }

      await tx.insert(assetObjects).values({
        id: assetId,
        storageProvider: 'r2',
        objectKey: finalKey,
        publicUrl: publicDeliveryUrl(storage.publicBaseUrl, finalKey),
        contentHash: inspected.outputHash,
        mimeType: 'image/webp',
        provenance: row.requestedProvenance,
        storageTier: 'public_delivery',
        verificationState: 'verified',
        createdByUserId: actor.id,
        byteSize: inspected.outputBytes,
        detectedMimeType: inspected.sourceMimeType,
        width: inspected.outputWidth,
        height: inspected.outputHeight,
        verifiedAt: new Date(),
        metadata: {
          sourceHash: inspected.sourceHash,
          sourceBytes: inspected.sourceBytes,
          sourceMimeType: inspected.sourceMimeType,
          sourceWidth: inspected.sourceWidth,
          sourceHeight: inspected.sourceHeight,
          deliveryFormat: 'webp',
          quarantineObjectKey: quarantineKey,
        },
      });
      const mapping = await activateEntityAssetMapping(tx, {
        actorUserId: actor.id,
        requestId: input.requestId,
        entityId: row.entityId,
        expectedRevision: row.expectedRevision,
        assetRole: row.assetRole,
        assetId,
        mappingSlot: 'primary',
        selectionMode: 'manual',
        sourceAssetId: null,
        sourceState: 'no_source',
        acknowledgePublicPlaceholder: input.acknowledgePublicPlaceholder,
      });
      const updated = await tx
        .update(assetUploadIntents)
        .set({ status: 'finalized', finalizedByUserId: actor.id, finalizedAt: new Date(), failureReason: null })
        .where(and(eq(assetUploadIntents.id, row.id), eq(assetUploadIntents.status, 'issued')))
        .returning({ id: assetUploadIntents.id });
      if (updated.length !== 1) domainError('UPLOAD_NOT_PENDING', 'The upload intent is no longer pending.');
      return { assetId, finalKey, revision: mapping.revision, inspected };
    });

    let quarantineCleanup = 'deleted';
    try {
      await storage.remove(quarantineKey);
    } catch {
      quarantineCleanup = 'pending';
    }
    return {
      assetId: intent.assetId,
      objectKey: intent.finalKey,
      publicUrl: publicDeliveryUrl(storage.publicBaseUrl, intent.finalKey),
      revision: intent.revision,
      sourceMimeType: intent.inspected.sourceMimeType,
      width: intent.inspected.outputWidth,
      height: intent.inspected.outputHeight,
      byteSize: intent.inspected.outputBytes,
      quarantineCleanup,
    };
  } catch (error) {
    if (finalKey) {
      try {
        await storage.remove(finalKey);
      } catch {
        // A final-object orphan is not public without its committed DB mapping.
      }
    }
    if (error instanceof ManagedAssetError) {
      await markRejected(db, input.intentId, error.code);
    }
    if (error instanceof ManagedAssetError || error instanceof PreviewDomainError) throw error;
    throw new ManagedAssetError('FINALIZE_FAILED', 'The managed asset could not be finalized.');
  }
}
