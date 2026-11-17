// Viewer of the Thư viện ảnh (spec 2026-11-17 "Mở ảnh"; demo D-kho-khoanh-khac.html): the panel over the page
// (story / loading / postcard) and the full screen (home / KV, or the panel's big image). Only the loaded image
// moves; the layers fade in where they stand (owner, round 5).
import { Fragment, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight, Download, Maximize2, X } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import type { Lang } from '../../i18n/lang.mts';
import { reduced } from '../characters/motion.ts';
import {
  GROUP_LABEL, KIND_LABEL, downloadName, isVerGroup, origUrl, pick, subText, thumbUrl, title,
  type GalleryDoc, type GalleryItem, type StoryGroup, type Text,
} from './galleryData.mts';
import { loadImage } from './loadImage.mts';

/** Chinese standing in for VI: serif, the ash dot kept on the last glyph's line, "(chưa dịch)" for screen readers. */
export function Name({ t }: { t: Text }) {
  if (!t.zh) return <>{t.text}</>;
  const c = Array.from(t.text);
  return (
    <span className="ga-zh" lang="zh">
      {c.slice(0, -1).join('')}<span className="ga-nw">{c.at(-1)}<span className="ga-dot" aria-hidden="true" /></span>
      <span className="ga-sr"> (chưa dịch)</span>
    </span>
  );
}

/** Dimmed picture, % in the middle, a gold line along the bottom; "Đang tải…" with a moving line when the size is unknown. */
export function Loading({ p }: { p: number }) {
  const lang = useLang();
  return (
    <span className={`ga-ld${p < 0 ? ' is-ind' : ''}`} aria-hidden="true">
      <i style={p >= 0 ? { width: `${p * 100}%` } : undefined} />
      <b>{p < 0 ? s('gaLoadingImg', lang) : `${Math.round(p * 100)}%`}</b>
    </span>
  );
}

const slotOf = (key: string) => (key.startsWith('tile:') ? 'open' : key);
const without = (b: Record<string, number>, slot: string) => Object.fromEntries(Object.entries(b).filter(([k]) => slotOf(k) !== slot));
const step = (p: number) => (p < 0 ? -1 : Math.floor(p * 20) / 20); // 5 % steps: each one re-renders the grid

/**
 * Large images on demand (owner, round 4: only the image asked for). `load(key, url)` shows progress on `key`
 * (`tile:<n>`, `frame`, `full`) once the wait passes 120 ms, so a cached image opens without a flash; all `tile:*`
 * share one slot, so a newer click drops the older one. Resolves to the src, `null` when it failed, `undefined` when
 * it was superseded or cancelled.
 */
export function useLoader() {
  const [busy, setBusy] = useState<Record<string, number>>({});
  const want = useRef(new Map<string, object>());
  const load = useCallback((key: string, url: string): Promise<string | null | undefined> => {
    const slot = slotOf(key), token = {};
    want.current.set(slot, token);
    setBusy((b) => without(b, slot));
    const mine = () => want.current.get(slot) === token;
    let last = 0, shown = false;
    const timer = setTimeout(() => { shown = true; if (mine()) setBusy((b) => ({ ...b, [key]: last })); }, 120);
    const done = (src: string | null) => {
      clearTimeout(timer);
      if (!mine()) return undefined;
      want.current.delete(slot);
      setBusy((b) => without(b, slot));
      return src;
    };
    const progress = (p: number) => {
      const r = step(p);
      if (r === last) return;
      last = r;
      if (shown && mine()) setBusy((b) => ({ ...b, [key]: r }));
    };
    return loadImage(url, progress).then(done, () => done(null));
  }, []);
  const cancel = useCallback((slot?: string) => {
    if (slot) { want.current.delete(slot); setBusy((b) => without(b, slot)); } else { want.current.clear(); setBusy({}); }
  }, []);
  return { busy, load, cancel };
}

