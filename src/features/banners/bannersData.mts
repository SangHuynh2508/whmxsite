// public/banners.json (tools/build_banner_data.py) → what the Home and Banner pages show. Spec 2026-09-30 §3, §5.
import { status } from './bannerTime.mts';

export type Banner = { id: string; name_cn: string; name_vi: string | null; type: string; kind_cn: string;
  start: number; end: number; up: string[]; up_skin: string | null; art: string | null };
export type BannerEvent = { id: number; name_cn: string; kind_cn: string; start: number; end: number };
export type BannersDoc = { generated_at: number; masterdata: string; asset_base_url: string;
  version: { id: string; label: string; start: number; end: number } | null;
  hero: { kv: string; name_cn: string; art: string | null; start: number; end: number } | null;
  events: BannerEvent[]; banners: Banner[] };

export async function loadBanners(fetchImpl: typeof fetch = fetch): Promise<BannersDoc | null> {
  try {
    const res = await fetchImpl('/banners.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.banners) && Array.isArray(doc?.events) ? (doc as BannersDoc) : null;
  } catch {
    return null;
  }
}

/** The newest batch that has started: every started banner still running after the latest start. Kept when it ends
 *  (the site data is older than the game) so the card can say "Đã kết thúc · chờ bản cập nhật". */
export function currentBanners(doc: BannersDoc, nowMs: number): { featured: Banner[]; compact: Banner[] } {
  const started = doc.banners.filter((b) => status(nowMs, b.start, b.end) !== 'upcoming');
  const anchor = Math.max(...started.map((b) => b.start), -Infinity);
  const current = started.filter((b) => b.end > anchor);
  const isFeatured = (b: Banner) => b.up.length > 0 && b.type !== 'season';
  return { featured: current.filter(isFeatured), compact: current.filter((b) => !isFeatured(b)) };
}

export function currentEvents(doc: BannersDoc, nowMs: number): BannerEvent[] {
  return doc.events.filter((e) => status(nowMs, e.start, e.end) === 'active');
}

const yearOf = (s: number, timeZone?: string) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric' }).format(s * 1000));

export function archive(doc: BannersDoc, f: { character?: string; type?: string; year?: number }, timeZone?: string) {
  const groups = new Map<number, Banner[]>();
  for (const b of [...doc.banners].sort((x, y) => y.start - x.start)) {
    const year = yearOf(b.start, timeZone);
    if (f.character && !b.up.includes(f.character)) continue;
    if (f.type && b.type !== f.type) continue;
    if (f.year && year !== f.year) continue;
    groups.set(year, [...(groups.get(year) ?? []), b]);
  }
  return [...groups].map(([year, banners]) => ({ year, banners }));
}

export function upCharacters<C>(b: Banner, characters: Record<string, C>): { id: string; char: C }[] {
  return b.up.filter((id) => characters[id]).map((id) => ({ id, char: characters[id] }));
}

export function artUrl(doc: BannersDoc, path: string | null): string | null {
  return path ? `${doc.asset_base_url.replace(/\/$/, '')}/${path}` : null;
}
