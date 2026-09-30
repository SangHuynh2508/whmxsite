// The React island behind the Home, Banner and Thông tin pages (same pattern as BuildTab): one root per page,
// `generation` drops a late banners.json after the route changed, and a cached banners.json renders synchronously so
// the router's Back scroll restore lands on real content.
import { StrictMode, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { cachedBanners, loadBannersCached, type BannersDoc } from './bannersData.mts';

export function bannerIsland(Page: ComponentType<{ doc: BannersDoc | null }>) {
  let root: Root | null = null;
  let generation = 0;
  const unmount = () => {
    generation += 1;
    root?.unmount();
    root = null;
  };
  const render = (container: HTMLElement, doc: BannersDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><Page doc={doc} /></StrictMode>));
  };
  const mount = (container: HTMLElement): Promise<void> => {
    unmount();
    const hit = cachedBanners();
    if (hit) { render(container, hit); return Promise.resolve(); }
    const mine = generation;
    return loadBannersCached().then((doc) => { if (mine === generation) render(container, doc); });
  };
  return { mount, unmount };
}
