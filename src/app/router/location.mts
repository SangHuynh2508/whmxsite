// Public pages route by path (/characters/<slug>/build, spec 2026-11-09 seo-path-urls). The parsers in router.js,
// staticRoutes, tierRoute and musicData still read a '#/…' string, so routeString() hands them one; the admin keeps
// its hash (#/admin…, #/login).
export const ROUTE_EVENT = 'whmx:route';

const isAdminHash = (hash: string) => /^#\/(admin|login)(?:[/?]|$)/.test(hash);

export function routeString(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = location): string {
  if (isAdminHash(loc.hash)) return loc.hash;
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  return `#${path}${loc.search}`;
}

/** An old shared '#/…' link → the path of the same page; null for the admin or no hash. */
export function legacyHashToPath(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h || isAdminHash(hash)) return null;
  const [pathPart, query = ''] = h.split('?');
  const qs = query ? `?${query}` : '';
  if (/^\/?(calc|calculator)$/.test(pathPart)) return `/calculator${qs}`;
  if (!pathPart.includes('/')) return `/calculator?char=${encodeURIComponent(pathPart)}`; // '#W0182'
  const path = pathPart.replace(/^\/?/, '/');
  if (path === '/data') return '/weapons';
  if (path === '/gallery-demo') return '/gallery';
  return `${path}${qs}`;
}

export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  const oldHash = location.hash;
  if (`${location.pathname}${location.search}${location.hash}` !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  // pushState fires no hashchange, and the admin shell follows the hash: entering or leaving it needs one.
  if (location.hash !== oldHash) dispatchEvent(new HashChangeEvent('hashchange'));
  dispatchEvent(new Event(ROUTE_EVENT));
}

// Files and endpoints served by Vercel, never app routes.
const NOT_A_PAGE = /^\/(api|assets|src)\/|\.[a-z0-9]+$/i;

export function shouldIntercept(
  e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  a: { target: string; origin: string; hasAttribute(n: string): boolean; getAttribute(n: string): string | null },
  origin: string,
): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== origin) return false;
  const href = a.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('//') && !NOT_A_PAGE.test(href.split(/[?#]/)[0]);
}

export function initLinkInterception() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !shouldIntercept(e, a, location.origin)) return;
    e.preventDefault();
    navigate(a.getAttribute('href')!);
  });
  const legacy = () => {
    const path = legacyHashToPath(location.hash);
    if (path) navigate(path, { replace: true });
    return Boolean(path);
  };
  addEventListener('popstate', () => { if (!legacy()) dispatchEvent(new Event(ROUTE_EVENT)); });
  // A pasted or typed old '#/…' link. The admin's own hash changes are its shell's business (navigate() already
  // fires the route for the ones it makes).
  addEventListener('hashchange', legacy);
}
