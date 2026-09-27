// Pure helpers for the admin Build module. The document shape and the rules are the server's
// (server/builds/build-validate.mjs); these keep the editor inside them while typing.
export type BuildDoc = {
  name: string; rating: string; summary: string;
  weapons: { weaponId: string; label: string }[];
  affixes: { noReroll: boolean; groups: { label: string; affixIds: string[] }[] };
  deepen: { styleId: string; points: number[] } | null;
  rotations: { label: string; skillIds: string[] }[];
  tips: string[];
  teams: { label: string; characterIds: string[]; note: string }[];
  teamOther: string;
};

export const MAX_WEAPONS = 4;
export const MAX_COLUMN = 7;
export const MAX_TOTAL = 11;

export function emptyBuild(recommendedStyleId: string | null): BuildDoc {
  return {
    name: '', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] },
    deepen: recommendedStyleId ? { styleId: recommendedStyleId, points: [0, 0, 0, 0] } : null,
    rotations: [], tips: [], teams: [], teamOther: '',
  };
}

export const totalPoints = (doc: BuildDoc) => (doc.deepen?.points ?? []).reduce((a, b) => a + b, 0);

// A value past 7, or one that would take the total past 11, is cut to what is allowed.
export function setPoint(doc: BuildDoc, column: number, value: number): BuildDoc {
  if (!doc.deepen) return doc;
  const points = [...doc.deepen.points];
  const others = totalPoints(doc) - points[column];
  points[column] = Math.max(0, Math.min(MAX_COLUMN, MAX_TOTAL - others, Math.round(Number(value) || 0)));
  return { ...doc, deepen: { ...doc.deepen, points } };
}

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
  weapons: 'Vũ khí', affixes: 'Dòng thuộc tính', deepen: 'Thâm tạo', rotations: 'Xoay vòng', tips: 'Mẹo', teams: 'Đội hình',
  name: 'Tên build', rating: 'Đánh giá', summary: 'Tóm tắt', teamOther: 'Đội hình khác',
};
const CODES: Record<string, string> = {
  WRONG_JOB: 'không cùng chức nghiệp với nhân vật', UNKNOWN_WEAPON: 'vũ khí không tồn tại', UNKNOWN_AFFIX: 'dòng thuộc tính không tồn tại',
  FOREIGN_STYLE: 'hướng thâm tạo không thuộc nhân vật', BAD_POINTS: 'mỗi cột 0–7 điểm', TOO_MANY_POINTS: 'tổng điểm vượt 11',
  TOO_MANY: 'tối đa 4 vũ khí', UNKNOWN_SKILL: 'kỹ năng không thuộc nhân vật', UNKNOWN_CHARACTER: 'nhân vật không tồn tại',
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
