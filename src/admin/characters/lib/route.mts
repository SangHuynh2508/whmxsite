export const MODULE_IDS = ['overview', 'lore', 'skins', 'source', 'history'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type CharactersRoute = { view: 'list' } | { view: 'terms'; code?: string } | { view: 'record'; id: string; module: ModuleId };
const BASE = '#/admin/characters';

export function parseCharactersRoute(hash: string): CharactersRoute {
  let parts: string[];
  try { parts = hash.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { return { view: 'list' }; }
  const [id, module] = parts;
  if (!id) return { view: 'list' };
  if (id === 'terms') return module ? { view: 'terms', code: module } : { view: 'terms' };
  return { view: 'record', id, module: (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : 'overview' };
}

export const recordHref = (id: string, module?: ModuleId) => `${BASE}/${encodeURIComponent(id)}${module ? `/${module}` : ''}`;
export const TERMS_HREF = `${BASE}/terms`;
export const termHref = (code: string) => `${TERMS_HREF}/${encodeURIComponent(code)}`;
