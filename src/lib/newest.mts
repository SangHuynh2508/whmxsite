// "Mới ra mắt trước" — the site's default order for characters and skins (owner 2026-09-30): release date (unix s)
// descending, anything without a date last, ties by id descending (the newer id first).
export function newestFirst(dateA: number | null | undefined, dateB: number | null | undefined, idA: string, idB: string): number {
  const a = dateA && dateA > 0 ? dateA : 0, b = dateB && dateB > 0 ? dateB : 0;
  return b - a || idB.localeCompare(idA);
}
