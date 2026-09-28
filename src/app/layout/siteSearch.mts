/** Global search of the mobile menu (owner 2026-09-28, mobile nav direction A): every page that has a detail page —
 *  characters and their non-base skins today. Accent-insensitive for Vietnamese ("thuong chu" → Thương Chu), plain
 *  substring for Chinese. Names that start with the query rank first, then characters before skins. */

type Skin = { skinID: string; name_vi?: string; name_cn?: string; is_base?: boolean };
type Character = { id: string; slug?: string; name_vi?: string; name_cn?: string; skins?: Skin[] };
export type SearchResult = { kind: 'character' | 'skin'; title: string; sub: string; characterId: string; href: string };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function searchSite(query: string, characters: Record<string, Character>, limit = 8): SearchResult[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { r: SearchResult; rank: number }[] = [];
  const consider = (r: SearchResult, names: string[]) => {
    const at = Math.min(...names.map((n) => fold(n).indexOf(q)).filter((i) => i >= 0));
    if (Number.isFinite(at)) scored.push({ r, rank: (at === 0 ? 0 : 2) + (r.kind === 'skin' ? 1 : 0) });
  };
  for (const c of Object.values(characters)) {
    const name = c.name_vi || c.name_cn || c.id;
    consider({ kind: 'character', title: name, sub: c.name_cn ?? '', characterId: c.id, href: `#/characters/${c.slug || c.id}` }, [c.name_vi ?? '', c.name_cn ?? '']);
    for (const s of c.skins ?? []) {
      if (s.is_base) continue;
      consider({ kind: 'skin', title: s.name_vi || s.name_cn || s.skinID, sub: name, characterId: c.id, href: `#/skins/${s.skinID}` }, [s.name_vi ?? '', s.name_cn ?? '']);
    }
  }
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map((x) => x.r);
}
