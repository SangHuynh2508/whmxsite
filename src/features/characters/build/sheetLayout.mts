// Pure: which blocks the build sheet shows and how wide (12-column grid). Rows are pairs split where the content needs
// (4|8, then 6|6: spec C1 after the critique) so the vertical rules never line up; a pair holds only while both halves
// stay short, otherwise each half takes the full width. Spec 2026-09-28 §4.
export type BlockId = 'weapons' | 'affixes' | 'rotations' | 'deepens' | 'tips' | 'teams';
export type Span = 4 | 6 | 8 | 12;
type LayoutInput = {
  weapons: unknown[]; affixes: { noReroll: boolean; groups: { items: unknown[] }[] };
  rotations: { note: string; steps: unknown[] }[]; deepens: unknown[]; tips: string[]; teams: unknown[]; teamOther: string;
};

export function sheetLayout(v: LayoutInput): { id: BlockId; span: Span }[] {
  const has: Record<BlockId, boolean> = {
    weapons: v.weapons.length > 0,
    affixes: v.affixes.groups.length > 0 || v.affixes.noReroll,
    rotations: v.rotations.length > 0,
    deepens: v.deepens.length > 0,
    tips: v.tips.some((t) => t.trim()),
    teams: v.teams.length > 0 || Boolean(v.teamOther),
  };
  const top = v.weapons.length <= 2 && v.affixes.groups.length <= 3 && v.affixes.groups.every((g) => g.items.length <= 5);
  const mid = v.deepens.length <= 3 && v.rotations.length <= 2 && v.rotations.every((r) => r.steps.length <= 5 && !r.note);
  const pair = (a: BlockId, b: BlockId, ok: boolean, sa: Span, sb: Span): [BlockId, Span][] =>
    (ok && has[a] && has[b] ? [[a, sa], [b, sb]] : [[a, 12], [b, 12]]);
  const rows: [BlockId, Span][] = [...pair('weapons', 'affixes', top, 4, 8), ...pair('rotations', 'deepens', mid, 6, 6), ['tips', 12], ['teams', 12]];
  return rows.filter(([id]) => has[id]).map(([id, span]) => ({ id, span }));
}

// Team grid track ≈ one avatar: a group spans enough tracks for its members, its label and ~3 lines of note.
export const teamSpan = (t: { label: string; note: string; members: unknown[] }) =>
  Math.min(6, Math.max(2, t.members.length, Math.ceil(t.label.length / 9), Math.ceil(t.note.length / 30)));
