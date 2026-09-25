export const MODULE_IDS = ['overview', 'skins', 'source', 'history'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type CharactersRoute = { view: 'list' } | { view: 'record'; id: string; module: ModuleId };
const BASE = '#/admin/characters';

export function parseCharactersRoute(hash: string): CharactersRoute {
  let parts: string[];
  try { parts = hash.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { return { view: 'list' }; }
  const [id, module] = parts;
  if (!id) return { view: 'list' };
  return { view: 'record', id, module: (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : 'overview' };
}

export const recordHref = (id: string, module?: ModuleId) => `${BASE}/${encodeURIComponent(id)}${module ? `/${module}` : ''}`;
