// server/profile/lore-publisher.mjs
// Publish order: backup -> content (new hash only) -> pointer (atomic swap) -> state.
import { gzipSync } from 'node:zlib';

import { buildGameDocument } from '../game/game-document.mjs';
import { GAME_POINTER_NAME, IMMUTABLE, POINTER_CACHE, POINTER_NAME, backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

// Publishes every public DB document under one lock and one backup: the lore file and the game file
// (game.<hash>.json: game catalogue + texts + builds, server/game/game-document.mjs). Each content file is uploaded
// only when its pointer doesn't already name it; the admin's published state follows the lore file, as before.
export async function publishLore({ repo, storage, actorUserId = null, now = new Date() }) {
  return repo.withPublishLock(async (tx) => {
    const lore = buildLoreDocument(await repo.loadPublishProfiles(tx));
    const game = buildGameDocument(await repo.loadGameDocumentInput(tx));
    await storage.putBackup(backupKey(storage.envName, now), gzipSync(JSON.stringify(await repo.loadBackupPayload(tx))));
    let changed = false;
    for (const [doc, pointer] of [[lore, POINTER_NAME], [game, GAME_POINTER_NAME]]) {
      // Compare with the live pointer of this environment, not the DB row: the state row is
      // per database, so a new environment (or a branch copied from another) would look current.
      if ((await storage.readPointerFile(pointer)) === doc.fileName) continue;
      // gzip on the wire (R2 serves it with Content-Encoding: gzip; browsers inflate): ~1.8 MB of JSON otherwise.
      await storage.putPublic(doc.fileName, gzipSync(doc.body), { cacheControl: IMMUTABLE, contentEncoding: 'gzip' });
      await storage.putPublic(pointer, buildPointer(doc.fileName, now), { cacheControl: POINTER_CACHE });
      changed = true;
    }
    if (!changed) {
      await repo.writeState(tx, { publishedAt: now, publishedByUserId: actorUserId }); // the live files are current
      return { status: 'unchanged', file: lore.fileName, game: game.fileName };
    }
    await repo.writeState(tx, { publishedFile: lore.fileName, publishedHash: lore.hash, publishedAt: now, publishedByUserId: actorUserId });
    return { status: 'published', file: lore.fileName, game: game.fileName };
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
