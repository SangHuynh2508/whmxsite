// Thư viện ảnh (/gallery): game images by the table that uses them; big view and original download.
// Spec docs/superpowers/specs/2026-11-17-gallery-page-design.md; look = direction D opened the "C · Lớp phủ" way
// (docs/public-redesign/gallery/direction-approved.md; reference demo design-demos/D-kho-khoanh-khac.html).
import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Layers, Search } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import { routeString, navigate, ROUTE_EVENT } from '../../app/router/location.mts';
import { useReveal, useSlider } from '../characters/motion.ts';
import {
  DIRECT, GROUPS, GROUP_LABEL, KINDS, KIND_LABEL, cachedGallery, defaultState, families, filterItems, isVerGroup,
  loadGalleryCached, readState, stateUrl, subText, subs, thumbUrl, tiles, title, viewUrl,
  type GalleryDoc, type GalleryItem, type GalleryKind, type GalleryState, type Tile,
} from './galleryData.mts';
import { preload } from './loadImage.mts';
import { FullScreen, Loading, Name, Panel, trap, useLoader, type FullState, type PanelState } from './GalleryViewer.tsx';
import './styles/gallery.css';

const phone = () => matchMedia('(max-width: 768px)').matches;

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false);
  return bad
    ? <span className="ga-ph">{s('gaThumbError')}</span>
    : <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

export function GalleryPage({ doc, retry }: { doc: GalleryDoc | null; retry: () => void }) {
  const lang = useLang();
  if (!doc) {
    return (
      <div className="ga-page">
        <div className="ga-empty"><p>{s('gaLoadError', lang)}</p><button type="button" className="ga-btn" onClick={retry}>{s('muRetry', lang)}</button></div>
      </div>
    );
  }
  return <Gallery doc={doc} />;
}

type How = 'click' | 'swap' | 'link'; // a tile click (flies, adds a history entry), ← / → in the panel, a link or Back / Forward

