// Turns a public `char` (v2 lore overlay shape, or the legacy CN shape when the overlay failed) into what the lore tab shows.
export type LoreUnit = { text: string; untranslated: boolean };
export type LoreFact = { label: string; value: LoreUnit; detail: LoreUnit | null };
export type LorePeople = { department: string; departmentDetail: LoreUnit | null; status: string; recordId: string };
export type LoreReport = { title: LoreUnit | null; content: LoreUnit | null; unlock: LoreUnit | null; unlockLevel: number | null; special: boolean };
export type LoreTimelineEntry = { label: LoreUnit | null; story: LoreUnit | null };
export type LoreView = {
  archive: { image: string; head: string } | null;
  relicName: LoreUnit | null;
  quote: LoreUnit | null;
  facts: LoreFact[];
  people: LorePeople | null;
  intro: LoreUnit | null;
  reports: LoreReport[];
  relicIntro: LoreUnit | null;
  timeline: LoreTimelineEntry[];
  hasUntranslated: boolean;
  empty: boolean;
};

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function pick(vi: unknown, cn: unknown): LoreUnit | null {
  if (str(vi)) return { text: str(vi), untranslated: false };
  if (str(cn)) return { text: str(cn), untranslated: true };
  return null;
}

// Relic-tag labels confirmed by the owner (2026-09-26): in-game S0132 tag1 工艺 / tag3 产地, A0061 tag2 出土地;
// tag4 其他 from the wiki (外销文物).
const TAG_LABELS: Record<string, string> = { tag1: 'Kỹ thuật', tag2: 'Nơi khai quật', tag3: 'Nơi sản xuất', tag4: 'Khác' };

// Ticket layout (owner 2026-09-27, demo "Phiếu Hồ Sơ Lưu Trữ"): Vietnamese values are 3-4x longer than the CN ones,
// so 3 fixed columns wrapped most of them. Each value is sized by its measured width: S fits one line in a third of
// the 6-column facts row, M in a half, L needs the whole row.
export type FactSize = 'S' | 'M' | 'L';
export function factSize(textWidth: number, rowWidth: number, padding: number): FactSize {
  const inner = (span: number) => (rowWidth / 6) * span - padding;
  return textWidth <= inner(2) ? 'S' : textWidth <= inner(3) ? 'M' : 'L';
}

// Column spans, packed in order (Loại, Niên đại, Nơi lưu giữ, tags): three short values share a row, two values
// that are not long share a row, anything else takes the whole row.
export function factSpans(sizes: FactSize[]): number[] {
  const spans: number[] = [];
  let i = 0;
  while (i < sizes.length) {
    if (sizes[i] === 'S' && sizes[i + 1] === 'S' && sizes[i + 2] === 'S') { spans.push(2, 2, 2); i += 3; }
    else if (i + 1 < sizes.length && sizes[i] !== 'L' && sizes[i + 1] !== 'L') { spans.push(3, 3); i += 2; }
    else { spans.push(6); i += 1; }
  }
  return spans;
}

const NBSP = '\u00A0';
// Lower-case compounds from the lore glossary; proper names (runs of capitalised syllables) are kept together by rule.
const COMPOUNDS = [
  'Bảo tàng', 'Quốc gia', 'Khu tự trị', 'Nghệ thuật', 'Hiện đại', 'Lịch sử', 'Khảo cổ', 'Di chỉ', 'Nghiên cứu',
  'Công viên', 'Lâu đài', 'Dãy núi', 'Khắp nơi', 'thế giới', 'Lưu giữ', 'hai nơi', 'Đang triển lãm', 'Nam Bắc triều',
  'Khắc đá', 'gạch ngói', 'vàng bạc', 'dệt thêu', 'sơn mài', 'thủy tinh', 'da thuộc', 'Trang phục', 'Văn hóa', 'dân gian',
  'Văn bản', 'lưu trữ', 'Cấu kiện', 'kiến trúc', 'Kiến trúc', 'Mô hình', 'điêu khắc', 'Điêu khắc', 'cổ đại', 'Sách cổ',
  'bản quý', 'Hội họa', 'Thư pháp', 'Nhạc cụ', 'Vũ khí', 'Châu báu', 'Giáp cốt', 'Phù bài', 'Thẻ tre', 'Ấn chương',
  'Đồng hồ', 'đến nay', 'Hầm giấu', 'Quần thể', 'mộ cổ',
].sort((a, b) => b.length - a.length);
const COMPOUND_PATTERNS = COMPOUNDS.map((phrase) => [new RegExp(`(?<=^|[\\s(])${phrase}(?=$|[\\s),])`, 'g'), phrase.replaceAll(' ', NBSP)] as const);
const CAPITALISED = /^\p{Lu}[\p{L}\p{M}]*$/u;

