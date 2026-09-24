// scripts/lib/profile-legacy.mjs
// Pure: legacy workbook PROFILE VI -> seeds for empty DB cells (spec §4 table).
const CODE_MAP = new Set(['staff_status', 'entity_status']);
const RAW_CODE = new Set(['relic_name', 'relic_dynasty', 'relic_museum']);

function unitKeyFor(row, profile) {
  if (row.category === 'card_intro') return 'card_intro';
  if (row.category === 'relic_intro') return 'relic_intro';
  const match = /_(\d+)$/.exec(row.profile_id);
  if (!match) return null;
  const report = profile.structure.reports.filter((r) => r.kind === 'basic')[Number(match[1]) - 1];
  if (!report) return null;
  return `report.${report.fileId}.${row.category === 'report_title' ? 'title' : 'content'}`;
}

export function matchLegacyCells(rows, profiles) {
  const byId = new Map(profiles.map((p) => [p.characterId, p]));
  const seeds = [];
  const ignored = [];
  for (const row of rows) {
    const vi = String(row.text_vi ?? '').trim();
    if (!vi) continue;
    if (CODE_MAP.has(row.category)) { ignored.push({ profileId: row.profile_id, reason: 'code_map_category' }); continue; }
    if (RAW_CODE.has(row.category)) { ignored.push({ profileId: row.profile_id, reason: 'raw_code_copy' }); continue; }
    const profile = byId.get(row.character_id);
    const unitKey = profile && unitKeyFor(row, profile);
    const unit = unitKey && profile.units.find((u) => u.unitKey === unitKey);
    if (!unit) { ignored.push({ profileId: row.profile_id, reason: 'no_matching_unit' }); continue; }
    seeds.push({ characterId: row.character_id, unitKey, vi, sourceChanged: String(row.text_cn ?? '').trim() !== unit.sourceCn });
  }
  return { seeds, ignored };
}
