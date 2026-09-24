// scripts/publish-lore.mjs
// --dry-run <file>: write the lore JSON locally, no R2, no DB writes.
// (no flag): publish (writes R2 + lore_publish_state) — owner approval required.
// --repoint <lore.<hash>.json>: point production at an older file (rollback) — owner approval required.
import { writeFileSync } from 'node:fs';

import { closeDb, getDb } from '../db/client.mjs';
import { POINTER_CACHE, POINTER_NAME, buildLoreDocument, buildPointer } from '../server/profile/lore-document.mjs';
import { createLoreRepository } from '../server/profile/lore-repository.mjs';
import { createLoreStorage, loadLoreStorageConfig } from '../server/profile/lore-storage.mjs';
import { loadProfileContext, resolveAllProfiles } from '../server/profile/resolve-character-profile.mjs';
import { publishLore } from '../server/profile/lore-publisher.mjs';

const argv = process.argv.slice(2);
try {
  if (argv[0] === '--dry-run') {
    const doc = buildLoreDocument(resolveAllProfiles(await loadProfileContext(getDb()), { shape: 'v2' }));
    writeFileSync(argv[1], doc.body);
    console.log(JSON.stringify({ dryRun: true, file: doc.fileName, bytes: Buffer.byteLength(doc.body) }));
  } else if (argv[0] === '--repoint') {
    if (!/^lore\.[0-9a-f]{12}\.json$/.test(argv[1] ?? '')) throw new Error('usage: --repoint lore.<12 hex>.json');
    const storage = createLoreStorage(loadLoreStorageConfig());
    const now = new Date();
    await storage.putPublic(POINTER_NAME, buildPointer(argv[1], now), { cacheControl: POINTER_CACHE });
    await createLoreRepository(getDb()).writeState(getDb(), { publishedFile: argv[1], publishedHash: argv[1].slice(5, 17), publishedAt: now });
    console.log(JSON.stringify({ repointed: argv[1] }));
  } else {
    const storage = createLoreStorage(loadLoreStorageConfig());
    console.log(JSON.stringify(await publishLore({ repo: createLoreRepository(getDb()), storage })));
  }
} catch (error) {
  console.error(`LORE_PUBLISH_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
