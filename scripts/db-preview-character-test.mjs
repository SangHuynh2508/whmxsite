import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import {
  assetObjects,
  assetUploadIntents,
  characterPublicationStates,
  characters,
  editHistory,
  entityAssetMappings,
  managedEntities,
  previewCharacterReconciliations,
  previewCharacters,
  sourceSnapshots,
  users,
} from '../db/schema/index.mjs';
import {
  activateEntityAssetMapping,
  confirmPreviewReconciliation,
  createPreviewCharacter,
  issueAssetUploadIntent,
  PreviewDomainError,
  proposePreviewReconciliation,
  setPreviewPublicationState,
  updatePreviewCharacter,
} from '../server/preview-characters/preview-character-domain.mjs';

const db = getDb();
const marker = `d0a-proof-${randomUUID()}`;
const rollbackSentinel = new Error('D0A proof rollback');

function requestId() {
  return randomUUID();
}

async function expectDomainError(action, code) {
  await assert.rejects(action, (error) => error instanceof PreviewDomainError && error.code === code);
}

async function expectDatabaseFailure(action, pattern) {
  await assert.rejects(action, (error) => pattern.test(`${error.message}\n${error.cause?.message || ''}`));
}

async function insertUser(tx, role) {
  const id = randomUUID();
  await tx.insert(users).values({
    id,
    name: `${marker}-${role}`,
    email: `${id}@d0a.invalid`,
    role,
    status: 'active',
  });
  return id;
}

async function insertManualAsset(tx, actorUserId, provenance, verificationState = 'verified') {
  const id = randomUUID();
  await tx.insert(assetObjects).values({
    id,
    storageProvider: 'public',
    objectKey: `${marker}/${id}`,
    contentHash: randomUUID().replaceAll('-', ''),
    provenance,
    storageTier: 'public_delivery',
    verificationState,
    createdByUserId: actorUserId,
    metadata: { proof: marker },
  });
  return id;
}

