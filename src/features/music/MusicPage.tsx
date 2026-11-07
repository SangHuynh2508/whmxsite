// Âm nhạc page (spec docs/superpowers/specs/2026-11-08-music-page-design.md). Look: docs/public-redesign/music/direction-approved.md (Task 5).
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import { cachedMusic, loadMusicCached, type MusicDoc } from './musicData.mts';
import './styles/music.css';

export function MusicPage({ doc }: { doc: MusicDoc | null }) {
  const lang = useLang();
  if (!doc) return <div className="music-page"><p>{s('muLoadError', lang)}</p></div>;
  return <div className="music-page"><h1>{s('muTitle', lang)}</h1><p>{doc.tracks.length}</p></div>;
}

let root: Root | null = null;
let generation = 0;
export function unmountMusicPage() { generation += 1; root?.unmount(); root = null; }
export function mountMusicPage(container: HTMLElement): Promise<void> {
  unmountMusicPage();
  const render = (doc: MusicDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><MusicPage doc={doc} /></StrictMode>));
  };
  const hit = cachedMusic();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadMusicCached().then((doc) => { if (mine === generation) render(doc); });
}
