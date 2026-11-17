// public/gallery.json (tools/build_gallery_data.py) → the Thư viện ảnh page. Spec 2026-11-17-gallery-page-design.md.
import type { Lang } from '../../i18n/lang.mts';
import { s, type StringKey } from '../../i18n/strings.mts';
import { versionLabel } from '../music/musicData.mts';

export type GalleryKind = 'story' | 'loading' | 'home' | 'kv' | 'postcard';
export type StoryGroup = 'v3' | 'v2' | 'old' | 'main' | 'other';
export type GalleryItem = { id: string; kind: GalleryKind; file: string; w: number; h: number;
  name_cn: string; name_vi: string; note_cn: string; note_vi: string; place_cn: string; place_vi: string;
  group: StoryGroup | ''; sub_cn: string; sub_vi: string; story_cn: string; story_vi: string };
export type GalleryDoc = { version: string; asset_base_url: string; items: GalleryItem[]; variants?: [GalleryKind, string[]][] };
export type GalleryState = { kind: GalleryKind; g: StoryGroup | ''; v: string; q: string; id: string };
export type Tile = { it: GalleryItem; f: GalleryItem[] }; // f = the image's family (near-identical versions), it = the one shown
export type Text = { text: string; zh: boolean };          // zh: Chinese standing in for VI

export const KINDS: GalleryKind[] = ['story', 'loading', 'home', 'kv', 'postcard'];
export const KIND_LABEL: Record<GalleryKind, StringKey> = { story: 'gaKStory', loading: 'gaKLoading', home: 'gaKHome', kv: 'gaKKv', postcard: 'gaKPostcard' };
export const GROUPS: StoryGroup[] = ['v3', 'v2', 'old', 'main', 'other'];
export const GROUP_LABEL: Record<StoryGroup, StringKey> = { v3: 'gaGV3', v2: 'gaGV2', old: 'gaGOld', main: 'gaGMain', other: 'gaGOther' };
/** No versions in these kinds: a tile opens straight to full screen (owner, round 2). */
export const DIRECT: ReadonlySet<GalleryKind> = new Set<GalleryKind>(['home', 'kv']);
export const isVerGroup = (g: string) => g === 'v3' || g === 'v2';
const VERSION = /^(\d)\.(\d)(上|下)?$/;

