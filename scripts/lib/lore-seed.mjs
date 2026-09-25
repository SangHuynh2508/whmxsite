// scripts/lib/lore-seed.mjs
// One-time seeds approved in spec §4 (2026-09-25). Pure: the script prints the plan and applies it
// through the normal save path (history rows, revision, last_edit_at).
export const REPORT_TITLE_VI = Object.freeze({
  观察报告1: 'Báo cáo quan sát 1', 观察报告2: 'Báo cáo quan sát 2', 观察报告3: 'Báo cáo quan sát 3', 观察报告4: 'Báo cáo quan sát 4',
  加密报告A: 'Báo cáo mật A',
});

export function planTitleSeed(rows) {
  const plan = { writes: [], replacedLegacy: [], keptAdmin: [], unknownCn: [] };
  for (const r of rows) {
    if (!/^report\..+\.title$/.test(r.unitKey)) continue;
    const vi = REPORT_TITLE_VI[r.sourceCn.trim()];
    if (!vi) { plan.unknownCn.push(r); continue; }
    if (r.viOrigin === 'admin' && r.state === 'ok') { if (r.vi !== vi) plan.keptAdmin.push(r); continue; }
    if (r.viOrigin === 'legacy_workbook') plan.replacedLegacy.push(r);
    plan.writes.push({ characterId: r.characterId, unitKey: r.unitKey, vi });
  }
  return plan;
}

export function planOrgSeed(terms, names) {
  const plan = { writes: [], alreadyOfficial: [], unmapped: [] };
  for (const t of terms) {
    if (!t.code.startsWith('ORG_')) continue;
    if (t.viOrigin === 'admin' && t.state === 'ok') { plan.alreadyOfficial.push(t.code); continue; }
    const nameVi = names[t.nameCn];
    if (nameVi) plan.writes.push({ code: t.code, nameVi }); else plan.unmapped.push(t.code);
  }
  return plan;
}
