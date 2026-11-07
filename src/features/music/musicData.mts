// public/music.json (tools/build_music_data.py) → the Âm nhạc page. Spec 2026-11-08 §4–§5.
import type { Lang } from '../../i18n/lang.mts';
import { s, type StringKey } from '../../i18n/strings.mts';

export type MusicGroup = 'jukebox' | 'story' | 'stage' | 'area' | 'other';
export type MusicTrack = { id: string; file: string; cover: string | null; group: MusicGroup; groups: MusicGroup[];
  name_cn: string; name_vi: string; label_kind: '' | 'story' | 'stage' | 'area'; label_cn: string; source_cn: string;
  stories: { group_cn: string; count: number }[]; stories_total: number;
  stages: { names_cn: string[]; count: number }; areas_cn: string[] };
export type MusicDoc = { version: string; asset_base_url: string; tracks: MusicTrack[] };

export const GROUPS: MusicGroup[] = ['jukebox', 'story', 'stage', 'area', 'other'];
export const GROUP_LABEL: Record<MusicGroup, StringKey> = { jukebox: 'muJukebox', story: 'muStory', stage: 'muStage', area: 'muArea', other: 'muOther' };

// ponytail: one copy per page load, like banners.json; a failed load is not kept.
let cached: MusicDoc | null = null;
export const cachedMusic = () => cached;
export async function loadMusicCached(): Promise<MusicDoc | null> {
  return cached ?? (cached = await loadMusic());
}

export async function loadMusic(fetchImpl: typeof fetch = fetch): Promise<MusicDoc | null> {
  try {
    const res = await fetchImpl('/music.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.tracks) ? (doc as MusicDoc) : null;
  } catch {
    return null;
  }
}

export function filterTracks(tracks: MusicTrack[], group: MusicGroup | 'all', query: string): MusicTrack[] {
  const q = query.trim().toLowerCase();
  return tracks.filter((t) => (group === 'all' || t.groups.includes(group))
    && (!q || [t.name_cn, t.name_vi, t.label_cn, t.id].some((v) => v.toLowerCase().includes(q))));
}

export function groupCounts(tracks: MusicTrack[]): Record<MusicGroup, number> {
  const c = { jukebox: 0, story: 0, stage: 0, area: 0, other: 0 };
  for (const t of tracks) for (const g of t.groups) c[g] += 1;
  return c;
}

export function trackTitle(t: MusicTrack, lang: Lang): string {
  if (t.name_cn) return (lang === 'vi' && t.name_vi) || t.name_cn;
  if (t.label_kind) return `${s(GROUP_LABEL[t.label_kind], lang)} · ${t.label_cn}`;
  return t.id;
}

export const assetUrl = (doc: MusicDoc, key: string) => `${doc.asset_base_url.replace(/\/$/, '')}/${key}`;