// ponytail: one copy per page load, like music.json; a failed load is not kept.
let cached: GalleryDoc | null = null;
export const cachedGallery = () => cached;
export async function loadGalleryCached(): Promise<GalleryDoc | null> {
  return cached ?? (cached = await loadGallery());
}
export async function loadGallery(fetchImpl: typeof fetch = fetch): Promise<GalleryDoc | null> {
  try {
    const res = await fetchImpl('/gallery.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.items) ? (doc as GalleryDoc) : null;
  } catch {
    return null;
  }
}

const verKey = (v: string) => { const m = VERSION.exec(v); return m ? (+m[1] * 10 + +m[2]) * 2 + (m[3] === '下' ? 1 : 0) : -1; };
/** The second row of the story tab: versions newest first; events / chapters / stories in data order. */
export function subs(doc: GalleryDoc, g: StoryGroup | ''): string[] {
  const out = [...new Set(doc.items.filter((x) => x.kind === 'story' && x.group === g).map((x) => x.sub_cn))];
  return isVerGroup(g) ? out.sort((p, q) => verKey(q) - verKey(p)) : out;
}

export function defaultState(doc: GalleryDoc, kind: GalleryKind = 'story'): GalleryState {
  return kind === 'story' ? { kind, g: 'v3', v: subs(doc, 'v3')[0] ?? '', q: '', id: '' } : { kind, g: '', v: '', q: '', id: '' };
}

/** '/gallery?kind=story&g=v3&v=3.4上&q=…&id=…' (or the router's '#/gallery?…'); anything unknown falls back. */
export function readState(doc: GalleryDoc, url: string): GalleryState {
  const p = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
  const kind = KINDS.find((k) => k === p.get('kind')) ?? 'story';
  const st = { ...defaultState(doc, kind), q: p.get('q') ?? '' };
  if (kind === 'story') {
    const g = GROUPS.find((x) => x === p.get('g'));
    if (g) { st.g = g; st.v = ''; }
    const v = p.get('v') ?? '';
    if (v && subs(doc, st.g).includes(v)) st.v = v;
  }
  const hit = doc.items.find((x) => x.kind === kind && x.id === p.get('id'));
  if (hit) {
    st.id = hit.id;
    // a shared link to one image: show its own group / version if the link did not name them
    if (kind === 'story' && !(st.g === hit.group && (!st.v || st.v === hit.sub_cn))) { st.g = hit.group; st.v = hit.sub_cn; }
  }
  return st;
}

export function stateUrl(st: GalleryState): string {
  const p = new URLSearchParams();
  p.set('kind', st.kind);
  if (st.kind === 'story' && st.g) p.set('g', st.g);
  if (st.kind === 'story' && st.v) p.set('v', st.v);
  if (st.q.trim()) p.set('q', st.q);
  if (st.id) p.set('id', st.id);
  return `/gallery?${p}`;
}

const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const hay = (x: GalleryItem) => fold([x.id, x.name_cn, x.name_vi, x.place_cn, x.place_vi, x.note_cn, x.note_vi, x.sub_cn, x.sub_vi,
  x.story_cn, x.story_vi, isVerGroup(x.group) ? versionLabel(x.sub_cn, 'vi') : ''].join(' '));

/** The images of the tab. A search looks through the whole kind; the group / version rows apply only without one. */
export function filterItems(doc: GalleryDoc, st: GalleryState): GalleryItem[] {
  const q = fold(st.q.trim());
  const rows = st.kind === 'story' && !q;
  const out = doc.items.filter((x) => x.kind === st.kind
    && (!rows || ((!st.g || x.group === st.g) && (!st.v || x.sub_cn === st.v)))
    && (!q || hay(x).includes(q)));
  if (!rows || !st.g) return out;
  const order = subs(doc, st.g); // newest version first, as the row shows them
  return out.sort((p, q2) => order.indexOf(p.sub_cn) - order.indexOf(q2.sub_cn));
}

/** Owner-reviewed groups of near-identical images (gallery.json `variants`): each member → its whole group. */
export function families(doc: GalleryDoc): Map<GalleryItem, GalleryItem[]> {
  const by = new Map(doc.items.map((x) => [`${x.kind}:${x.id}`, x]));
  const fam = new Map<GalleryItem, GalleryItem[]>();
  for (const [kind, ids] of doc.variants ?? []) {
    const f = ids.map((id) => by.get(`${kind}:${id}`)).filter((x): x is GalleryItem => !!x);
    if (f.length > 1) for (const x of f) fam.set(x, f);
  }
  return fam;
}

/** One tile per family: the first member the filter kept stands for it. */
export function tiles(list: GalleryItem[], fam: Map<GalleryItem, GalleryItem[]>): Tile[] {
  const seen = new Set<GalleryItem[]>(), out: Tile[] = [];
  for (const it of list) {
    const f = fam.get(it) ?? [it];
    if (seen.has(f)) continue;
    seen.add(f);
    out.push({ it, f });
  }
  return out;
}

/** VI page: the Vietnamese, else the Chinese flagged; CN page: the Chinese (VI only if there is none). */
export const pick = (lang: Lang, vi: string, cn: string): Text =>
  lang === 'vi' ? (vi ? { text: vi, zh: false } : { text: cn, zh: !!cn }) : { text: cn || vi, zh: false };

/** Where a story CG sits: "Bản 3.4 Thượng" for a version series, else its event / chapter / story. */
export function subText(it: GalleryItem, lang: Lang): Text {
  if (isVerGroup(it.group)) return { text: s('gaVerN', lang).replace('{v}', versionLabel(it.sub_cn, lang)), zh: false };
  return it.sub_cn ? pick(lang, it.sub_vi, it.sub_cn) : { text: it.id, zh: false };
}

/** A name for every image: its own name → postcard place → the story it opens in → the KV code. */
export function title(it: GalleryItem, lang: Lang): Text {
  if (it.kind === 'kv') return { text: `KV ${VERSION.test(it.name_cn) ? versionLabel(it.name_cn, lang) : it.id}`, zh: false };
  if (it.name_cn) return pick(lang, it.name_vi, it.name_cn);
  if (it.place_cn) return pick(lang, it.place_vi, it.place_cn);
  if (it.kind === 'story') return isVerGroup(it.group) && it.story_cn ? pick(lang, it.story_vi, it.story_cn) : subText(it, lang);
  return { text: it.id, zh: false };
}

const base = (doc: GalleryDoc) => doc.asset_base_url.replace(/\/$/, '');
export const thumbUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/t.webp`;
export const viewUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/v.webp`;
export const origUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/o.png`;
export const downloadName = (it: GalleryItem) => `${it.kind}_${it.id}.png`;