function Gallery({ doc }: { doc: GalleryDoc }) {
  const lang = useLang();
  const [st, setSt] = useState<GalleryState>(() => readState(doc, routeString()));
  const [q, setQ] = useState(st.q);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [full, setFull] = useState<FullState | null>(null);
  const { busy, load, cancel } = useLoader();
  const fam = useMemo(() => families(doc), [doc]);
  const list = useMemo(() => filterItems(doc, st), [doc, st]);
  const shown = useMemo(() => tiles(list, fam), [list, fam]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, doc.items.filter((x) => x.kind === k).length])) as Record<GalleryKind, number>, [doc]);
  const page = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const vers = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const from = useRef<HTMLElement | null>(null); // where the opening image flies from
  const openId = useRef(st.id);                   // the id this page has put in the URL
  const pushed = useRef(false);                   // opening added a history entry: closing goes Back
  const qTimer = useRef(0);
  const now = useRef({ st, shown, panel, full });  // for handlers that outlive a render (route event, awaited loads)
  now.current = { st, shown, panel, full };
  useSlider(tabs, KINDS.indexOf(st.kind));
  useReveal(page, '.ga-tile:nth-child(-n+14)', `${st.kind}|${st.g}|${st.v}|${st.q}`);

  const tileEl = (n: number) => grid.current?.querySelector<HTMLElement>(`[data-n="${n}"]`) ?? null;
  const repAt = (sh: Tile[], n: number) => sh[n].f.indexOf(sh[n].it);
  const write = (next: GalleryState, push = false) => {
    openId.current = next.id;
    if (push) { pushed.current = true; navigate(stateUrl(next)); } else history.replaceState(null, '', stateUrl(next));
  };

  const openPanel = async (sh: Tile[], n: number, at: number, how: How) => {
    const it = sh[n].f[at];
    const src = await load(how === 'swap' ? 'frame' : `tile:${n}`, viewUrl(doc, it));
    if (src === undefined) return; // another image was asked for, or the layer closed
    from.current = how === 'click' ? tileEl(n) : null;
    setPanel({ n, at, shownAt: at, src });
    if (how !== 'link') write({ ...now.current.st, id: it.id }, how === 'click');
  };
  const openFull = async (seq: GalleryItem[], at: number, key: string, fromEl: HTMLElement | null, versions: boolean, push: boolean) => {
    const src = await load(key, viewUrl(doc, seq[at]));
    if (src === undefined) return;
    from.current = fromEl;
    setFull({ seq, at, src, versions, step: 0 });
    if (push) write({ ...now.current.st, id: seq[at].id }, true);
  };
  // Another version: the facts follow at once, the picture once it has loaded (progress on the big frame).
  const pickVersion = async (at: number) => {
    const p = now.current.panel;
    if (!p) return;
    const f = now.current.shown[p.n].f;
    const a = (at + f.length) % f.length;
    setPanel({ ...p, at: a });
    write({ ...now.current.st, id: f[a].id });
    const src = await load('frame', viewUrl(doc, f[a]));
    if (src !== undefined) setPanel((x) => (x && x.n === p.n && x.at === a ? { ...x, src, shownAt: a } : x));
  };
  const stepFull = async (d: -1 | 1) => {
    const f = now.current.full;
    if (!f || f.seq.length < 2) return;
    const at = (f.at + d + f.seq.length) % f.seq.length;
    if (f.versions) void pickVersion(at); // the panel behind follows the same version
    const src = await load('full', viewUrl(doc, f.seq[at]));
    if (src === undefined) return;
    setFull((x) => (x ? { ...x, at, src, step: d } : x));
    if (!f.versions) write({ ...now.current.st, id: f.seq[at].id });
  };
  const closeAll = (silent = false) => {
    const { panel: p, full: fs } = now.current;
    const back = p ? p.n : fs && !fs.versions ? fs.at : -1; // the tile that opened it gets the focus back
    cancel();
    setPanel(null);
    setFull(null);
    const had = openId.current;
    openId.current = '';
    if (!silent && had) {
      if (pushed.current) history.back(); // the route event that follows finds no id and nothing open
      else history.replaceState(null, '', stateUrl({ ...now.current.st, id: '' }));
    }
    pushed.current = false;
    if (!silent && back >= 0) requestAnimationFrame(() => tileEl(back)?.focus({ preventScroll: true }));
  };
  const closeFull = () => {
    if (!now.current.panel) return closeAll();
    cancel('full');
    setFull(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.ga-frame')?.focus({ preventScroll: true }));
  };
  const set = (patch: Partial<GalleryState>) => {
    closeAll(true);
    const next = { ...now.current.st, ...patch, id: '' };
    setSt(next);
    write(next);
    scroller.current?.scrollTo({ top: 0 }); // desktop: the image area starts at the top again
    const t = tabs.current;
    if (phone() && t && t.getBoundingClientRect().top < 0) t.scrollIntoView({ block: 'start' });
  };
  const onQuery = (v: string) => {
    setQ(v);
    clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => set({ q: v }), 150);
  };
  const clearSearch = () => { setQ(''); set({ q: '' }); };
  const openById = (next: GalleryState) => {
    const sh = tiles(filterItems(doc, next), fam);
    const n = sh.findIndex((t) => t.f.some((x) => x.id === next.id));
    if (n < 0) return;
    openId.current = next.id; // already in the URL
    if (DIRECT.has(next.kind)) void openFull(sh.map((t) => t.it), n, `tile:${n}`, null, false, false);
    else void openPanel(sh, n, sh[n].f.findIndex((x) => x.id === next.id), 'link');
  };

  const api = useRef({ openById, closeAll });
  api.current = { openById, closeAll };
  useEffect(() => {
    if (now.current.st.id) api.current.openById(now.current.st); // a shared link to one image
    const onRoute = () => {
      const next = readState(doc, routeString());
      if (next.id !== openId.current) { // Back / Forward past an open image: the URL already says what to show
        api.current.closeAll(true);
        if (next.id) api.current.openById(next);
      }
      setSt(next);
      setQ(next.q);
    };
    addEventListener(ROUTE_EVENT, onRoute);
    return () => removeEventListener(ROUTE_EVENT, onRoute);
  }, [doc]);

  useEffect(() => { // every render: the keys act on this render's layers
    if (!panel && !full) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.matches?.('input')) return;
      const layer = document.querySelector<HTMLElement>(full ? '.ga-full' : '.ga-panel');
      if (e.key === 'Tab') { if (layer) trap(layer, e); return; }
      if (full) {
        if (e.key === 'Escape') closeFull();
        else if (e.key === 'ArrowLeft') void stepFull(-1);
        else if (e.key === 'ArrowRight') void stepFull(1);
        return;
      }
      const n = panel!.n;
      if (e.key === 'Escape') closeAll();
      else if (e.key === 'ArrowLeft' && n > 0) void openPanel(shown, n - 1, repAt(shown, n - 1), 'swap');
      else if (e.key === 'ArrowRight' && n < shown.length - 1) void openPanel(shown, n + 1, repAt(shown, n + 1), 'swap');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const layered = !!(panel || full);
  useEffect(() => {
    // phones scroll the document; a class (not body.style, which the router resets on every route) keeps it still
    document.documentElement.classList.toggle('ga-lock', layered);
    return () => document.documentElement.classList.remove('ga-lock');
  }, [layered]);

  useEffect(() => { // fetch the shown image of every tile on screen ahead (not its other versions)
    const g = grid.current;
    if (!g || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const t = shown[Number((e.target as HTMLElement).dataset.n)];
      if (t) preload(viewUrl(doc, t.it));
    }), { rootMargin: '200px' }); // viewport root: tiles clipped by the desktop scroller do not count
    g.querySelectorAll('.ga-tile').forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [shown, doc]);

  useEffect(() => { // keep the chosen version in view in its row
    const row = vers.current, on = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  }, [st.g, st.v]);

  const searching = !!st.q.trim();
  const rowLabel = isVerGroup(st.g) ? 'gaRowVer' : st.g === 'main' ? 'gaRowChapter' : 'gaRowStory';
  const subItem = (v: string) => doc.items.find((x) => x.kind === 'story' && x.group === st.g && x.sub_cn === v)!;
  const opened = panel ? shown[panel.n] : null;
  return (
    <div className="ga-page" ref={page}>
      <header className="ga-head">
        <h1 className="ga-title">{s('gaTitle', lang)}</h1>
        <label className="ga-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={q} placeholder={s('gaSearch', lang)} aria-label={s('gaSearch', lang)} onChange={(e) => onQuery(e.target.value)} />
        </label>
      </header>
      <div className="ga-tabs" role="tablist" aria-label={s('gaKinds', lang)} ref={tabs}>
        <span className="seg-ink" aria-hidden="true" />
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === st.kind}
            onClick={() => { if (k !== st.kind) set({ ...defaultState(doc, k), q: st.q }); }}>
            {s(KIND_LABEL[k], lang)}<small>{counts[k]}</small>
          </button>
        ))}
      </div>
      <div className="ga-groups">
        {st.kind === 'story' && (
          <div className="ga-grp" role="group" aria-label={s('gaGroups', lang)}>
            {GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={!searching && g === st.g}
                onClick={() => { setQ(''); set({ g, v: isVerGroup(g) ? subs(doc, g)[0] ?? '' : '', q: '' }); }}>
                {s(GROUP_LABEL[g], lang)}
              </button>
            ))}
          </div>
        )}
        <span className="ga-res" aria-live="polite">{s('gaCount', lang).replace('{n}', String(list.length))}</span>
      </div>
      {st.kind === 'story' && (
        <div className="ga-vers" role="group" aria-label={s(rowLabel, lang)} ref={vers}>
          {['', ...subs(doc, st.g)].map((v) => (
            <button key={v || '*'} type="button" aria-pressed={!searching && v === st.v} onClick={() => { setQ(''); set({ v, q: '' }); }}>
              {v ? <Name t={subText(subItem(v), lang)} /> : s('muAll', lang)}
            </button>
          ))}
        </div>
      )}
      <div className="ga-scroll" ref={scroller} data-lenis-prevent>
        {shown.length ? (
          <div className={`ga-grid${st.kind === 'postcard' ? ' is-sq' : ''}`} ref={grid}>
            {shown.map(({ it, f }, n) => {
              const t = title(f[0], lang);
              const label = f.length > 1 ? `${t.text} · ${s('gaVersions', lang).replace('{n}', String(f.length))}` : t.text;
              const p = busy[`tile:${n}`];
              return (
                <button key={`${it.kind}:${it.id}`} type="button" className="ga-tile" data-n={n} aria-haspopup="dialog"
                  aria-expanded={panel?.n === n} aria-busy={p !== undefined} aria-label={label}
                  style={{ '--r': `${it.w}/${it.h}` } as CSSProperties}
                  onClick={(e) => {
                    if (DIRECT.has(it.kind)) void openFull(shown.map((x) => x.it), n, `tile:${n}`, e.currentTarget, false, true);
                    else void openPanel(shown, n, repAt(shown, n), 'click');
                  }}>
                  <Thumb src={thumbUrl(doc, it)} />
                  {f.length > 1 && <span className="ga-vc" aria-hidden="true"><Layers size={12} />{f.length}</span>}
                  <span className="ga-nm" aria-hidden="true"><Name t={t} /></span>
                  {p !== undefined && <Loading p={p} />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ga-empty">
            <p>{s('gaEmpty', lang)}</p>
            {searching && <button type="button" className="ga-btn" onClick={clearSearch}>{s('muClear', lang)}</button>}
          </div>
        )}
        <footer className="ga-elsewhere">
          <span>{s('gaElsewhere', lang)}</span><a href="/skins">{s('navSkins', lang)}</a><a href="/banners">{s('bnTitle', lang)}</a>
        </footer>
      </div>
      {opened && panel && createPortal(
        <Panel doc={doc} f={opened.f} state={panel} from={from.current} busy={busy.frame}
          onPick={(a) => void pickVersion(a)} onClose={() => closeAll()}
          onFull={(el) => void openFull(opened.f, panel.shownAt, 'frame', el, true, false)} />, document.body)}
      {full && createPortal(
        <FullScreen doc={doc} state={full} from={from.current} busy={busy.full} onStep={(d) => void stepFull(d)} onClose={closeFull} />,
        document.body)}
    </div>
  );
}

// ---- the island: one root per visit; a cached gallery.json renders synchronously (Back scroll restore) ----
let root: Root | null = null;
let host: HTMLElement | null = null;
let generation = 0;
export function unmountGalleryPage() { generation += 1; root?.unmount(); root = null; host = null; }
export function mountGalleryPage(container: HTMLElement): Promise<void> {
  // filters and an open image change the URL and the router calls mount again: the page (already here) follows the URL
  if (root && host === container && container.firstChild) return Promise.resolve();
  unmountGalleryPage();
  const retry = () => queueMicrotask(() => { unmountGalleryPage(); void mountGalleryPage(container); });
  const render = (doc: GalleryDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    host = container;
    flushSync(() => mounted.render(<StrictMode><GalleryPage doc={doc} retry={retry} /></StrictMode>));
  };
  const hit = cachedGallery();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadGalleryCached().then((doc) => { if (mine === generation) render(doc); });
}
