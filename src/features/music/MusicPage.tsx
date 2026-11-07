// Âm nhạc page (spec docs/superpowers/specs/2026-11-08-music-page-design.md). Look and behaviour:
// docs/public-redesign/music/direction-approved.md (direction B · Kệ đĩa + the 2026-11-08 critique fixes).
import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ChevronLeft, ChevronRight, Pause, Play, Search, Volume2, VolumeX } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import type { Lang } from '../../i18n/lang.mts';
import { reduced, useReveal, useSlider } from '../characters/motion.ts';
import { musicTrackId } from '../../app/router/staticRoutes.mts';
import { getActiveScrollContainer, resizeSmoothScroll, setScrollPositionImmediate } from '../../app/runtime/smoothScroll.js';
import {
  GROUPS, GROUP_LABEL, assetUrl, cachedMusic, clock, filterTracks, groupCounts, loadMusicCached, musicFilter, musicHash,
  trackName, trackTitle, type MusicDoc, type MusicGroup, type MusicTrack,
} from './musicData.mts';
import './styles/music.css';

gsap.registerPlugin(Flip);

type Route = { id: string; group: MusicGroup | 'all'; q: string };
const readRoute = (): Route => ({ id: musicTrackId(location.hash), ...musicFilter(location.hash) });

/** Chinese standing in for VI: Noto Serif SC, the ash dot (kept on the last glyph's line), "(chưa dịch)" for readers. */
function Name({ text, zh }: { text: string; zh: boolean }) {
  if (!zh) return <>{text}</>;
  const c = Array.from(text);
  return (
    <span className="music-zh" lang="zh">
      {c.slice(0, -1).join('')}<span className="music-nw">{c.at(-1)}<span className="music-dot" aria-hidden="true" /></span>
      <span className="music-sr"> (chưa dịch)</span>
    </span>
  );
}
/** VI page: the Vietnamese, else the Chinese with the dot; CN page: the Chinese. */
const tx = (lang: Lang, vi: string | undefined, cn: string) => <Name text={(lang === 'vi' && vi) || cn} zh={lang === 'vi' && !vi} />;

function Title({ t, lang }: { t: MusicTrack; lang: Lang }) {
  const n = trackName(t, lang);
  if (!t.name_cn && t.label_kind) return <>{s(GROUP_LABEL[t.label_kind], lang)} · <Name {...n} /></>;
  return <Name {...n} />;
}

function Disc({ doc, t, size }: { doc: MusicDoc; t: MusicTrack; size: 'shelf' | 'thumb' | 'big' }) {
  return t.cover
    ? <img className={`music-disc is-${size}`} data-flip-id={`music-disc-${t.id}`} src={assetUrl(doc, t.cover)} alt="" loading={size === 'big' ? undefined : 'lazy'} />
    : <span className={`music-disc is-${size} is-blank`} data-flip-id={`music-disc-${t.id}`} aria-hidden="true" />;
}

function usage(t: MusicTrack, lang: Lang): ReactNode[] {
  const out: ReactNode[] = [];
  if (t.stories_total) {
    out.push(<span key="s">{s('muStory', lang)}: {t.stories.slice(0, 2).map((x, i) => <span key={i}>{i ? ', ' : ''}{tx(lang, x.group_vi, x.group_cn)}</span>)}{t.stories_total > 2 && ` · ${s('muScenes', lang).replace('{n}', String(t.stories_total))}`}</span>);
  }
  if (t.stages.count) {
    out.push(<span key="m">{s('muStage', lang)}: {t.stages.names_cn.slice(0, 2).map((x, i) => <span key={i}>{i ? ', ' : ''}{tx(lang, t.stages.names_vi?.[i], x)}</span>)}{t.stages.count > 2 && ` +${t.stages.count - 2}`}</span>);
  }
  if (t.areas_cn.length) out.push(<span key="a">{s('muArea', lang)}: {t.areas_cn.slice(0, 3).map((x, i) => <span key={i}>{i ? ', ' : ''}{tx(lang, t.areas_vi?.[i], x)}</span>)}</span>);
  return out.length ? out.flatMap((x, i) => (i ? [' · ', x] : [x])) : [s('muNoUse', lang)];
}

