// server/profile/lore-publisher.mjs
// Publish order: backup -> content (new hash only) -> pointer (atomic swap) -> state.
import { gzipSync } from 'node:zlib';

import { IMMUTABLE, POINTER_CACHE, POINTER_NAME, backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

export async function publishLore({ repo, storage, actorUserId = null, now = new Date() }) {
  return repo.withPublishLock(async (tx) => {
    const doc = buildLoreDocument(await repo.loadPublishProfiles(tx));
    await storage.putBackup(backupKey(storage.envName, now), gzipSync(JSON.stringify(await repo.loadBackupPayload(tx))));
    const state = await repo.readState(tx);
    if (state?.publishedHash === doc.hash) return { status: 'unchanged', file: doc.fileName };
    await storage.putPublic(doc.fileName, doc.body, { cacheControl: IMMUTABLE });
    await storage.putPublic(POINTER_NAME, buildPointer(doc.fileName, now), { cacheControl: POINTER_CACHE });
    await repo.writeState(tx, { publishedFile: doc.fileName, publishedHash: doc.hash, publishedAt: now, publishedByUserId: actorUserId });
    return { status: 'published', file: doc.fileName };
  });
}
