export const MODULE_IDS = ['overview', 'lore', 'build', 'skins', 'source', 'history'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type CharactersRoute = { view: 'list' } | { view: 'terms'; code?: string } | { view: 'gameTerms'; code?: string } | { view: 'record'; id: string; module: ModuleId };
import { dictionaryHref, tabOfGameKind } from './dictionary.mts';

const BASE = '#/admin/characters';

export function parseCharactersRoute(hash: string): CharactersRoute {
  let parts: string[];
  try { parts = hash.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { return { view: 'list' }; }
  const [id, module] = parts;
  if (!id) return { view: 'list' };
  if (id === 'terms') return module ? { view: 'terms', code: module } : { view: 'terms' };
  if (id === 'game-terms') return module ? { view: 'gameTerms', code: module } : { view: 'gameTerms' };
  return { view: 'record', id, module: (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : 'overview' };
}

export const recordHref = (id: string, module?: ModuleId) => `${BASE}/${encodeURIComponent(id)}${module ? `/${module}` : ''}`;
// Shared terms live in the admin Từ điển (the old …/terms and …/game-terms pages redirect there).
export const termHref = (code: string) => dictionaryHref('lore', code);
export const gameTermHref = (code: string) => dictionaryHref(tabOfGameKind(code.split(':')[0]), code);