// ---- one <audio> for the whole page, driven by the track page; leaving that page stops it ----
type Player = {
  track: MusicTrack | null; paused: boolean; time: number; dur: number; failed: boolean; volume: number; muted: boolean;
  canVolume: boolean;
};
function usePlayer(doc: MusicDoc) {
  const el = useRef<HTMLAudioElement>(null);
  const [p, setP] = useState<Player>({ track: null, paused: true, time: 0, dur: Number.NaN, failed: false, volume: 1, muted: false, canVolume: true });
  useEffect(() => {
    const a = el.current!;
    a.volume = 0.5;
    const canVolume = a.volume === 0.5; // iOS: volume is read-only, the hardware buttons own it
    a.volume = 1;
    const sync = () => setP((x) => ({ ...x, paused: a.paused, time: a.currentTime, dur: a.duration, canVolume }));
    const fail = () => setP((x) => ({ ...x, failed: true, paused: true }));
    const evs = ['play', 'pause', 'timeupdate', 'durationchange', 'ended', 'loadedmetadata'] as const;
    evs.forEach((e) => a.addEventListener(e, sync));
    a.addEventListener('error', fail);
    sync();
    return () => { a.pause(); evs.forEach((e) => a.removeEventListener(e, sync)); a.removeEventListener('error', fail); }; // leaving stops the music
  }, []);
  const api = {
    play(t: MusicTrack) {
      const a = el.current!;
      if (p.track?.id !== t.id || p.failed) { a.src = assetUrl(doc, t.file); setP((x) => ({ ...x, track: t, failed: false, time: 0, dur: Number.NaN })); }
      a.play().catch(() => {});
    },
    toggle(t: MusicTrack) { if (p.track?.id === t.id && !p.paused) el.current!.pause(); else api.play(t); },
    close() { const a = el.current!; a.pause(); a.removeAttribute('src'); a.load(); setP((x) => ({ ...x, track: null, paused: true })); },
    seek(sec: number) { el.current!.currentTime = sec; },
    setVolume(v: number) { const a = el.current!; a.volume = v; a.muted = false; setP((x) => ({ ...x, volume: v, muted: false })); },
    toggleMute() {
      const a = el.current!; const off = !(p.muted || p.volume === 0);
      const v = !off && p.volume === 0 ? 0.5 : p.volume;
      a.muted = off; a.volume = v; setP((x) => ({ ...x, muted: off, volume: v }));
    },
  };
  return { p, api, audio: <audio ref={el} preload="none" /> };
}
type PlayerApi = ReturnType<typeof usePlayer>['api'];

/** The disc turns while its track plays (9 s a turn) and stops where it is when paused. */
function useSpin(ref: RefObject<HTMLElement | null>, on: boolean) {
  const tween = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => { tween.current?.kill(); }, []);
  useEffect(() => { // every render: the element is a new one each time the track page mounts
    const el = ref.current;
    if (reduced() || !el) return;
    if (tween.current?.targets()[0] !== el) {
      tween.current?.kill();
      tween.current = gsap.to(el, { rotation: '+=360', duration: 9, ease: 'none', repeat: -1, paused: true });
    }
    if (on) tween.current.play(); else tween.current.pause();
  });
}