// Line breaks only between words: joins compounds, 2-5 capitalised syllables in a row, "thế kỷ 19", "18 TCN",
// and keeps the " - " of a period at the end of the line. The result is plain text with no-break spaces.
export function keepTogether(text: string): string {
  let out = text
    .replace(/ - /g, `${NBSP}- `)
    .replace(/([Tt]hế) kỷ (\d+)/g, `$1${NBSP}kỷ${NBSP}$2`)
    .replace(/([Nn]ăm) (\d+)/g, `$1${NBSP}$2`)
    .replace(/(\d+) (TCN|SCN)/g, `$1${NBSP}$2`);
  for (const [pattern, joined] of COMPOUND_PATTERNS) out = out.replace(pattern, joined);
  const words = out.split(' ');
  const result: string[] = [];
  for (let i = 0; i < words.length;) {
    let j = i;
    while (j < words.length && CAPITALISED.test(words[j])) j++;
    if (j - i >= 2 && j - i <= 5) { result.push(words.slice(i, j).join(NBSP)); i = j; }
    else { result.push(words[i]); i++; }
  }
  return result.join(' ');
}

const pair = (value: unknown) => pick(obj(value).vi, obj(value).cn);
const detailOf = (value: unknown) => pick(obj(value).detail_vi, obj(value).detail);

export function buildLoreView(char: unknown): LoreView {
  const c = obj(char);
  const profile = obj(c.profile);
  const relic = obj(profile.relic_info);
  const archive = obj(c.archive);

  const legacy = 'relic_name' in relic || 'dynasty' in relic;
  const factRows: [string, LoreUnit | null, LoreUnit | null][] = legacy
    ? [['Hiện vật', pick(null, relic.relic_name), null], ['Niên đại', pick(null, relic.dynasty), null], ['Nơi lưu giữ', pick(null, relic.museum), null]]
    : [['Loại', pair(relic.type), detailOf(relic.type)], ['Niên đại', pair(relic.era), detailOf(relic.era)], ['Nơi lưu giữ', pair(relic.museum), detailOf(relic.museum)]];
  for (const tag of list(relic.tags)) {
    const label = TAG_LABELS[str(tag.field)];
    if (label) factRows.push([label, pair(tag), detailOf(tag)]);
  }
  const facts = factRows.filter((f): f is [string, LoreUnit, LoreUnit | null] => f[1] !== null).map(([label, value, detail]) => ({ label, value, detail }));
  // fullname_vi is the workbook's translation of the full (relic) name — used as-is, even when it equals the name.
  const relicName = pick(c.fullname_vi, c.fullname_cn);
  const people = [profile.department, profile.entity_status, profile.record_id].some((v) => str(v))
    ? { department: str(profile.department), departmentDetail: pick(obj(profile.department_detail).vi, obj(profile.department_detail).cn), status: str(profile.entity_status), recordId: str(profile.record_id) }
    : null;

  const reports = list(profile.reports)
    .map((r) => ({
      title: pick(r.title_vi, r.title),
      content: pick(r.content_vi, r.content),
      unlock: pick(r.unlock_name_vi, r.unlock_name),
      unlockLevel: typeof r.unlock_level === 'number' ? r.unlock_level : null,
      special: r.kind !== undefined && r.kind !== 'basic',
    }))
    .filter((r) => r.title || r.content);

  const timeline = list(relic.timeline)
    .map((t) => ({ label: pick(t.label_vi, t.label), story: pick(t.story_vi, t.story) }))
    .filter((t) => t.label || t.story);

  const view = {
    archive: str(archive.image) && str(archive.head) ? { image: str(archive.image), head: str(archive.head) } : null,
    relicName,
    quote: pick(profile.quote_vi, profile.quote), // rendered on Tổng Quan (mountLoreQuote), not in the lore tab
    facts,
    people,
    intro: pick(profile.eval_intro_vi, profile.eval_intro),
    reports,
    relicIntro: pick(relic.intro_vi, relic.intro),
    timeline,
  };
  const shown = [relicName, view.intro, view.relicIntro, ...facts.map((f) => f.value),
    ...reports.flatMap((r) => [r.title, r.content, r.unlock]), ...timeline.flatMap((t) => [t.label, t.story])];
  const hasUntranslated = shown.some((u) => u?.untranslated);
  const empty = !view.archive && !facts.length && !people && !view.intro && !reports.length && !view.relicIntro && !timeline.length;
  return { ...view, hasUntranslated, empty };
}
