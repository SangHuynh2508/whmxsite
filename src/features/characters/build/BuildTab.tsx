import { StrictMode, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/buildTab.css';
import { getGameData, loadedGameDocument } from '../../../data/loader.js';
import { buildViews, type BuildView } from './buildView.mts';
import { BuildSheet } from './BuildSheet';
import { useReveal, useSlider } from '../motion';

function BuildTab({ views }: { views: BuildView[] }) {
  const [{ index, dir }, setState] = useState({ index: 0, dir: 0 });
  const setIndex = (i: number) => setState((s) => ({ index: i, dir: Math.sign(i - s.index) }));
  // motion (../motion.ts): the sheet arrives module by module; another build slides in from the side pressed
  const tabRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  useSlider(tabsRef, index);
  useReveal(tabRef, '.bs-band, .bs-mod', index, dir);
  return (
    <div className="build-tab" ref={tabRef}>
      {views.length > 1 && (
        <div className="build-tabs" role="tablist" aria-label="Các build" ref={tabsRef}>
          <span className="seg-ink" aria-hidden="true" />
          {views.map((b, i) => <button key={i} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)}>{b.name || `Build ${i + 1}`}</button>)}
        </div>
      )}
      <BuildSheet view={views[index]} />
    </div>
  );
}

// ponytail: same island pattern as LoreTab. The empty state (buildView.js) stays until the game document arrives
// with builds for this character; `generation` drops a late arrival after the tab or character changed.
let root: Root | null = null;
let generation = 0;

export function unmountBuildTab() {
  generation += 1;
  root?.unmount();
  root = null;
}

/** Resolves once the sheet is in the DOM (or there is none), so the tab transition can measure the real height. */
export function mountBuildTab(container: HTMLElement, char: { id: string }): Promise<void> {
  unmountBuildTab();
  const mine = generation;
  return loadedGameDocument().then((game) => {
    const docs = game?.builds?.[char.id];
    if (mine !== generation || !game || !docs?.length) return;
    const views = buildViews(docs, game, getGameData().characters, char.id);
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><BuildTab views={views} /></StrictMode>));
  });
}
