// "Mới ra mắt" on Home (spec 2026-09-30 §5): characters and non-base skins by unlock_date, released ones only.
export type ReleaseSkin = { skinID: string; name_vi?: string | null; name_cn: string; is_base?: boolean; unlock_date?: number | null; image?: string };
export type ReleaseChar = { id: string; name_vi?: string; name_cn: string; icon?: string; unlock_date?: number | null; skins?: ReleaseSkin[] };
export type Release = { kind: 'character' | 'skin'; id: string; charId: string; name: string; image: string; date: number; isNew: boolean };

export function newReleases(characters: Record<string, ReleaseChar>, nowS: number, versionStart: number | null, limit = 8): Release[] {
  const out: Release[] = [];
  for (const c of Object.values(characters)) {
    if (c.unlock_date && c.unlock_date <= nowS) {
      out.push({ kind: 'character', id: c.id, charId: c.id, name: c.name_vi || c.name_cn, image: c.icon ? `/${c.icon.replace(/^\//, '')}` : '', date: c.unlock_date, isNew: false });
    }
    for (const s of c.skins ?? []) {
      if (!s.is_base && s.unlock_date && s.unlock_date <= nowS) {
        out.push({ kind: 'skin', id: s.skinID, charId: c.id, name: s.name_vi || s.name_cn, image: s.image ?? '', date: s.unlock_date, isNew: false });
      }
    }
  }
  return out
    .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((r) => ({ ...r, isNew: versionStart !== null && r.date >= versionStart }));
}
