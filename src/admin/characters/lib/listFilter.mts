export type LoreFilter = 'all' | 'unfinished' | 'legacy' | 'changed';
type Item = { characterId: string; nameCn: string | null; nameVi: { value: string | null }; fullnameVi: { value: string | null } };
type Progress = Record<string, { total: number; done: number; legacy: number; changed: number }>;

export function filterCharacters<T extends Item>(items: T[], progress: Progress, { query, filter }: { query: string; filter: LoreFilter }) {
  const q = query.trim().toLowerCase();
  return items.filter((c) => {
    if (q && ![c.characterId, c.nameCn, c.nameVi.value, c.fullnameVi.value].some((v) => v?.toLowerCase().includes(q))) return false;
    const p = progress[c.characterId];
    if (filter === 'unfinished') return !p || p.done < p.total;
    if (filter === 'legacy') return Boolean(p?.legacy);
    if (filter === 'changed') return Boolean(p?.changed);
    return true;
  });
}
