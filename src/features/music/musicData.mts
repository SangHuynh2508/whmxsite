// public/music.json (tools/build_music_data.py) → the Âm nhạc page. Spec 2026-11-08 §4–§5.
import type { Lang } from '../../i18n/lang.mts';
import { s, type StringKey } from '../../i18n/strings.mts';

export type MusicGroup = 'jukebox' | 'story' | 'stage' | 'area' | 'other';
export type MusicTrack = { id: string; file: string; cover: string | null; group: MusicGroup; groups: MusicGroup[];
  name_cn: string; name_vi: string; label_kind: '' | 'story' | 'stage' | 'area'; label_cn: string; label_vi: string; source_cn: string;
  source_vi?: string; stories: { group_cn: string; group_vi?: string; count: number }[]; stories_total: number;
  stages: { names_cn: string[]; names_vi?: string[]; count: number }; areas_cn: string[]; areas_vi?: string[]; new?: boolean;
  also?: string[] }; // ids of files with the same audio, merged into this track
export type MusicDoc = { version: string; asset_base_url: string; new_version?: string; tracks: MusicTrack[] };
/** A tab: every track, the latest update's tracks, or one group. */
export type MusicTab = MusicGroup | 'all' | 'new';

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

export function filterTracks(tracks: MusicTrack[], group: MusicTab, query: string): MusicTrack[] {
  const q = query.trim().toLowerCase();
  return tracks.filter((t) => (group === 'all' || (group === 'new' ? !!t.new : t.groups.includes(group)))
    && (!q || [t.name_cn, t.name_vi, t.label_cn, t.label_vi ?? ''].some((v) => v.toLowerCase().includes(q))));
}

/** By id, or by the id of a duplicate merged into it, so old links still open the song. */
export const findTrack = (doc: MusicDoc, id: string) => doc.tracks.find((t) => t.id === id || t.also?.includes(id)) ?? null;

export function groupCounts(tracks: MusicTrack[]): Record<MusicGroup, number> {
  const c = { jukebox: 0, story: 0, stage: 0, area: 0, other: 0 };
  for (const t of tracks) for (const g of t.groups) c[g] += 1;
  return c;
}

/** The track's own name — jukebox name, else its first use or event (build names every track) — and whether Chinese stands in for VI. */
export function trackName(t: MusicTrack, lang: Lang): { text: string; zh: boolean } {
  const vi = lang === 'vi' && (t.name_cn ? t.name_vi : t.label_vi);
  if (vi) return { text: vi, zh: false };
  const cn = t.name_cn || t.label_cn;
  return cn ? { text: cn, zh: lang === 'vi' } : { text: t.id, zh: false };
}

/** List / document title: a label gets its kind in front ("Bản đồ · 裂隙"). */
export function trackTitle(t: MusicTrack, lang: Lang): string {
  const { text } = trackName(t, lang);
  return !t.name_cn && t.label_kind ? `${s(GROUP_LABEL[t.label_kind], lang)} · ${text}` : text;
}

const isTab = (g: string | null): g is MusicTab => g === 'new' || GROUPS.includes(g as MusicGroup);
/** '#/music/<id>?g=story&q=…' — the filter rides along so Back and shared links keep it. */
export function musicHash(id: string, group: MusicTab, q: string): string {
  const p = new URLSearchParams();
  if (group !== 'all') p.set('g', group);
  if (q.trim()) p.set('q', q);
  const qs = p.toString();
  return `#/music${id ? `/${encodeURIComponent(id)}` : ''}${qs ? `?${qs}` : ''}`;
}
export function musicFilter(hash: string): { group: MusicTab; q: string } {
  const p = new URLSearchParams(hash.split('?')[1] ?? '');
  const g = p.get('g');
  return { group: isTab(g) ? g : 'all', q: p.get('q') ?? '' };
}

export const clock = (sec: number) => (Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '–:––');

export const assetUrl = (doc: MusicDoc, key: string) => `${doc.asset_base_url.replace(/\/$/, '')}/${key}`;
