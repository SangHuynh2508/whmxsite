type Report = { fileId: string; kind: string; unlock?: { type: number; elementId: string } };
type Term = { nameCn: string; nameVi: string | null } | null;
export type LoreItem = { unitKey: string; label: string; extra?: string };

export function loreUnitGroups(structure: { reports: Report[]; timeline: string[] }, unitKeys: string[], affinity: Record<string, Term>) {
  const present = new Set(unitKeys);
  const reports: LoreItem[] = [];
  let n = 0;
  for (const r of structure.reports) {
    const basic = r.kind === 'basic';
    const suffix = basic ? String(++n) : 'mật';
    const level = basic && r.unlock?.type === 2 ? r.unlock.elementId : null;
    const term = level ? affinity[level] : null;
    const extra = level ? `Mở khoá: thiện cảm ${level}${term ? ` · ${term.nameVi || term.nameCn}` : ''}` : undefined;
    reports.push({ unitKey: `report.${r.fileId}.title`, label: `Tiêu đề ${suffix}`, extra }, { unitKey: `report.${r.fileId}.content`, label: `Báo cáo ${suffix}` });
  }
  const groups: { group: string; items: LoreItem[] }[] = [
    { group: 'Giới thiệu', items: [{ unitKey: 'quote', label: 'Lời chiêu mộ' }, { unitKey: 'card_intro', label: 'Đánh giá' }] },
    { group: 'Báo cáo', items: reports },
    { group: 'Hiện vật', items: [{ unitKey: 'relic_intro', label: 'Giới thiệu hiện vật' }] },
    { group: 'Dòng thời gian', items: structure.timeline.flatMap((s) => [{ unitKey: `timeline.${s}.label`, label: `Mốc ${s}` }, { unitKey: `timeline.${s}.story`, label: `Câu chuyện ${s}` }]) },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => present.has(i.unitKey)) })).filter((g) => g.items.length);
}
