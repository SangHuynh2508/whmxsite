import { StrictMode, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/voiceTab.css';
import { Text } from '../lore/LoreTab.tsx';
import { s } from '../../../i18n/strings.mts';
import { audioUrl, loadVoiceDoc, loadVoiceViCached, type VoiceVi } from './voiceData.mts';
import { barLevels, groupsOf, packLabel, skinsOf, type GroupId, type Take, type VoiceDoc } from './voiceView.mts';

// Look C4 (docs/public-redesign/voice/direction-approved.md): one recorder panel, group tabs, takes as rows.
type Skin = { skinID?: string; name_vi?: string; name_cn?: string };
type Char = { id?: string; icon?: string; skins?: Skin[] };
const GROUP_KEY = { daily: 'voiceGrpDaily', growth: 'voiceGrpGrowth', battle: 'voiceGrpBattle', base: 'voiceGrpBase', other: 'voiceGrpOther' } as const satisfies Record<GroupId, string>;
const BARS = 48;
const pad = (n: number) => String(n).padStart(2, '0');
const mmss = (sec: number) => (Number.isFinite(sec) && sec > 0 ? `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}` : '0:00');

function VoiceTab({ char }: { char: Char }) {
  const [doc, setDoc] = useState<VoiceDoc | null | undefined>(undefined);
  const [li, setLi] = useState(0);
  const [skin, setSkin] = useState('');
  const [gi, setGi] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const meter = useRef<HTMLDivElement | null>(null);
  const [tr, setTr] = useState<VoiceVi | null>(null);

  // Published VI arrives after the tab is drawn; until then (or on failure) the lines stay in CN.
  useEffect(() => {
    let live = true;
    void loadVoiceViCached(import.meta.env.VITE_LORE_POINTER_URL).then((v) => { if (live) setTr(v); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    void loadVoiceDoc(char.id ?? '').then((d) => { if (live) setDoc(d); });
    return () => { live = false; };
  }, [char.id]);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'none';
    a.crossOrigin = 'anonymous'; // the meter reads the samples; R2 sends Access-Control-Allow-Origin: *
    audio.current = a;
    const tick = () => setPos({ t: a.currentTime, d: a.duration || 0 });
    a.addEventListener('timeupdate', tick);
    a.addEventListener('loadedmetadata', tick);
    a.addEventListener('play', () => setPlaying(true));
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('ended', () => setPlaying(false));
    a.addEventListener('error', () => { if (a.getAttribute('src')) { setPlaying(false); setFailed(true); } });
    return () => { a.pause(); audio.current = null; void (analyser.current?.context as AudioContext | undefined)?.close(); analyser.current = null; }; // leaving the tab stops the line
  }, []);

  // While a line plays, each bar follows one frequency band of the voice (low on the left); the gold part still
  // shows how far the line has played. Written straight to the bars each frame, no React render.
  useEffect(() => {
    const node = analyser.current;
    const bars = meter.current?.children;
    if (!playing || !node || !bars || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bins = new Uint8Array(node.frequencyBinCount);
    let raf = 0;
    const draw = () => {
      node.getByteFrequencyData(bins);
      barLevels(bins, bars.length).forEach((v, i) => { (bars[i] as HTMLElement).style.transform = `scaleY(${0.125 + 0.875 * v})`; });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); for (const b of bars) (b as HTMLElement).style.transform = ''; };
  }, [playing]);

  if (doc === undefined) return <section className="voice-tab"><p className="voice-empty">{s('voiceLoading')}</p></section>;
  if (!doc || !doc.langs.length) return <section className="voice-tab"><p className="voice-empty">{s('voiceNone')}</p></section>;

  const lang = doc.langs[Math.min(li, doc.langs.length - 1)];
  const skins = skinsOf(lang);
  const sk = skins.includes(skin) ? skin : skins[0];
  const groups = groupsOf(lang, sk, tr && { vi: tr.characters[doc.id] ?? {}, unlock: tr.unlock, main: doc.langs[0] });
  // The playing line read from the current groups, so a translation that arrives later shows without restarting it.
  const shown = take ? groups.flatMap((g) => g.takes).find((x) => x.n === take.n) ?? take : null;
  const gIndex = Math.min(gi, groups.length - 1);
  const group = groups[gIndex];

  const reset = () => { audio.current?.pause(); setTake(null); setFailed(false); setPos({ t: 0, d: 0 }); };
  const play = (t: Take) => {
    const a = audio.current;
    if (!a || !t.line.key) return;
    setTake(t);
    setFailed(false);
    setPos({ t: 0, d: 0 });
    a.src = audioUrl(doc, t.line.key);
    // First play (a click, so the AudioContext may start): route the element through an analyser for the meter.
    if (!analyser.current && 'AudioContext' in window) {
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.6;
      node.minDecibels = -80; // default -100 kept every band above half height; quiet bands now fall back
      node.maxDecibels = -20;
      ctx.createMediaElementSource(a).connect(node).connect(ctx.destination);
      analyser.current = node;
    }
    void (analyser.current?.context as AudioContext | undefined)?.resume();
    a.play().catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') { setPlaying(false); setFailed(true); } });
  };
  const toggle = () => {
    if (playing) { audio.current?.pause(); return; }
    const next = take ?? groups.flatMap((g) => g.takes).find((t) => t.playable);
    if (next) play(next);
  };
  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (gIndex + step + groups.length) % groups.length;
    setGi(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };
  const skinName = (id: string) => { const x = char.skins?.find((k) => k.skinID === id); return x?.name_vi || x?.name_cn || id; };
  const skinCv = (id: string) => lang.lines.find((l) => l.skin === id && l.cv)?.cv;

  return (
    <section className="voice-tab">
      <div className="voice-rec">
        {char.icon && <img className="voice-face" src={char.icon} alt="" />}
        <div className="voice-read" aria-live="polite" data-on={playing || undefined}>
          <div className="voice-row">
            <span>{shown ? <><b>{pad(shown.n)}</b> {shown.vi} · <span lang="zh">{shown.line.label}</span></> : s('voiceIdle')}</span>
            <span>{mmss(pos.t)} / {mmss(pos.d)}</span>
          </div>
          {failed ? <p className="voice-msg">{s('voiceFail')}</p>
            : shown?.text ? <>
                <Text unit={shown.text} as="p" className="voice-line" />
                {!shown.text.untranslated && <p className="voice-cn" lang="zh">{shown.cn}</p>}
              </>
              : <p className="voice-msg">{shown ? s('voiceNoText') : s('voiceHint')}</p>}
          <div className="voice-meter" aria-hidden="true" ref={meter}>
            {Array.from({ length: BARS }, (_, i) => <i key={i} />)}
          </div>
        </div>
        <div className="voice-ctl">
          {doc.langs.length > 1 && (
            <div className="voice-packs" role="radiogroup" aria-label={s('voicePacks')}>
              {doc.langs.map((L, i) => {
                const p = packLabel(L);
                return (
                  <button key={L.lang} type="button" role="radio" aria-checked={i === li} className="voice-pack"
                    onClick={() => { if (i !== li) { reset(); setLi(i); } }}>
                    <b lang="zh">{p.name}</b><span lang="zh">{p.sub}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="voice-go" onClick={toggle}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{playing ? <rect x="3" y="3" width="10" height="10" fill="currentColor" /> : <path d="M4 2.5v11l9-5.5z" fill="currentColor" />}</svg>
            {playing ? s('voiceStop') : s('voicePlay')}
          </button>
        </div>
      </div>

      {skins.length > 1 && (
        <div className="voice-skins" role="radiogroup" aria-label={s('voiceSkins')}>
          {skins.map((id) => { const cv = skinCv(id); return (
            <button key={id} type="button" role="radio" aria-checked={id === sk} className="voice-skin"
              onClick={() => { if (id !== sk) { reset(); setSkin(id); setGi(0); } }}>
              {skinName(id)}{cv && <span> · CV {cv}</span>}
            </button>
          ); })}
        </div>
      )}

      <div className="voice-groups" role="tablist" aria-label={s('voiceGroups')} onKeyDown={onTabsKey}>
        {groups.map((g, i) => (
          <button key={g.id} type="button" role="tab" id={`voice-tab-${g.id}`} aria-controls="voice-panel" aria-selected={i === gIndex}
            tabIndex={i === gIndex ? 0 : -1} className="voice-grp" onClick={() => setGi(i)}>
            {s(GROUP_KEY[g.id])}<span>{g.takes.length}</span>
          </button>
        ))}
      </div>
      <div className="voice-takes" role="tabpanel" id="voice-panel" aria-labelledby={`voice-tab-${group.id}`}>
        {group.takes.map((t) => (
          <button key={t.n} type="button" className="voice-take" disabled={!t.playable}
            data-playing={(take?.n === t.n && playing) || undefined} onClick={() => play(t)}>
            <span className="voice-no">{pad(t.n)}</span>
            <b>{t.vi}<span lang="zh">{t.line.label}</span></b>
            {t.text ? <Text unit={t.text} as="p" className="voice-text" /> : <p className="voice-text voice-text--none">{s('voiceNoText')}</p>}
            {(t.unlock || t.zone) && <small>{t.unlock ? <Text unit={t.unlock} /> : `${s('voiceZone')} ${t.zone}`}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

// Same lifecycle as the tea island (TeaTab.tsx): characterDetail unmounts it before every tab render.
let root: Root | null = null;
export function unmountVoiceTab() {
  root?.unmount();
  root = null;
}
export function mountVoiceTab(container: HTMLElement, char: unknown) {
  unmountVoiceTab();
  container.innerHTML = '';
  root = createRoot(container);
  const mounted = root;
  flushSync(() => mounted.render(<StrictMode><VoiceTab char={char as Char} /></StrictMode>));
}
