/** The slug URL for a character opened by ID (#/characters/W0182[/tab]), or null when the URL is already canonical.
 *  One URL per character: the router keys pages by the URL segment, so an ID URL and the slug URL of the same
 *  character looked like two pages and froze the tabs (2026-09-28). */
export function canonicalCharacterHash(slugInUrl: string, subtab: string, char: { slug?: string } | null) {
  if (!char?.slug || slugInUrl === char.slug) return null;
  return `#/characters/${char.slug}${subtab && subtab !== 'overview' ? `/${subtab}` : ''}`;
}
