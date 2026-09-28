// Admin "Từ điển" (owner 2026-09-27): every shared translation in one area, split by tabs — weapons (name + its
// skills together), affixes, 深造, lore terms. Pure: routes, tab of a game-text kind, translation progress.
export const DICTIONARY_TABS = [
  ['weapons', 'Vũ khí'], ['affixes', 'Dòng thuộc tính'], ['deepen', 'Thâm tạo'], ['lore', 'Lore'],
] as const;
export type DictionaryTab = (typeof DICTIONARY_TABS)[number][0];
export const DICTIONARY_HREF = '#/admin/dictionary';

const TABS = DICTIONARY_TABS.map(([id]) => id) as readonly string[];

export function parseDictionaryRoute(hash: string): { tab: DictionaryTab; code?: string } {
  let parts: string[];
  try { parts = hash.slice(DICTIONARY_HREF.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { return { tab: 'weapons' }; }
  const [tab, code] = parts;
  if (!TABS.includes(tab)) return { tab: 'weapons' };
  return code ? { tab: tab as DictionaryTab, code } : { tab: tab as DictionaryTab };
}

export const dictionaryHref = (tab: DictionaryTab, code?: string) => `${DICTIONARY_HREF}/${tab}${code ? `/${encodeURIComponent(code)}` : ''}`;

export const tabOfGameKind = (kind: string): DictionaryTab =>
  (kind === 'weapon' || kind === 'weapon_skill' ? 'weapons' : kind === 'weapon_affix' ? 'affixes' : 'deepen');

// #/admin/characters/terms[/code] and …/game-terms[/kind:code] (before the Từ điển) → the matching tab.
export function legacyTermsHref(route: { view: 'terms' | 'gameTerms'; code?: string }) {
  if (route.view === 'terms') return dictionaryHref('lore', route.code);
  return route.code ? dictionaryHref(tabOfGameKind(route.code.split(':')[0]), route.code) : dictionaryHref('weapons');
}

type Translated = { nameCn: string; nameVi: string | null; detailCn: string; detailVi: string | null; viOrigin: 'admin' | null; state: 'ok' | 'source_changed' };
// What the public page shows in VI: an official name, and the description too when the term has one. A row with no
// Chinese at all (some weapon skills have neither name nor text) has nothing to translate.
export const isDone = (t: Translated) => (!t.nameCn && !t.detailCn)
  || (t.viOrigin === 'admin' && t.state === 'ok' && (!t.nameCn || Boolean(t.nameVi)) && (!t.detailCn || Boolean(t.detailVi)));
export const progress = (terms: Translated[]) => ({ done: terms.filter(isDone).length, total: terms.length });

// Rows of one kind with the same Chinese (name + description) share one translation (owner 2026-09-27: the 60 深造
// columns are 4 names × 15 styles, 428 talents are 35 texts). The evidence is the identical source text, never the
// code. The row stands for its twins and shows a translated one when there is one.
type Keyed = Translated & { kind: string; code: string };
export function mergeSameText<T extends Keyed>(terms: T[]): (T & { twins: T[] })[] {
  const groups = new Map<string, T[]>();
  for (const t of terms) {
    const key = JSON.stringify([t.kind, t.nameCn, t.detailCn]);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].map((twins) => ({ ...(twins.find(isDone) ?? twins.find((t) => t.nameVi || t.detailVi) ?? twins[0]), twins }));
}
const official = (t: Translated) => t.viOrigin === 'admin' && t.state === 'ok';
// Twins whose published translation differs from the row's.
export const outOfStep = <T extends Keyed>(row: T & { twins: T[] }) =>
  row.twins.filter((t) => t.nameVi !== row.nameVi || t.detailVi !== row.detailVi || official(t) !== official(row));
