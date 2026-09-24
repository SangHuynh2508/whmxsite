// server/profile/lore-restore.mjs
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f, row?.[f] ?? null]));
const TEXT_FIELDS = ['vi', 'viOrigin', 'state'];
const TERM_FIELDS = ['nameVi', 'detailVi', 'viOrigin', 'state'];

export function planRestore(snapshot, current) {
  const snapTexts = new Map(snapshot.profileTexts.map((r) => [`${r.profileEntityId}|${r.unitKey}`, r]));
  const snapTerms = new Map(snapshot.loreTerms.map((r) => [r.code, r]));
  const texts = [];
  for (const row of current.profileTexts) {
    const old = snapTexts.get(`${row.profileEntityId}|${row.unitKey}`);
    if (!old) continue;
    const before = pick(row, TEXT_FIELDS);
    const after = pick(old, TEXT_FIELDS);
    if (JSON.stringify(before) !== JSON.stringify(after)) texts.push({ id: row.id, unitKey: row.unitKey, before, after });
  }
  const terms = [];
  for (const row of current.loreTerms) {
    const old = snapTerms.get(row.code);
    if (!old) continue;
    const before = pick(row, TERM_FIELDS);
    const after = pick(old, TERM_FIELDS);
    if (JSON.stringify(before) !== JSON.stringify(after)) terms.push({ code: row.code, before, after });
  }
  return { texts, terms };
}
