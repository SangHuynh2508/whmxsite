// server/profile/lore-document.mjs
import { createHash } from 'node:crypto';

export const POINTER_NAME = 'lore.pointer.json';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
export const POINTER_CACHE = 'public, max-age=60';

export function buildLoreDocument(profiles) {
  const body = JSON.stringify({ version: 1, characters: Object.fromEntries(profiles) });
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return { body, hash, fileName: `lore.${hash}.json` };
}
export const buildPointer = (fileName, date) => JSON.stringify({ file: fileName, publishedAt: date.toISOString() });
export const backupKey = (envName, date) => `backups/lore/${envName}/${date.toISOString().slice(0, 10)}.json.gz`;
