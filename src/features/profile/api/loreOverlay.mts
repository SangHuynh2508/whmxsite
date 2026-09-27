// src/features/profile/api/loreOverlay.mts
// DB-owned lore text published on R2 (architecture §11). Any failure keeps the CN in data.json.
export type LoreOverlay = { version: 1; characters: Record<string, unknown> };
type GameData = { characters?: Record<string, { profile?: unknown }> };

// 20 s: the overlay is merged after the page renders (never blocks it), and the lore file is ~0.3–1.8 MB.
export async function loadLoreOverlay(pointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): Promise<LoreOverlay | null> {
  if (!pointerUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-cache: revalidate the tiny pointer every load (304 when unchanged), so a reload right after a publish
    // shows it — the pointer's max-age=60 kept the previous file for up to a minute.
    const pointerResponse = await fetchImpl(pointerUrl, { signal: controller.signal, cache: 'no-cache' });
    if (!pointerResponse.ok) throw new Error(`pointer HTTP ${pointerResponse.status}`);
    const pointer = await pointerResponse.json();
    if (typeof pointer?.file !== 'string' || !/^lore\.[0-9a-f]{12}\.json$/.test(pointer.file)) throw new Error('invalid pointer');
    const response = await fetchImpl(new URL(pointer.file, pointerUrl).toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`lore HTTP ${response.status}`);
    const doc = await response.json();
    if (doc?.version !== 1 || typeof doc.characters !== 'object' || doc.characters === null) throw new Error('invalid lore document');
    return doc as LoreOverlay;
  } catch (error) {
    console.warn('[lore] overlay not loaded; showing CN from data.json:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
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
