// Turns a public `char` (v2 lore overlay shape, or the legacy CN shape when the overlay failed) into what the lore tab shows.
export type LoreUnit = { text: string; untranslated: boolean };
export type LoreFact = { label: string; value: LoreUnit };
export type LoreReport = { title: LoreUnit | null; content: LoreUnit | null; unlock: LoreUnit | null; unlockLevel: number | null; special: boolean };
export type LoreTimelineEntry = { label: LoreUnit | null; story: LoreUnit | null };
export type LoreView = {
  archive: { image: string; head: string } | null;
  facts: LoreFact[];
  intro: LoreUnit | null;
  reports: LoreReport[];
  relicIntro: LoreUnit | null;
  timeline: LoreTimelineEntry[];
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

export function buildLoreView(char: unknown): LoreView {
  const c = obj(char);
  const profile = obj(c.profile);
  const relic = obj(profile.relic_info);
  const archive = obj(c.archive);

  const legacy = 'relic_name' in relic || 'dynasty' in relic;
  const factPairs: [string, LoreUnit | null][] = legacy
    ? [['Hiện vật', pick(null, relic.relic_name)], ['Niên đại', pick(null, relic.dynasty)], ['Nơi lưu giữ', pick(null, relic.museum)]]
    : [['Loại', pair(relic.type)], ['Niên đại', pair(relic.era)], ['Nơi lưu giữ', pair(relic.museum)]];
  const facts = factPairs.filter((f): f is [string, LoreUnit] => f[1] !== null).map(([label, value]) => ({ label, value }));

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
    facts,
    intro: pick(profile.eval_intro_vi, profile.eval_intro),
    reports,
    relicIntro: pick(relic.intro_vi, relic.intro),
    timeline,
  };
  const empty = !view.archive && !facts.length && !view.intro && !reports.length && !view.relicIntro && !timeline.length;
  return { ...view, empty };
}
