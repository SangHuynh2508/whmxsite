// server/profile/lore-publisher.mjs
// Publish order: backup -> content (new hash only) -> pointer (atomic swap) -> state.
import { gzipSync } from 'node:zlib';

import { IMMUTABLE, POINTER_CACHE, POINTER_NAME, backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

export async function publishLore({ repo, storage, actorUserId = null, now = new Date() }) {
  return repo.withPublishLock(async (tx) => {
    const doc = buildLoreDocument(await repo.loadPublishProfiles(tx));
    await storage.putBackup(backupKey(storage.envName, now), gzipSync(JSON.stringify(await repo.loadBackupPayload(tx))));
    // Compare with the live pointer of this environment, not the DB row: the state row is
    // per database, so a new environment (or a branch copied from another) would look current.
    if ((await storage.readPointerFile()) === doc.fileName) {
      await repo.writeState(tx, { publishedAt: now, publishedByUserId: actorUserId }); // the live file is current
      return { status: 'unchanged', file: doc.fileName };
    }
    await storage.putPublic(doc.fileName, doc.body, { cacheControl: IMMUTABLE });
    await storage.putPublic(POINTER_NAME, buildPointer(doc.fileName, now), { cacheControl: POINTER_CACHE });
    await repo.writeState(tx, { publishedFile: doc.fileName, publishedHash: doc.hash, publishedAt: now, publishedByUserId: actorUserId });
    return { status: 'published', file: doc.fileName };
  });
}

// Rollback: point this environment at an older content file. publishedAt is cleared so
// Admin keeps showing "unpublished changes" until the next real publish.
export async function repointLore({ repo, storage, fileName, now = new Date() }) {
  return repo.withPublishLock(async (tx) => {
    if (!(await storage.publicFileExists(fileName))) throw new Error(`${fileName} not found in this environment`);
    await storage.putPublic(POINTER_NAME, buildPointer(fileName, now), { cacheControl: POINTER_CACHE });
    await repo.writeState(tx, { publishedFile: fileName, publishedHash: fileName.slice(5, 17), publishedAt: null, publishedByUserId: null });
    return { status: 'repointed', file: fileName };
  });
}
