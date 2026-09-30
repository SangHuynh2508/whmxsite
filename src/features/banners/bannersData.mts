// public/banners.json (tools/build_banner_data.py) → what the Home and Banner pages show. Spec 2026-09-30 §3, §5.
import { formatDate, remaining, status } from './bannerTime.mts';

export type Banner = { id: string; name_cn: string; name_vi: string | null; type: string; kind_cn: string;
  start: number; end: number; up: string[]; up_skin: string | null; art: string | null;
  title: string | null; choice: number | null };
export type BannerEvent = { id: number; name_cn: string; kind_cn: string; start: number; end: number };
export type BannersDoc = { generated_at: number; masterdata: string; asset_base_url: string;
  version: { id: string; label: string; start: number; end: number } | null;
  hero: { kv: string; name_cn: string; art: string | null; start: number; end: number } | null;
  events: BannerEvent[]; banners: Banner[] };

// ponytail: one copy per page load (the file only changes with a deploy); lets Back re-render at once, so the router's
// scroll restore finds the content. A failed load is not kept, the next visit retries.
let cached: BannersDoc | null = null;
export const cachedBanners = () => cached;
export async function loadBannersCached(): Promise<BannersDoc | null> {
  return cached ?? (cached = await loadBanners());
}

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
export function currentBanners(doc: BannersDoc, nowMs: number): Banner[] {
  const started = doc.banners.filter((b) => status(nowMs, b.start, b.end) !== 'upcoming');
  const anchor = Math.max(...started.map((b) => b.start), -Infinity);
  const current = started.filter((b) => b.end > anchor);
  const isFeatured = (b: Banner) => b.up.length > 0 && b.type !== 'season'; // spec Q3: UP banners first
  return [...current.filter(isFeatured), ...current.filter((b) => !isFeatured(b))];
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

// Event kinds (ActivityOverAllMap DescLanText), owner-approved 2026-09-30.
const EVENT_KIND_VI: Record<string, string> = { 主题活动: 'Sự kiện chủ đề', 试炼场: 'Thí Luyện Trường', 限时招集: 'Chiêu mộ có thời hạn' };

/** A kind the table does not know yet stays Chinese (shown with the untranslated dot), never guessed. */
export function eventKind(kindCn: string): { text: string; vi: boolean } {
  return EVENT_KIND_VI[kindCn] ? { text: EVENT_KIND_VI[kindCn], vi: true } : { text: kindCn, vi: false };
}

export const TYPE_VI: Record<string, string> = { limited: 'Giới hạn', time: 'Có thời hạn', season: 'Theo mùa', oldtime: 'Thường trực' };

type SkinOwner = { skins?: { skinID: string; image?: string }[] };

/** The UP skin drawing (data.json) the slice layers over the pool background; null when data.json does not have it. */
export function skinImage(b: Banner, characters: Record<string, SkinOwner>): string | null {
  if (!b.up_skin || !b.up[0]) return null;
  return characters[b.up[0]]?.skins?.find((s) => s.skinID === b.up_skin)?.image ?? null;
}

/** The slice's small line (direction-approved.md): label, plus the time left when the banner is open. */
export function sliceMeta(b: Banner, nowMs: number, isArchive: boolean, timeZone?: string): { label: string; left: string | null } {
  const type = TYPE_VI[b.type] ?? b.kind_cn;
  if (isArchive) return { label: `${type} · ${formatRange(b.start, b.end, timeZone)}`, left: null };
  if (status(nowMs, b.start, b.end) === 'ended') return { label: 'Đã kết thúc · chờ bản cập nhật', left: null };
  return { label: b.choice ? `Tự chọn trong ${b.choice} Khí Giả` : type, left: remaining(nowMs, b.end) };
}

/** "20/08 – 10/09/2026" when both dates fall in one year, else both full dates. */
export function formatRange(startS: number, endS: number, timeZone?: string): string {
  const a = formatDate(startS, timeZone), b = formatDate(endS, timeZone);
  return a.slice(6) === b.slice(6) ? `${a.slice(0, 5)} – ${b}` : `${a} – ${b}`;
}

/** Hero title: the version in Vietnamese ("3.4上" → "Phiên bản 3.4 · Thượng"); an unknown suffix is kept as is. */
export function versionTitle(label: string): string {
  const m = label.match(/^(.*?)([上下])$/);
  return m ? `Phiên bản ${m[1]} · ${m[2] === '上' ? 'Thượng' : 'Hạ'}` : `Phiên bản ${label}`;
}

export type ArchiveFilters = { character: string; type: string; year: number };

/** Archive filters live in the hash (#/banners?char=A0184&type=limited&year=2024) so Back and shared links keep them. */
export function readFilters(hash: string): ArchiveFilters {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  return { character: q.get('char') ?? '', type: q.get('type') ?? '', year: Number(q.get('year')) || 0 };
}

export function filtersHash(f: ArchiveFilters): string {
  const q = new URLSearchParams();
  if (f.character) q.set('char', f.character);
  if (f.type) q.set('type', f.type);
  if (f.year) q.set('year', String(f.year));
  const qs = q.toString();
  return qs ? `#/banners?${qs}` : '#/banners';
}