try {
  await assert.rejects(
    db.transaction(async (tx) => {
      const ownerId = await insertUser(tx, 'owner');
      const editorId = await insertUser(tx, 'editor');
      const [official] = await tx
        .select({ entityId: characters.entityId, characterId: characters.characterId, revision: managedEntities.revision })
        .from(characters)
        .innerJoin(managedEntities, eq(managedEntities.id, characters.entityId))
        .limit(1);
      const [snapshot] = await tx.select({ id: sourceSnapshots.id }).from(sourceSnapshots).limit(1);
      assert.ok(official && snapshot, 'expected imported source fixtures');

      const preview = await createPreviewCharacter(tx, {
        actorUserId: editorId,
        requestId: requestId(),
        nameVi: marker,
        claimedRawId: official.characterId,
        claimedRawIdEvidence: { source: 'unverified-report' },
        manualMetadata: { proof: true },
      });
      const [created] = await tx
        .select({
          sourceKey: managedEntities.sourceKey,
          revision: managedEntities.revision,
          lifecycle: characterPublicationStates.lifecycle,
          visibility: characterPublicationStates.visibility,
          publicKey: characterPublicationStates.publicKey,
          claim: previewCharacters.claimedRawId,
        })
        .from(managedEntities)
        .innerJoin(previewCharacters, eq(previewCharacters.entityId, managedEntities.id))
        .innerJoin(characterPublicationStates, eq(characterPublicationStates.entityId, managedEntities.id))
        .where(eq(managedEntities.id, preview.entityId));
      assert.equal(created.sourceKey, `preview:${preview.entityId}`);
      assert.equal(created.publicKey, `preview_${preview.entityId}`);
      assert.equal(created.revision, 1);
      assert.equal(created.lifecycle, 'unverified');
      assert.equal(created.visibility, 'hidden');
      assert.equal(created.claim, official.characterId);
      const [officialAfterClaim] = await tx
        .select({ characterId: characters.characterId })
        .from(characters)
        .where(eq(characters.entityId, official.entityId));
      assert.equal(officialAfterClaim.characterId, official.characterId, 'claimed raw ID must remain non-authoritative');

      const edit = await updatePreviewCharacter(tx, {
        actorUserId: editorId,
        requestId: requestId(),
        entityId: preview.entityId,
        expectedRevision: 1,
        patch: { provenanceNotes: 'editor metadata edit' },
      });
      assert.equal(edit.revision, 2);
      await expectDomainError(
        () =>
          updatePreviewCharacter(tx, {
            actorUserId: editorId,
            requestId: requestId(),
            entityId: preview.entityId,
            expectedRevision: 1,
            patch: { tagsVi: 'stale update' },
          }),
        'VERSION_CONFLICT',
      );
      await expectDomainError(
        () =>
          setPreviewPublicationState(tx, {
            actorUserId: editorId,
            requestId: requestId(),
            entityId: preview.entityId,
            expectedRevision: 2,
            lifecycle: 'unreleased',
            visibility: 'public',
          }),
        'FORBIDDEN',
      );

      const intent = await issueAssetUploadIntent(tx, {
        actorUserId: editorId,
        requestId: requestId(),
        entityId: preview.entityId,
        expectedRevision: 2,
        assetRole: 'avatar',
        requestedFilename: '../../not-a-key.png',
        requestedProvenance: 'manual_preview',
      });
      const [storedIntent] = await tx
        .select()
        .from(assetUploadIntents)
        .where(eq(assetUploadIntents.id, intent.id));
      assert.equal(storedIntent.entityId, preview.entityId);
      assert.equal(storedIntent.entityType, 'preview_character');
      assert.equal(storedIntent.assetRole, 'avatar');
      assert.equal(storedIntent.createdByUserId, editorId);
      assert.equal(storedIntent.expectedRevision, 2);
      assert.equal(storedIntent.quarantineObjectKey, `quarantine/uploads/${intent.id}/original`);
      assert.ok(storedIntent.expiresAt > new Date());
      assert.equal(storedIntent.maxBytes, 4 * 1024 * 1024);
      assert.deepEqual(storedIntent.allowedMimeTypes, ['image/png', 'image/jpeg', 'image/webp']);
      assert.equal(storedIntent.requestedFilename, '../../not-a-key.png');

      const verifiedAssetId = await insertManualAsset(tx, ownerId, 'manual_preview');
      await expectDomainError(
        () =>
          activateEntityAssetMapping(tx, {
            actorUserId: editorId,
            requestId: requestId(),
            entityId: preview.entityId,
            expectedRevision: 2,
            assetRole: 'avatar',
            assetId: verifiedAssetId,
            selectionMode: 'manual',
            sourceState: 'no_source',
          }),
        'FORBIDDEN',
      );

      const publication = await setPreviewPublicationState(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        entityId: preview.entityId,
        expectedRevision: 2,
        lifecycle: 'unreleased',
        visibility: 'public',
      });
      assert.equal(publication.revision, 3);
      const placeholderAssetId = await insertManualAsset(tx, ownerId, 'manual_placeholder');
      await expectDomainError(
        () =>
          activateEntityAssetMapping(tx, {
            actorUserId: ownerId,
            requestId: requestId(),
            entityId: preview.entityId,
            expectedRevision: 3,
            assetRole: 'avatar',
            assetId: placeholderAssetId,
            selectionMode: 'manual',
            sourceState: 'no_source',
          }),
        'PLACEHOLDER_ACKNOWLEDGEMENT_REQUIRED',
      );
      const mapping = await activateEntityAssetMapping(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        entityId: preview.entityId,
        expectedRevision: 3,
        assetRole: 'avatar',
        assetId: placeholderAssetId,
        selectionMode: 'manual',
        sourceState: 'no_source',
        acknowledgePublicPlaceholder: true,
      });
      assert.equal(mapping.revision, 4);

      const pendingAssetId = await insertManualAsset(tx, ownerId, 'manual_preview', 'pending');
      await expectDatabaseFailure(
        tx.transaction((savepoint) =>
          savepoint.insert(entityAssetMappings).values({
            entityId: preview.entityId,
            entityType: 'preview_character',
            assetRole: 'card',
            activeAssetId: pendingAssetId,
            selectionMode: 'manual',
            sourceState: 'no_source',
          }),
        ),
        /verified non-private asset/i,
      );
      await expectDatabaseFailure(
        tx.transaction((savepoint) =>
          savepoint.insert(entityAssetMappings).values({
            entityId: preview.entityId,
            entityType: 'preview_character',
            assetRole: 'not-an-allowed-role',
            activeAssetId: verifiedAssetId,
            selectionMode: 'manual',
            sourceState: 'no_source',
          }),
        ),
        /foreign key/i,
      );

      const proposal = await proposePreviewReconciliation(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        previewEntityId: preview.entityId,
        officialCharacterEntityId: official.entityId,
        evaluatedSourceSnapshotId: snapshot.id,
        candidateEvidence: { reviewed: true },
      });
      const confirmation = await confirmPreviewReconciliation(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        reconciliationId: proposal.id,
        previewExpectedRevision: 4,
        officialExpectedRevision: official.revision,
      });
      assert.equal(confirmation.previewRevision, 5);
      const secondPreview = await createPreviewCharacter(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        nameVi: `${marker}-duplicate`,
      });
      const secondProposal = await proposePreviewReconciliation(tx, {
        actorUserId: ownerId,
        requestId: requestId(),
        previewEntityId: secondPreview.entityId,
        officialCharacterEntityId: official.entityId,
        evaluatedSourceSnapshotId: snapshot.id,
        candidateEvidence: { deliberately: 'duplicate-confirmed-target' },
      });
      await expectDatabaseFailure(
        tx.transaction((savepoint) =>
          confirmPreviewReconciliation(savepoint, {
            actorUserId: ownerId,
            requestId: requestId(),
            reconciliationId: secondProposal.id,
            previewExpectedRevision: 1,
            officialExpectedRevision: confirmation.officialRevision,
          }),
        ),
        /duplicate key/i,
      );
      const confirmed = await tx.execute(sql`
        select count(*)::int as count
        from preview_character_reconciliations
        where status = 'confirmed'
          and official_character_entity_id = ${official.entityId}
      `);
      assert.equal(Number(confirmed[0].count), 1, 'only one confirmed target reconciliation is allowed');

      await assert.rejects(
        tx.transaction(async (savepoint) => {
          await createPreviewCharacter(savepoint, {
            actorUserId: ownerId,
            requestId: requestId(),
            nameVi: `${marker}-must-not-persist`,
          });
          throw new Error('injected preview transaction failure');
        }),
        /injected preview transaction failure/,
      );
      const leakedCreation = await tx
        .select({ id: previewCharacters.entityId })
        .from(previewCharacters)
        .where(eq(previewCharacters.nameVi, `${marker}-must-not-persist`));
      assert.equal(leakedCreation.length, 0, 'injected failure must roll back preview/domain/audit writes');
      const auditCount = await tx
        .select({ count: sql`count(*)::int` })
        .from(editHistory)
        .where(eq(editHistory.entityId, preview.entityId));
      assert.ok(Number(auditCount[0].count) >= 6, 'preview changes must be audited');

      throw rollbackSentinel;
    }),
    rollbackSentinel,
  );

  const residue = await db.execute(sql`
    select count(*)::int as count
    from users
    where name like ${`${marker}%`}
  `);
  assert.equal(Number(residue[0].count), 0, 'D0A proof fixtures must be rolled back');
  console.log('DB_PREVIEW_CHARACTER_D0A_TEST=PASS');
} finally {
  await closeDb();
}
