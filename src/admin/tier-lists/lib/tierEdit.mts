// Pure edits of a tier list document for the Admin editor (shape: server/tier-lists/tier-list-validate.mjs).
// Every function returns a new document; refusing an edit returns the same object.
import type { Entry, Team, Tier, TierListDoc } from '../../../features/tier-list/tierView.mts';

export type Place = { area: 'tier' | 'team'; list: number; index: number };
const MAX_MEMBERS = 6;
const clone = (doc: TierListDoc): TierListDoc => structuredClone(doc);
const at = (doc: TierListDoc, area: Place['area'], list: number): Entry[] => (area === 'tier' ? doc.solo.tiers[list].entries : doc.teams.groups[list].members);

export const entriesOf = (doc: TierListDoc, area: Place['area'], list: number) => at(doc, area, list);
export const canInsert = (doc: TierListDoc, area: Place['area'], list: number) => area === 'tier' || at(doc, area, list).length < MAX_MEMBERS;

export function insertEntry(doc: TierListDoc, to: Place, entry: Entry) {
  if (!canInsert(doc, to.area, to.list)) return doc;
  const next = clone(doc);
  at(next, to.area, to.list).splice(to.index, 0, { ...entry });
  return next;
}

export function moveEntry(doc: TierListDoc, from: Place, to: Place) {
  const same = from.area === to.area && from.list === to.list;
  if (!same && !canInsert(doc, to.area, to.list)) return doc;
  const next = clone(doc);
  const [entry] = at(next, from.area, from.list).splice(from.index, 1);
  const index = same && to.index > from.index ? to.index - 1 : to.index;
  at(next, to.area, to.list).splice(index, 0, entry);
  return next;
}

export function removeEntry(doc: TierListDoc, place: Place) {
  const next = clone(doc);
  at(next, place.area, place.list).splice(place.index, 1);
  return next;
}

export function updateEntry(doc: TierListDoc, place: Place, patch: { zhizhi?: number | null; hc?: boolean }) {
  const next = clone(doc);
  const e = at(next, place.area, place.list)[place.index];
  if (patch.zhizhi !== undefined) { if (patch.zhizhi) e.zhizhi = patch.zhizhi; else delete e.zhizhi; }
  if (patch.hc !== undefined) { if (patch.hc) e.hc = true; else delete e.hc; }
  return next;
}

export const duplicateEntry = (doc: TierListDoc, place: Place) =>
  insertEntry(doc, { ...place, index: place.index + 1 }, at(doc, place.area, place.list)[place.index]);

const fixFirst = (doc: TierListDoc) => { if (doc.solo.tiers[0]) doc.solo.tiers[0].joinAbove = false; return doc; };
const swap = <T,>(items: T[], i: number, delta: number) => { const j = i + delta; if (j < 0 || j >= items.length) return false; [items[i], items[j]] = [items[j], items[i]]; return true; };

export function addTier(doc: TierListDoc) { const next = clone(doc); next.solo.tiers.push({ label: '?', description: '', joinAbove: false, entries: [] }); return next; }
export function removeTier(doc: TierListDoc, i: number) { if (doc.solo.tiers.length <= 1) return doc; const next = clone(doc); next.solo.tiers.splice(i, 1); return fixFirst(next); }
export function moveTier(doc: TierListDoc, i: number, delta: number) { const next = clone(doc); return swap(next.solo.tiers, i, delta) ? fixFirst(next) : doc; }
export function updateTier(doc: TierListDoc, i: number, patch: Partial<Omit<Tier, 'entries'>>) { const next = clone(doc); Object.assign(next.solo.tiers[i], patch); return fixFirst(next); }

export function addTeam(doc: TierListDoc) { const next = clone(doc); next.teams.groups.push({ name: '', note: '', members: [] }); return next; }
export function removeTeam(doc: TierListDoc, i: number) { const next = clone(doc); next.teams.groups.splice(i, 1); return next; }
export function moveTeam(doc: TierListDoc, i: number, delta: number) { const next = clone(doc); return swap(next.teams.groups, i, delta) ? next : doc; }
export function updateTeam(doc: TierListDoc, i: number, patch: Partial<Omit<Team, 'members'>>) { const next = clone(doc); Object.assign(next.teams.groups[i], patch); return next; }

export const sameDoc = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const FIELDS: Record<string, string> = { title: 'Tiêu đề', author: 'Tác giả', sourceUrl: 'Link nguồn', info: 'Thông tin', 'solo.note': 'Ghi chú Nhân vật', 'teams.note': 'Ghi chú Đội hình', 'solo.tiers': 'Các tier', 'teams.groups': 'Các đội' };
const CODES: Record<string, string> = {
  REQUIRED: 'bắt buộc', TOO_LONG: 'quá dài', TOO_MANY: 'quá nhiều', TOO_FEW: 'cần ít nhất một', BAD_URL: 'phải là link http(s)',
  UNKNOWN_CHARACTER: 'Khí Giả không còn trong dữ liệu', NO_HUANZHANG: 'nhân vật này không có Hoán Chương', BAD_ZHIZHI: 'Trí Tri phải từ 1 đến 6',
  DUPLICATE_ENTRY: 'trùng nhân vật và nhãn với ô khác', DUPLICATE_MEMBER: 'trùng thành viên', BAD_SHAPE: 'sai định dạng', NOT_TEXT: 'phải là chữ',
};
const FIELD_PART: Record<string, string> = { label: 'nhãn', description: 'mô tả', name: 'tên', note: 'ghi chú', zhizhi: 'Trí Tri', hc: 'HC', characterId: 'Khí Giả', members: 'thành viên', entries: 'các ô' };

export function tierListErrors(details: { path: string; code: string }[]): string[] {
  return details.map(({ path, code }) => {
    if (!CODES[code]) return `${path}: ${code}`;
    if (FIELDS[path]) return `${FIELDS[path]}: ${CODES[code]}`;
    const m = path.match(/^(solo\.tiers|teams\.groups)\.(\d+)(?:\.(entries|members)\.(\d+))?(?:\.(\w+))?$/);
    if (!m) return `${path}: ${CODES[code]}`;
    const where = `${m[1] === 'solo.tiers' ? 'Tier' : 'Đội'} ${Number(m[2]) + 1}${m[4] !== undefined ? `, ô ${Number(m[4]) + 1}` : ''}`;
    const part = m[5] && m[4] === undefined ? ` (${FIELD_PART[m[5]] ?? m[5]})` : m[3] && m[4] === undefined ? ` (${FIELD_PART[m[3]]})` : '';
    return `${where}${part}: ${CODES[code]}`;
  });
}
