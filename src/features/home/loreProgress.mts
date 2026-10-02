// "Bản dịch Hồ Sơ" on Home (owner 2026-10-02): how far the published lore translation is, and who was translated last.
// Main texts only — report titles and timeline labels are short labels. Shown while anything is left to translate.
type Obj = Record<string, any>;
export type LoreProgress = { done: number; total: number; unitsDone: number; unitsTotal: number; recent: string[]; visible: boolean };

function mainTexts(p: Obj): [unknown, unknown][] {
  const relic = p.relic_info ?? {};
  return ([[p.quote, p.quote_vi], [p.eval_intro, p.eval_intro_vi], [relic.intro, relic.intro_vi]] as [unknown, unknown][])
    .concat((p.reports ?? []).map((r: Obj) => [r.content, r.content_vi]))
    .concat((relic.timeline ?? []).map((t: Obj) => [t.story, t.story_vi]))
    .filter(([cn]) => typeof cn === 'string' && cn.trim());
}

export function loreProgress(characters: Record<string, { id: string; profile?: Obj }>, limit = 6): LoreProgress {
  let done = 0, total = 0, unitsDone = 0, unitsTotal = 0;
  const translated: { id: string; at: string }[] = [];
  for (const c of Object.values(characters)) {
    const p = c.profile;
    if (!p || !('eval_intro_vi' in p)) continue; // the lore overlay did not load: legacy CN profile
    const texts = mainTexts(p);
    const n = texts.filter(([, vi]) => typeof vi === 'string' && vi.trim()).length;
    total += 1; unitsTotal += texts.length; unitsDone += n;
    if (n === texts.length) done += 1;
    if (n && p.vi_updated_at) translated.push({ id: c.id, at: p.vi_updated_at });
  }
  translated.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return { done, total, unitsDone, unitsTotal, recent: translated.slice(0, limit).map((t) => t.id), visible: unitsDone < unitsTotal };
}
