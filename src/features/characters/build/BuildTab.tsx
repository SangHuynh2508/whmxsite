import { StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/buildTab.css';
import { getGameData, loadedGameDocument } from '../../../data/loader.js';
import { buildViews, type BuildView } from './buildView.mts';
import { BuildSheet } from './BuildSheet';

function BuildTab({ views }: { views: BuildView[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="build-tab">
      {views.length > 1 && (
        <div className="build-tabs" role="tablist" aria-label="Các build">
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

export function mountBuildTab(container: HTMLElement, char: { id: string }) {
  unmountBuildTab();
  const mine = generation;
  void loadedGameDocument().then((game) => {
    const docs = game?.builds?.[char.id];
    if (mine !== generation || !game || !docs?.length) return;
    const views = buildViews(docs, game, getGameData().characters, char.id);
    container.innerHTML = '';
    root = createRoot(container);
    root.render(<StrictMode><BuildTab views={views} /></StrictMode>);
  });
}
