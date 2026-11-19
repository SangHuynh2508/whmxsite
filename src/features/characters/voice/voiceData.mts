// Loads public/voice/ (built by tools/build_voice_data.py). A failed load is not kept, so the next visit retries.
import { loadPointed } from '../../profile/api/loreOverlay.mts';
import type { VoiceDoc } from './voiceView.mts';

export type VoiceIndex = { version: string; ids: string[] };

async function getJson<T>(url: string, ok: (x: any) => boolean, fetchImpl: typeof fetch): Promise<T | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const doc = await res.json();
    return ok(doc) ? (doc as T) : null;
  } catch {
    return null;
  }
}

export const loadVoiceIndex = (fetchImpl: typeof fetch = fetch) =>
  getJson<VoiceIndex>('/voice/index.json', (x) => Array.isArray(x?.ids), fetchImpl);

export const loadVoiceDoc = (id: string, fetchImpl: typeof fetch = fetch) =>
  /^[A-Z]\d{4}$/.test(id) ? getJson<VoiceDoc>(`/voice/${id}.json`, (x) => Array.isArray(x?.langs), fetchImpl) : Promise.resolve(null);

// ponytail: one copy per page load, like music.json.
let cached: VoiceIndex | null = null;
export async function loadVoiceIndexCached(): Promise<VoiceIndex | null> {
  return cached ?? (cached = await loadVoiceIndex());
}

// Published VI (server/profile/voice-document.mjs), next to the lore pointer. Any failure → null: the tab keeps the CN.
export type VoiceVi = { version: 1; unlock: Record<string, string>; characters: Record<string, Record<string, string>> };
const isMap = (v: unknown) => typeof v === 'object' && v !== null;
export function loadVoiceVi(lorePointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): Promise<VoiceVi | null> {
  const pointerUrl = lorePointerUrl ? new URL('voice.pointer.json', lorePointerUrl).toString() : undefined;
  return loadPointed(pointerUrl, /^voice\.[0-9a-f]{12}\.json$/, (d) => d?.version === 1 && isMap(d.unlock) && isMap(d.characters), fetchImpl, timeoutMs, 'voice');
}
// ponytail: one request per page load, shared by every character.
let viCached: Promise<VoiceVi | null> | null = null;
export const loadVoiceViCached = (lorePointerUrl?: string) => (viCached ??= loadVoiceVi(lorePointerUrl));

export const audioUrl = (doc: VoiceDoc, key: string) => `${doc.asset_base_url.replace(/\/$/, '')}/${key}`;
