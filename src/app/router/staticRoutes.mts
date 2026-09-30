// Routes owned by React pages without parameters (the query, e.g. banner filters, is the page's own) (spec 2026-09-30 §4). parseHash (router.js) asks this first.
export function staticView(hash: string): 'home' | 'banners' | 'info' | null {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/banners') return 'banners';
  if (path === '/info') return 'info';
  return null;
}
