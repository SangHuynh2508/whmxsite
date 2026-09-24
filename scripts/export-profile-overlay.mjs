// scripts/export-profile-overlay.mjs
// Prints {characterId: profile} for every official character. Reads the DB only.
import { closeDb, getDb } from '../db/client.mjs';
import { loadProfileContext, resolveAllProfiles } from '../server/profile/resolve-character-profile.mjs';

const shapeArg = process.argv.find((a) => a.startsWith('--shape='))?.slice(8) ?? process.argv[process.argv.indexOf('--shape') + 1];
if (!['legacy', 'v2'].includes(shapeArg)) {
  console.error('usage: export-profile-overlay.mjs --shape legacy|v2');
  process.exit(2);
}
try {
  const ctx = await loadProfileContext(getDb());
  process.stdout.write(JSON.stringify(Object.fromEntries(resolveAllProfiles(ctx, { shape: shapeArg }))));
} catch (error) {
  console.error(`OVERLAY_EXPORT_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
