import { audioUrl } from '../../../features/characters/voice/voiceData.mts';
import { GROUP_OF, GROUP_ORDER, LABEL_VI, type GroupId, type VoiceDoc } from '../../../features/characters/voice/voiceView.mts';

type Report = { fileId: string; kind: string; unlock?: { type: number; elementId: string } };
type Term = { nameCn: string; nameVi: string | null } | null;
export type LoreItem = { unitKey: string; label: string; extra?: string; audio?: string };

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

// Shared terms (type, era, museum, relic tags, organisation, affinity levels…) show on the public lore tab too;
// they are translated on the terms page, so the unit count alone can read "19/19" while the page still shows CN.
export function termProgress(terms: ({ code: string; done: boolean } | null)[]) {
  const unique = new Map(terms.flatMap((t) => (t ? [[t.code, t.done] as const] : [])));
  return { done: [...unique.values()].filter(Boolean).length, total: unique.size };
}

export type TeaStructure = { teas: string[]; topics: { id: string; trend: number }[]; branches: { id: string; next: { id: string; trend: number }[] }[] };
export type Scope = 'lore' | 'tea' | 'voice';
const scopeOf = (unitKey: string): Scope => (unitKey.startsWith('tea.') ? 'tea' : unitKey.startsWith('voice.') ? 'voice' : 'lore');
export const inScope = (unitKey: string, scope: Scope) => scopeOf(unitKey) === scope;

const REACTION: Record<number, string> = { 1: 'thích', 2: 'bối rối' };
// The Phòng trà module (spec 2026-10-03 §7): the game's order, a label per question / answer, the reaction shown beside
// the answer so the translator knows how the character took it.
export function teaUnitGroups(tea: TeaStructure | undefined, unitKeys: string[], teaTerms: Record<string, Term>) {
  if (!tea) return [];
  const present = new Set(unitKeys);
  const teaName = (code: string) => teaTerms[code]?.nameVi || teaTerms[code]?.nameCn || code;
  const pair = (id: string, label: string, trend?: number): LoreItem[] => [
    { unitKey: `tea.${id}.ask`, label: `${label} · hỏi` },
    { unitKey: `tea.${id}.reply`, label: `${label} · đáp`, extra: trend !== undefined && REACTION[trend] ? `Phản ứng: ${REACTION[trend]}` : undefined },
  ];
  const groups: { group: string; items: LoreItem[] }[] = [
    { group: 'Trà', items: tea.teas.map((code, i) => ({ unitKey: `tea.comment.${i + 1}`, label: `Lời bình · ${teaName(code)}` })) },
    { group: 'Câu 1–2 · 缘起 相知', items: tea.topics.flatMap((t, i) => pair(t.id, `Chủ đề ${i + 1}`, t.trend)) },
    { group: 'Câu 3–4 · 契合', items: tea.branches.flatMap((b, i) => [...pair(b.id, `Nhánh ${i + 1}`), ...b.next.flatMap((n, j) => pair(n.id, `Nhánh ${i + 1}.${j + 1}`, n.trend))]) },
    { group: 'Kết thúc', items: [{ unitKey: 'tea.win', label: 'Thành công' }, { unitKey: 'tea.result', label: 'Thơ kết riêng' }, { unitKey: 'tea.lose', label: 'Thất bại' }] },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => present.has(i.unitKey)).map((i) => (i.extra === undefined ? { unitKey: i.unitKey, label: i.label } : i)) })).filter((g) => g.items.length);
}

// The Lồng tiếng module (spec 2026-11-19-voice-translation §6): the tab's groups and labels (one table, voiceView.mts),
// line order from public/voice/<ID>.json, a play button per line that has an mp3.
const VOICE_GROUP: Record<GroupId, string> = { daily: 'Đời thường', growth: 'Phát triển', battle: 'Chiến đấu', base: 'Căn cứ & tương tác', other: 'Khác' };
export function voiceUnitGroups(doc: VoiceDoc | null, unitKeys: string[], skinName: (id: string) => string = (id) => id) {
  if (!doc?.langs.length) return [];
  const present = new Set(unitKeys);
  const baseSkin = doc.langs[0].lines[0]?.skin;
  const by = new Map<GroupId, LoreItem[]>(GROUP_ORDER.map((g) => [g, []]));
  doc.langs.forEach((lang, i) => {
    for (const l of lang.lines) {
      const unitKey = `voice.${l.skin}.${l.type}${i ? `.${lang.lang}` : ''}`;
      if (!present.has(unitKey)) continue;
      const label = [`${LABEL_VI[l.type] ?? l.label} · ${l.label}`, l.skin !== baseSkin ? skinName(l.skin) : '', i ? lang.name : ''].filter(Boolean).join(' · ');
      const extra = l.unlock ? `Mở khoá: ${l.unlock}` : l.zone ? `Khung giờ ${l.zone}` : '';
      by.get(GROUP_OF[l.type] ?? 'other')!.push({ unitKey, label, ...(extra ? { extra } : {}), ...(l.key ? { audio: audioUrl(doc, l.key) } : {}) });
    }
  });
  return GROUP_ORDER.map((id) => ({ group: VOICE_GROUP[id], items: by.get(id)! })).filter((g) => g.items.length);
}
