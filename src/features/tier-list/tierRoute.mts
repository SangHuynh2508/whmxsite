// #/tier-list[/<slug>[/characters|teams|info]] (spec 2026-10-02 §7). The only place that builds these URLs, so the
// move to URLs without "#" (next piece of work) is one edit here.
export const TABS = ['characters', 'teams', 'info'] as const;
export type Tab = typeof TABS[number];

export function parseTierListHash(hash: string): { slug: string; tab: Tab } | null {
  const m = hash.replace(/^#/, '').split('?')[0].match(/^\/?tier-list(?:\/([^/]*))?(?:\/([^/]*))?\/?$/);
  if (!m) return null;
  const tab = (TABS as readonly string[]).includes(m[2] ?? '') ? (m[2] as Tab) : 'characters';
  return { slug: m[1] ?? '', tab };
}

export const tierListHref = (slug = '', tab: Tab = 'characters') =>
  `#/tier-list${slug ? `/${slug}` : ''}${slug && tab !== 'characters' ? `/${tab}` : ''}`;
