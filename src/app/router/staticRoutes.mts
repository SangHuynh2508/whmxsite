// Routes owned by React pages without parameters (spec 2026-09-30 §4). parseHash (router.js) asks this first.
export function staticView(hash: string): 'home' | 'banners' | null {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/banners') return 'banners';
  return null;
}
