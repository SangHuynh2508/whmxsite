// Map a route (routeString(): '#/characters/…' for path pages, the admin's own hash) to the page analytics records.
// ponytail: only the dynamic segments the router has today; add a pattern here when a new one appears.
const DYNAMIC: [RegExp, string][] = [
  [/^\/characters\/[^/]+(?<tail>\/[^/]+)?$/, '/characters/[slug]'],
  [/^\/skins\/[^/]+$/, '/skins/[id]'],
  [/^\/admin\/characters\/(?!terms(?:\/|$))[^/]+(?<tail>\/[^/]+)?$/, '/admin/characters/[id]'],
  [/^\/admin\/dictionary\/(?<tab>[^/]+)\/[^/]+$/, '/admin/dictionary/[tab]/[code]'],
];

export function pageForHash(hash: string): { path: string; route: string } {
  const bare = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '');
  const path = bare || '/';
  for (const [pattern, base] of DYNAMIC) {
    const m = path.match(pattern);
    if (m) return { path, route: base.replace('[tab]', m.groups?.tab ?? '[tab]') + (m.groups?.tail ?? '') };
  }
  return { path, route: path };
}
