// src/features/profile/api/loreOverlay.mts
// DB-owned lore text published on R2 (architecture §11). Any failure keeps the CN in data.json.
export type LoreOverlay = { version: 1; characters: Record<string, unknown> };
type GameData = { characters?: Record<string, { profile?: unknown }> };

// A published DB document: tiny pointer → immutable content file next to it. Any failure → null (the page keeps
// what it has). 20 s: loaded after the page renders (never blocks it); the lore file is ~0.3–1.8 MB.
async function loadPointed<T>(pointerUrl: string | undefined, fileName: RegExp, valid: (doc: any) => boolean, fetchImpl: typeof fetch, timeoutMs: number, label: string): Promise<T | null> {
  if (!pointerUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-cache: revalidate the tiny pointer every load (304 when unchanged), so a reload right after a publish
    // shows it — the pointer's max-age=60 kept the previous file for up to a minute.
    const pointerResponse = await fetchImpl(pointerUrl, { signal: controller.signal, cache: 'no-cache' });
    if (!pointerResponse.ok) throw new Error(`pointer HTTP ${pointerResponse.status}`);
    const pointer = await pointerResponse.json();
    if (typeof pointer?.file !== 'string' || !fileName.test(pointer.file)) throw new Error('invalid pointer');
    const response = await fetchImpl(new URL(pointer.file, pointerUrl).toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    const doc = await response.json();
    if (!valid(doc)) throw new Error(`invalid ${label} document`);
    return doc as T;
  } catch (error) {
    console.warn(`[${label}] not loaded:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const isObject = (v: unknown) => typeof v === 'object' && v !== null;

export function loadLoreOverlay(pointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): Promise<LoreOverlay | null> {
  return loadPointed(pointerUrl, /^lore\.[0-9a-f]{12}\.json$/, (doc) => doc?.version === 1 && isObject(doc.characters), fetchImpl, timeoutMs, 'lore');
}

// Game database + builds (server/game/game-document.mjs), published next to the lore pointer: no extra setting.
export type GameDocument = { version: 1; refs: Record<string, Record<string, any>>; texts: Record<string, Record<string, GameText>>; builds: Record<string, any[]>; tierLists?: import('../../tier-list/tierView.mts').PublishedList[] };
export type GameText = { cn: string; vi: string | null; detail: string; detail_vi: string | null };
export function loadGameDocument(lorePointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): Promise<GameDocument | null> {
  const pointerUrl = lorePointerUrl ? new URL('game.pointer.json', lorePointerUrl).toString() : undefined;
  return loadPointed(pointerUrl, /^game\.[0-9a-f]{12}\.json$/, (doc) => doc?.version === 1 && isObject(doc.refs) && isObject(doc.texts) && isObject(doc.builds), fetchImpl, timeoutMs, 'game');
}

export function mergeLoreOverlay(gameData: GameData, overlay: LoreOverlay | null): number {
  if (!overlay || !gameData.characters) return 0;
  let merged = 0;
  for (const [id, profile] of Object.entries(overlay.characters)) {
    const character = gameData.characters[id];
    if (character && profile && typeof profile === 'object') {
      character.profile = profile;
      merged += 1;
    }
  }
  return merged;
}