/** The loaded image flies from `from` (a tile's own box — its img is scaled 1.04 on hover — or the panel frame) to `to`. */
function fly(from: HTMLElement | null, to: HTMLElement | null, tl: gsap.core.Timeline, src: string) {
  if (!from || !to || reduced()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const c = Object.assign(new Image(), { src, alt: '', className: 'ga-fly' });
  Object.assign(c.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  document.body.append(c);
  gsap.set(to, { opacity: 0 });
  tl.fromTo(c, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.55, ease: 'expo.out' }, 0)
    .set(to, { opacity: 1 }, 0.55)
    .add(() => c.remove(), 0.56);
}

/** Closing (owner 2026-11-18): the big image shrinks back into its tile while the layer fades; `done` clears the state. */
export function flyBack(tile: HTMLElement | null, done: () => void) {
  const layer = document.querySelector<HTMLElement>('.ga-full, .ga-panel');
  const img = layer?.querySelector<HTMLImageElement>('.ga-full-frame img, .ga-frame img');
  const a = img?.getBoundingClientRect(), b = tile?.getBoundingClientRect();
  if (!layer || !img || !a?.width || !b?.width || reduced() || b.bottom < 0 || b.top > innerHeight) return done();
  const c = Object.assign(new Image(), { src: img.currentSrc || img.src, alt: '', className: 'ga-fly' });
  Object.assign(c.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  document.body.append(c);
  img.style.opacity = '0';
  layer.style.pointerEvents = 'none';
  gsap.timeline({ onComplete: () => { c.remove(); } })
    .fromTo(c, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.42, ease: 'expo.inOut' }, 0)
    .to(layer, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0)
    .add(done, 0.3); // the layer is gone before the image lands; the copy finishes over the grid
}

/** Tab stays inside the open layer. */
export function trap(box: HTMLElement, e: KeyboardEvent) {
  const f = [...box.querySelectorAll<HTMLElement>('a[href],button:not([hidden]),[tabindex="0"]')]
    .filter((x) => x.offsetParent || x === document.activeElement);
  if (!f.length) return;
  e.preventDefault();
  const i = f.indexOf(document.activeElement as HTMLElement);
  f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
}

/** Horizontal swipe (phones) → prev / next; vertical scrolling is left alone. */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: ReactTouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: ReactTouchEvent) => {
      const a = start.current;
      start.current = null;
      if (!a) return;
      const dx = e.changedTouches[0].clientX - a.x, dy = e.changedTouches[0].clientY - a.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx > 0 ? onPrev : onNext)();
    },
  };
}

const ratio = (it: GalleryItem) => ({ '--r': `${it.w}/${it.h}`, '--ar': it.w / it.h }) as CSSProperties;

function facts(f: GalleryItem[], at: number, lang: Lang): [string, ReactNode][] {
  const it = f[at];
  const out: [string, ReactNode][] = [[s('gaFactKind', lang), s(KIND_LABEL[it.kind], lang)]];
  if (it.kind === 'story') {
    out.push([s('gaFactIn', lang), isVerGroup(it.group)
      ? <Name t={subText(it, lang)} />
      : <>{s(GROUP_LABEL[it.group as StoryGroup], lang)} · <Name t={subText(it, lang)} /></>]);
  }
  if (it.kind === 'loading' && it.note_cn) out.push([s('gaFactObtain', lang), <Name t={pick(lang, it.note_vi, it.note_cn)} />]);
  if (f.length > 1) out.push([s('gaFactPart', lang), `${at + 1} / ${f.length}`]);
  out.push([s('gaFactSize', lang), `${it.w} × ${it.h} px`], [s('gaFactId', lang), it.id]);
  return out;
}

function Poem({ t }: { t: Text }) {
  return (
    <p className={`ga-poem${t.zh ? ' ga-zh' : ''}`} lang={t.zh ? 'zh' : undefined}>
      {t.text.split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>)}
      {t.zh && <span className="ga-sr"> (chưa dịch)</span>}
    </p>
  );
}

export type PanelState = { n: number; at: number; shownAt: number; src: string | null }; // at: chosen version; shownAt: the one on screen

