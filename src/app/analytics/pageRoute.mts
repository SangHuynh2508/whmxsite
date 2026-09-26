// The site routes by hash (#/characters/…), which analytics tools don't see as page changes.
// Map a hash to the page analytics should record: the real path and a route that groups dynamic segments.
// ponytail: only the dynamic segments the router has today; add a pattern here when a new one appears.
const DYNAMIC: [RegExp, string][] = [
  [/^\/characters\/[^/]+(?<tail>\/[^/]+)?$/, '/characters/[slug]'],
  [/^\/skins\/[^/]+$/, '/skins/[id]'],
  [/^\/admin\/characters\/(?!terms(?:\/|$))[^/]+(?<tail>\/[^/]+)?$/, '/admin/characters/[id]'],
];

export function pageForHash(hash: string): { path: string; route: string } {
  const bare = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '');
  const path = bare || '/';
  for (const [pattern, base] of DYNAMIC) {
    const m = path.match(pattern);
    if (m) return { path, route: base + (m.groups?.tail ?? '') };
  }
  return { path, route: path };
}