// ---- list ----
function List({ doc, route, go }: { doc: MusicDoc; route: Route; go: (r: Partial<Route>, replace?: boolean) => void }) {
  const lang = useLang();
  const page = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const counts = groupCounts(doc.tracks);
  const keys: (MusicGroup | 'all')[] = ['all', ...GROUPS];
  useSlider(tabs, keys.indexOf(route.group));
  useReveal(page, '.music-sec', `${route.group}|${route.q}`, 0, true);
  const shown = filterTracks(doc.tracks, route.group, route.q);
  const sections = route.group === 'all'
    ? GROUPS.map((g) => ({ g, ts: shown.filter((t) => t.group === g) })).filter((x) => x.ts.length)
    : shown.length ? [{ g: route.group, ts: shown }] : [];
  const href = (t: MusicTrack) => musicHash(t.id, route.group, route.q);
  return (
    <div ref={page}>
      <h1 className="music-title" tabIndex={-1}>{s('muTitle', lang)}</h1>
      <p className="music-lede">{s('muLede', lang).replace('{n}', String(doc.tracks.length)).replace('{v}', doc.version)}</p>
      <div className="music-tools">
        <label className="music-search">
          <Search size={16} aria-hidden="true" />
          <span className="music-sr">{s('muSearch', lang)}</span>
          <input type="search" value={route.q} placeholder={s('muSearch', lang)} onChange={(e) => go({ q: e.target.value }, true)} />
        </label>
        <div className="music-tabs" role="tablist" aria-label={s('muTitle', lang)} ref={tabs}>
          <span className="seg-ink" aria-hidden="true" />
          {keys.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={route.group === g} onClick={() => go({ group: g }, true)}>
              {s(g === 'all' ? 'muAll' : GROUP_LABEL[g], lang)}<span>{g === 'all' ? doc.tracks.length : counts[g]}</span>
            </button>
          ))}
        </div>
      </div>
      {!sections.length && (
        <div className="music-empty">
          <p>{s('muEmpty', lang)}</p>
          {route.q && <button type="button" className="music-btn" onClick={() => go({ q: '' }, true)}>{s('muClear', lang)}</button>}
        </div>
      )}
      {sections.map(({ g, ts }) => (
        <section key={g} className="music-sec">
          <h2>{s(GROUP_LABEL[g], lang)}{route.group !== 'all' && <span>{ts.length}</span>}</h2>
          {g === 'jukebox'
            ? <div className="music-shelf">{ts.map((t) => (
                <a key={t.id} className="music-cd" href={href(t)} data-id={t.id}><Disc doc={doc} t={t} size="shelf" /><b><Title t={t} lang={lang} /></b></a>
              ))}</div>
            : <div className="music-rows">{ts.map((t) => (
                <a key={t.id} className="music-row" href={href(t)} data-id={t.id}>
                  {t.cover && <Disc doc={doc} t={t} size="thumb" />}
                  <span><b><Title t={t} lang={lang} /></b><small>{usage(t, lang)}</small></span>
                </a>
              ))}</div>}
        </section>
      ))}
    </div>
  );
}

