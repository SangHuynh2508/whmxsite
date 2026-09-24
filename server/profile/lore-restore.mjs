// server/profile/lore-restore.mjs
// Pure: which VI fields a snapshot would put back. Rows are matched by stable keys
// (character ID + unit key, term code), never by UUID, so a rebuilt DB still restores.
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f, row?.[f] ?? null]));
const TEXT_FIELDS = ['vi', 'viOrigin', 'state'];
const TERM_FIELDS = ['nameVi', 'detailVi', 'viOrigin', 'state'];

// VI saved against an older CN must not come back as publishable.
function restoredState(after, old, row, hasVi) {
  return hasVi && old.sourceHash !== row.sourceHash ? { ...after, state: 'source_changed' } : after;
}

export function planRestore(snapshot, current) {
  if (snapshot.version !== 2) throw new Error(`backup version ${snapshot.version} has no character IDs; take a new backup (publish) first`);
  const snapTexts = new Map(snapshot.profileTexts.map((r) => [`${r.characterId}|${r.unitKey}`, r]));
  const snapTerms = new Map(snapshot.loreTerms.map((r) => [r.code, r]));
  const seen = new Set();
  const texts = [];
  for (const row of current.profileTexts) {
    const key = `${row.characterId}|${row.unitKey}`;
    const old = snapTexts.get(key);
    if (!old) continue;
    seen.add(key);
    const before = pick(row, TEXT_FIELDS);
    const after = restoredState(pick(old, TEXT_FIELDS), old, row, old.vi !== null);
    if (JSON.stringify(before) !== JSON.stringify(after)) texts.push({ id: row.id, characterId: row.characterId, unitKey: row.unitKey, before, after });
  }
  const terms = [];
  for (const row of current.loreTerms) {
    const old = snapTerms.get(row.code);
    if (!old) continue;
    seen.add(row.code);
    const before = pick(row, TERM_FIELDS);
    const after = restoredState(pick(old, TERM_FIELDS), old, row, old.nameVi !== null || old.detailVi !== null);
    if (JSON.stringify(before) !== JSON.stringify(after)) terms.push({ code: row.code, before, after });
  }
  const unmatched = [...snapTexts.keys(), ...snapTerms.keys()].filter((key) => !seen.has(key));
  return { texts, terms, unmatched };
}
