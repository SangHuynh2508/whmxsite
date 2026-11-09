// The route for a '#/…' string from routeString() (location.mts). Pure, so the router's parsing is tested.
// Pages match on the path only: a query such as ?lang=vi (language switch) or ?fbclid= (Facebook shares) must never
// become part of a slug or id (2026-11-10). The calculator, banners, music and tier list read their own query.
import { staticView } from './staticRoutes.mts';
import { parseTierListHash } from '../../features/tier-list/tierRoute.mts';

export type Route = { view: string; slug?: string; subtab?: string; skinId?: string; characterId?: string; redirect?: string };

export function parseRoute(raw: string): Route {
  const hash = raw.replace('#', '').trim();
  const path = hash.split('?')[0].replace(/\/+$/, '');

  const pageView = staticView(raw);
  if (pageView) return { view: pageView, slug: '', subtab: '' };

  // Admin routes are owned by the React shell (src/admin/layout/AdminApp.tsx).
  if (path === '/login' || path === '/admin' || path.startsWith('/admin/')) return { view: 'admin', slug: '', subtab: '' };

  const tierList = parseTierListHash(raw);
  if (tierList) return { view: 'tier-list', slug: tierList.slug, subtab: tierList.tab };

  if (path === '/characters' || path === 'characters') return { view: 'catalog', slug: '', subtab: '' };

  const char = path.match(/^\/?characters\/([^/]+)(?:\/([^/]+))?$/i);
  if (char) return { view: 'character', slug: char[1], subtab: char[2] || 'overview' };

  if (path === '/weapons' || path === 'weapons') return { view: 'weapons', slug: '', subtab: '' };
  if (path === '/data' || path === 'data') return { view: 'weapons', slug: '', subtab: '', redirect: '/weapons' };

  const skin = path.match(/^\/?skins\/([^/]+)$/i);
  if (skin) return { view: 'skin-detail', skinId: skin[1], slug: '', subtab: '' };

  if (path === '/gallery-demo' || path === 'gallery-demo') return { view: 'gallery', slug: '', subtab: '', redirect: '/gallery' };
  if (['/gallery', 'gallery', '/skins', 'skins'].includes(path)) return { view: 'gallery', slug: '', subtab: '' };

  // /calculator?char=W0182 (old #calc… links are rewritten by legacyHashToPath)
  if (/^\/?calc(ulator)?(\?|$)/.test(hash)) {
    const params = new URLSearchParams(hash.replace(/^\/?calc(ulator)?\??/, ''));
    return { view: 'calculator', characterId: params.get('char') || params.get('id') || '', subtab: '' };
  }

  // Legacy direct character ID e.g. #W0182
  if (path && !path.includes('/')) return { view: 'calculator', characterId: path, subtab: '' };

  return { view: 'catalog', slug: '', subtab: '' };
}