/** The panel over the page on the scrim: big image · versions strip · facts + "Tải ảnh". Phones: a full-screen sheet (CSS). */
export function Panel({ doc, f, state, from, busy, onPick, onFull, onClose }: {
  doc: GalleryDoc; f: GalleryItem[]; state: PanelState; from: HTMLElement | null; busy?: number;
  onPick: (at: number) => void; onFull: (frame: HTMLElement) => void; onClose: () => void;
}) {
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const it = f[state.at], pic = f[state.shownAt];
  const swipe = useSwipe(() => onPick(state.at - 1), () => onPick(state.at + 1));
  useLayoutEffect(() => {
    const el = box.current!;
    el.querySelector<HTMLElement>('.ga-x')?.focus({ preventScroll: true });
    if (reduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
      .fromTo(el.querySelectorAll('.ga-strip, .ga-info'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.15);
    if (state.src) fly(from, frame.current, tl, state.src);
    return () => { tl.progress(1).kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per opening
  const seen = useRef({ n: state.n, shownAt: state.shownAt });
  useLayoutEffect(() => { // ← / →: same layer, new content; another version: the new picture fades in
    const was = seen.current;
    seen.current = { n: state.n, shownAt: state.shownAt };
    if (reduced()) return;
    if (was.n !== state.n) gsap.fromTo(box.current!.querySelector('.ga-pin'), { opacity: 0.4 }, { opacity: 1, duration: 0.25 });
    else if (was.shownAt !== state.shownAt) gsap.fromTo(frame.current!.querySelector('img'), { opacity: 0 }, { opacity: 1, duration: 0.25 });
  }, [state.n, state.shownAt]);
  const full = () => { if (state.src && frame.current) onFull(frame.current); };
  return (
    <div className="ga-panel" ref={box} role="dialog" aria-modal="true" aria-label={title(f[0], lang).text} data-lenis-prevent
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ga-pin${f.length > 1 ? '' : ' is-one'}`}>
        <div className="ga-stage" {...swipe}>
          <div className="ga-frame" ref={frame} style={ratio(pic)} role="button" tabIndex={0} aria-label={s('gaFull', lang)}
            onClick={full} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); full(); } }}>
            {state.src ? <img src={state.src} alt={title(pic, lang).text} /> : <p className="ga-broken">{s('gaImageError', lang)}</p>}
            <span className="ga-zoom" aria-hidden="true"><Maximize2 size={16} /></span>
            {busy !== undefined && <Loading p={busy} />}
          </div>
        </div>
        {f.length > 1 && (
          <div className="ga-strip" role="group" aria-label={s('gaVersionsOf', lang)}>
            <b>{s('gaVersions', lang).replace('{n}', String(f.length))}</b>
            {f.map((x, i) => (
              <button key={x.id} type="button" aria-current={i === state.at} style={ratio(x)}
                aria-label={s('gaVersionN', lang).replace('{n}', String(i + 1))} onClick={() => onPick(i)}>
                <img src={thumbUrl(doc, x)} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className="ga-info">
          <div className="ga-top">
            <button type="button" className="ga-btn is-icon ga-x" aria-label={s('close', lang)} onClick={onClose}><X size={18} /></button>
          </div>
          <h2><Name t={title(it, lang)} /></h2>
          {it.kind === 'postcard' && it.note_cn && <Poem t={pick(lang, it.note_vi, it.note_cn)} />}
          <dl>{facts(f, state.at, lang).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
          <div className="ga-acts">
            <a className="ga-btn is-gold" href={origUrl(doc, it)} download={downloadName(it)}>
              <Download size={16} aria-hidden="true" /><span>{s('gaDownload', lang)}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export type FullState = { seq: GalleryItem[]; at: number; src: string | null; versions: boolean; step: -1 | 0 | 1 };

/** Full screen on the scrim (the page stays visible, darker): bar = name · n / N · download icon · ✕. */
export function FullScreen({ doc, state, from, busy, onStep, onClose }: {
  doc: GalleryDoc; state: FullState; from: HTMLElement | null; busy?: number; onStep: (d: -1 | 1) => void; onClose: () => void;
}) {
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const it = state.seq[state.at];
  const many = state.seq.length > 1;
  const swipe = useSwipe(() => onStep(-1), () => onStep(1));
  useLayoutEffect(() => {
    const el = box.current!;
    el.querySelector<HTMLElement>('.ga-x')?.focus({ preventScroll: true });
    if (reduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 0)
      .fromTo(el.querySelector('.ga-bar'), { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, 0.1);
    if (state.src) fly(from, frame.current, tl, state.src);
    return () => { tl.progress(1).kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per opening
  const seen = useRef(state.at);
  useLayoutEffect(() => {
    if (seen.current === state.at) return;
    seen.current = state.at;
    if (!reduced()) gsap.fromTo(frame.current, { opacity: 0.3, x: 12 * state.step }, { opacity: 1, x: 0, duration: 0.35, ease: 'expo.out' });
  }, [state.at, state.step]);
  const outside = (e: { target: EventTarget; currentTarget: EventTarget }) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="ga-full" ref={box} role="dialog" aria-modal="true" aria-labelledby="ga-full-title" data-lenis-prevent>
      <div className="ga-bar" onClick={outside}>
        <b id="ga-full-title"><Name t={title(it, lang)} /></b>
        {many && <span className="ga-ct">{state.at + 1} / {state.seq.length}</span>}
        <a className="ga-btn is-icon" href={origUrl(doc, it)} download={downloadName(it)} aria-label={s('gaDownload', lang)} title={s('gaDownload', lang)}>
          <Download size={18} aria-hidden="true" />
        </a>
        <button type="button" className="ga-btn is-icon ga-x" aria-label={s('close', lang)} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="ga-room" onClick={outside} {...swipe}>
        <div className="ga-full-frame" ref={frame} style={ratio(it)}>
          {state.src ? <img src={state.src} alt={title(it, lang).text} /> : <p className="ga-broken">{s('gaImageError', lang)}</p>}
          {busy !== undefined && <Loading p={busy} />}
        </div>
        {many && (
          <>
            <button type="button" className="ga-btn is-icon ga-pv" aria-label={s(state.versions ? 'gaPrevVer' : 'gaPrev', lang)} onClick={() => onStep(-1)}><ChevronLeft size={22} /></button>
            <button type="button" className="ga-btn is-icon ga-nx" aria-label={s(state.versions ? 'gaNextVer' : 'gaNext', lang)} onClick={() => onStep(1)}><ChevronRight size={22} /></button>
          </>
        )}
      </div>
    </div>
  );
}
