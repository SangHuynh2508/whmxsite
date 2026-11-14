// Routes owned by React pages without parameters (the query, e.g. banner filters, is the page's own) (spec 2026-09-30 §4). parseHash (router.js) asks this first.
export function staticView(hash: string): 'home' | 'banners' | 'info' | 'music' | 'coffee' | null {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/banners') return 'banners';
  if (path === '/info') return 'info';
  if (path === '/coffee') return 'coffee';
  if (path === '/music' || /^\/music\/[^/]+$/.test(path)) return 'music'; // the track id is the page's own
  return null;
}

/** '#/music/Bgm_Map' → 'bgm_map'; '' for the list or anything else. */
export function musicTrackId(hash: string): string {
  const m = /^\/music\/([^/]+)$/.exec(hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, ''));
  if (!m) return '';
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return ''; } // '#/music/%' must not throw
}
