// Turns a public `char` (v2 lore overlay shape, or the legacy CN shape when the overlay failed) into what the lore tab shows.
export type LoreUnit = { text: string; untranslated: boolean };
export type LoreFact = { label: string; value: LoreUnit; detail: LoreUnit | null };
export type LorePeople = { department: string; departmentDetail: LoreUnit | null; status: string; recordId: string };
export type LoreReport = { title: LoreUnit | null; content: LoreUnit | null; unlock: LoreUnit | null; unlockLevel: number | null; special: boolean };
export type LoreTimelineEntry = { label: LoreUnit | null; story: LoreUnit | null };
export type LoreView = {
  archive: { image: string; head: string } | null;
  relicName: LoreUnit | null;
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
  const facts = factRows.filter((f): f is [string, LoreUnit, LoreUnit | null] => f[1] !== null).map(([label, value, detail]) => ({ label, value, detail }));
  // fullname_vi falls back to the character name when the relic name has no translation — that is not a relic name.
  const relicName = pick(str(c.fullname_vi) === str(c.name_vi) ? null : c.fullname_vi, c.fullname_cn);
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