// ---- track page ----
function Track({ doc, t, route, p, api }: { doc: MusicDoc; t: MusicTrack; route: Route; p: Player; api: PlayerApi }) {
  const lang = useLang();
  const box = useRef<HTMLElement>(null);
  const big = useRef<HTMLDivElement>(null);
  const mine = p.track?.id === t.id;
  const playing = mine && !p.paused;
  useSpin(big, playing);
  useReveal(box, '.music-track-text > *', t.id);
  const list = filterTracks(doc.tracks, route.group, route.q);
  const i = list.findIndex((x) => x.id === t.id);
  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  useEffect(() => {
    const was = document.title;
    document.title = `${trackTitle(t, lang)} · ${s('muTitle', lang)}`;
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, button, a, textarea')) return;
      e.preventDefault(); api.toggle(t);
    };
    addEventListener('keydown', key);
    return () => { document.title = was; removeEventListener('keydown', key); };
  });
  const time = mine ? p.time : 0;
  const dur = mine ? p.dur : Number.NaN;
  const off = p.muted || p.volume === 0;
  const name = trackName(t, lang);
  return (
    <article className="music-track" ref={box}>
      <a className="music-back" href={musicHash('', route.group, route.q)}><ChevronLeft size={16} aria-hidden="true" />{s('muTitle', lang)}</a>
      <div className="music-track-grid">
        <div className="music-big" ref={big}><Disc doc={doc} t={t} size="big" /></div>
        <div className="music-track-text">
          <p className="music-kind">{t.groups.map((g) => s(GROUP_LABEL[g], lang)).join(' · ')}</p>
          <h1 className="music-title" tabIndex={-1}><Name {...name} /></h1>
          {mine && p.failed ? (
            <p className="music-error">{s('muPlayError', lang)} <button type="button" className="music-btn" onClick={() => api.play(t)}>{s('muRetry', lang)}</button></p>
          ) : (
            <div className="music-ctl">
              <button type="button" className="music-pp" aria-label={s(playing ? 'muPause' : 'muPlay', lang)} onClick={() => api.toggle(t)}>
                {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
              </button>
              <input className="music-seek" type="range" min={0} max={Number.isFinite(dur) ? dur : 0} step="any" value={time} disabled={!mine}
                aria-label={s('muSeek', lang)} aria-valuetext={`${clock(time)} / ${clock(dur)}`} onChange={(e) => api.seek(Number(e.target.value))} />
              <span className="music-time">{clock(time)} / {clock(dur)}</span>
              <span className="music-vol">
                <button type="button" className="music-mute" aria-label={s(off ? 'muUnmute' : 'muMute', lang)} onClick={api.toggleMute}>
                  {off ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                </button>
                {p.canVolume && <input className="music-volume" type="range" min={0} max={1} step={0.05} value={p.muted ? 0 : p.volume}
                  aria-label={s('muVolume', lang)} onChange={(e) => api.setVolume(Number(e.target.value))} />}
              </span>
            </div>
          )}
          <div className="music-uses">
            {t.source_cn && <><h2>{s('muSource', lang)}</h2><p>{tx(lang, t.source_vi, t.source_cn)}</p></>}
            {!!t.stories.length && <>
              <h2>{s('muUsedStory', lang)}</h2>
              <ul>{t.stories.map((x, k) => <li key={k}>{tx(lang, x.group_vi, x.group_cn)}{x.count > 1 && <span>{s('muScenes', lang).replace('{n}', String(x.count))}</span>}</li>)}</ul>
              {t.stories_total > t.stories.reduce((a, x) => a + x.count, 0) && <p className="music-more">{s('muScenesTotal', lang).replace('{n}', String(t.stories_total))}</p>}
            </>}
            {!!t.stages.count && <>
              <h2>{s('muUsedStage', lang)}</h2>
              <ul>{t.stages.names_cn.map((x, i) => <li key={x}>{tx(lang, t.stages.names_vi?.[i], x)}</li>)}</ul>
              {t.stages.count > t.stages.names_cn.length && <p className="music-more">{s('muMore', lang).replace('{n}', String(t.stages.count - t.stages.names_cn.length))}</p>}
            </>}
            {!!t.areas_cn.length && <><h2>{s('muUsedArea', lang)}</h2><ul>{t.areas_cn.map((x, i) => <li key={x}>{tx(lang, t.areas_vi?.[i], x)}</li>)}</ul></>}
            {!t.stories.length && !t.stages.count && !t.areas_cn.length && <p className="music-more">{s('muNoUse', lang)}</p>}
          </div>
          <nav className="music-nb">
            {prev ? <a href={musicHash(prev.id, route.group, route.q)}><small><ChevronLeft size={14} aria-hidden="true" />{s('muPrev', lang)}</small><b><Title t={prev} lang={lang} /></b></a> : <span />}
            {next && <a className="is-next" href={musicHash(next.id, route.group, route.q)}><small>{s('muNext', lang)}<ChevronRight size={14} aria-hidden="true" /></small><b><Title t={next} lang={lang} /></b></a>}
          </nav>
        </div>
      </div>
    </article>
  );
}

// ---- page: route state from the hash, scroll memory, the disc's flight between list and track ----
// Desktop scrolls the route view (through Lenis), phones the document. Lenis is always told, even when the view
// cannot scroll (a short track page): it skips a scrollTo to the position it believes it is at. It is re-measured
// first, since it still holds the previous route's limit and would clamp the list's position.
const scrollY = () => Math.max(getActiveScrollContainer()?.scrollTop ?? 0, window.scrollY);
const scrollTo = (y: number) => {
  resizeSmoothScroll();
  setScrollPositionImmediate(y);
  if (document.documentElement.scrollHeight > innerHeight) window.scrollTo(0, y);
};

export function MusicPage({ doc }: { doc: MusicDoc | null }) {
  const lang = useLang();
  if (!doc) return <div className="music-page"><p className="music-empty">{s('muLoadError', lang)}</p></div>;
  return <Music doc={doc} />;
}

function Music({ doc }: { doc: MusicDoc }) {
  const [route, setRoute] = useState<Route>(readRoute);
  const { p, api, audio } = usePlayer(doc);
  const flight = useRef<Flip.FlipState | null>(null);
  const listY = useRef(0);
  const autoplay = useRef(false);
  const current = useRef(route);
  current.current = route;
  const t = route.id ? doc.tracks.find((x) => x.id === route.id) ?? null : null;

  useEffect(() => {
    const onHash = () => {
      const next = readRoute(), cur = current.current;
      if (next.id !== cur.id && !reduced()) {
        // capture the disc on screen now (shelf slot or big disc); the new view's disc with the same flip id flies from it
        const from = document.querySelector<HTMLElement>(`.music-page [data-flip-id="music-disc-${next.id || cur.id}"]`);
        flight.current = from ? Flip.getState(from) : null;
      }
      if (!cur.id && next.id) listY.current = scrollY();
      setRoute(next);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // a click inside the page that opens a track plays it (a user gesture); a shared link or Back does not
  useEffect(() => {
    if (t && autoplay.current) api.play(t);
    autoplay.current = false;
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevId = useRef(route.id);
  useLayoutEffect(() => {
    if (prevId.current === route.id) return;
    const back = !route.id;
    prevId.current = route.id;
    if (p.track) api.close(); // the music belongs to its track page: leaving it stops it (owner 2026-11-08)
    scrollTo(back ? listY.current : 0);
    document.querySelector<HTMLElement>('.music-page .music-title')?.focus({ preventScroll: true });
    const state = flight.current;
    flight.current = null;
    if (!state) return;
    const id = (state.targets[0] as HTMLElement | undefined)?.dataset.flipId;
    const to = id && document.querySelector<HTMLElement>(`.music-page [data-flip-id="${id}"]`);
    if (!to) return;
    // The shelf disc's CSS hover transition would tween Flip's last transform when Flip clears it (the disc jumped
    // down-right, then slid home). Flip clears after onComplete, so the transition comes back a frame later.
    to.style.transition = 'none';
    Flip.from(state, {
      targets: to, duration: 0.55, ease: 'expo.out', absolute: true, zIndex: 5,
      onComplete: () => requestAnimationFrame(() => { to.style.transition = ''; }),
    });
  }, [route.id]);

  const go = (r: Partial<Route>, replace = false) => {
    const n = { ...route, ...r };
    const h = musicHash(n.id, n.group, n.q);
    if (replace) { history.replaceState(null, '', h); setRoute(n); } else location.hash = h;
  };
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a[href^="#/music/"]')) autoplay.current = true;
  };
  return (
    <div className="music-page" onClickCapture={onClick}>
      {t ? <Track doc={doc} t={t} route={route} p={p} api={api} /> : <List doc={doc} route={route} go={go} />}
      {audio}
    </div>
  );
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let generation = 0;
export function unmountMusicPage() { generation += 1; root?.unmount(); root = null; host = null; }
export function mountMusicPage(container: HTMLElement): Promise<void> {
  // #/music ↔ #/music/<id> stay in this island (the router re-calls mount on every hash): the page follows the hash
  // itself, so the disc can fly between the two views.
  if (root && host === container && container.firstChild) return Promise.resolve();
  unmountMusicPage();
  const render = (doc: MusicDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    host = container;
    flushSync(() => mounted.render(<StrictMode><MusicPage doc={doc} /></StrictMode>));
  };
  const hit = cachedMusic();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadMusicCached().then((doc) => { if (mine === generation) render(doc); });
}
