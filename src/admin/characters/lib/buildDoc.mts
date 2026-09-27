// Pure helpers for the admin Build module. The document shape and the rules are the server's
// (server/builds/build-validate.mjs); these keep the editor inside them while typing.
export type Deepen = { label: string; styleId: string; points: number[] };
export type BuildDoc = {
  name: string; rating: string; summary: string;
  weapons: { weaponId: string; label: string }[];
  affixes: { noReroll: boolean; groups: { label: string; affixIds: string[] }[] };
  deepens: Deepen[]; // up to 3 深造 suggestions (owner 2026-09-27)
  rotations: { label: string; skillIds: string[] }[];
  tips: string[];
  teams: { label: string; characterIds: string[]; note: string }[];
  teamOther: string;
};

export const MAX_WEAPONS = 4;
export const MAX_COLUMN = 7;
export const MAX_TOTAL = 11;
export const MAX_DEEPENS = 3;

export function emptyBuild(recommendedStyleId: string | null): BuildDoc {
  return {
    name: '', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] },
    deepens: recommendedStyleId ? [{ label: '', styleId: recommendedStyleId, points: [0, 0, 0, 0] }] : [],
    rotations: [], tips: [], teams: [], teamOther: '',
  };
}

export const totalPoints = (deepen: Deepen) => deepen.points.reduce((a, b) => a + b, 0);

// A value past 7, or one that would take the suggestion's total past 11, is cut to what is allowed.
export function setPoint(doc: BuildDoc, index: number, column: number, value: number): BuildDoc {
  const deepen = doc.deepens[index];
  if (!deepen) return doc;
  const points = [...deepen.points];
  const others = totalPoints(deepen) - points[column];
  points[column] = Math.max(0, Math.min(MAX_COLUMN, MAX_TOTAL - others, Math.round(Number(value) || 0)));
  return { ...doc, deepens: doc.deepens.map((d, i) => (i === index ? { ...d, points } : d)) };
}

export const addDeepen = (doc: BuildDoc, styleId: string): BuildDoc =>
  (doc.deepens.length >= MAX_DEEPENS ? doc : { ...doc, deepens: [...doc.deepens, { label: '', styleId, points: [0, 0, 0, 0] }] });

export const addWeapon = (doc: BuildDoc, weaponId: string): BuildDoc =>
  (doc.weapons.length >= MAX_WEAPONS ? doc : { ...doc, weapons: [...doc.weapons, { weaponId, label: '' }] });

export function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

export const sameDoc = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const SECTIONS: Record<string, string> = {
  weapons: 'Vũ khí', affixes: 'Dòng thuộc tính', deepens: 'Thâm tạo', rotations: 'Xoay vòng', tips: 'Mẹo', teams: 'Đội hình',
  name: 'Tên build', rating: 'Đánh giá', summary: 'Tóm tắt', teamOther: 'Đội hình khác',
};
const CODES: Record<string, string> = {
  WRONG_JOB: 'không cùng chức nghiệp với nhân vật', UNKNOWN_WEAPON: 'vũ khí không tồn tại', UNKNOWN_AFFIX: 'dòng thuộc tính không tồn tại',
  FOREIGN_STYLE: 'hướng thâm tạo không thuộc nhân vật', BAD_POINTS: 'mỗi cột 0–7 điểm', TOO_MANY_POINTS: 'tổng điểm vượt 11',
  TOO_MANY: 'vượt số lượng cho phép (4 vũ khí, 3 thâm tạo)', UNKNOWN_SKILL: 'kỹ năng không thuộc nhân vật', UNKNOWN_CHARACTER: 'nhân vật không tồn tại',
  TOO_LONG: 'quá dài', NOT_TEXT: 'phải là chữ', BAD_SHAPE: 'sai định dạng', UNKNOWN_FIELD: 'trường lạ',
};

// Server 422 details ({ path: 'weapons.0.weaponId', code }) → "Vũ khí 1: …".
export function buildErrors(details: { path: string; code: string }[]): string[] {
  return details.map(({ path, code }) => {
    const [section, index] = path.split('.');
    if (!SECTIONS[section] || !CODES[code]) return `${path}: ${code}`;
    const where = /^\d+$/.test(index ?? '') ? `${SECTIONS[section]} ${Number(index) + 1}` : SECTIONS[section];
    return `${where}: ${CODES[code]}`;
  });
}
