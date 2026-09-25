// server/profile/lore-edit.mjs
// Pure: what a lore or lore-term save writes, and the shapes the lore admin API returns.
// The DB layer (lore-admin.mjs) applies these inside one transaction.

// Inner line breaks are part of the text (reports are multi-paragraph); only the ends are trimmed.
export function cleanVi(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n?/g, '\n').trim();
  return text || null;
}

const official = (row) => row.viOrigin === 'admin' && row.state === 'ok';

export function planLoreTextEdit(units, texts) {
  const byKey = new Map(units.map((u) => [u.unitKey, u]));
  const unknown = Object.keys(texts).filter((k) => !byKey.has(k));
  if (unknown.length) return { error: 'UNKNOWN_UNIT', unknown };
  const writes = [];
  for (const [unitKey, raw] of Object.entries(texts)) {
    const row = byKey.get(unitKey);
    const vi = cleanVi(raw);
    // The same text is still a write when it makes a legacy or CN-changed unit official.
    if (vi === row.vi && (vi === null || official(row))) continue;
    writes.push({
      id: row.id, unitKey,
      before: { vi: row.vi, viOrigin: row.viOrigin, state: row.state },
      after: { vi, viOrigin: vi === null ? null : 'admin', state: 'ok' },
    });
  }
  return { writes };
}

export function planTermEdit(term, input) {
  const nameVi = cleanVi(input.nameVi);
  const detailVi = cleanVi(input.detailVi);
  const empty = nameVi === null && detailVi === null;
  if (nameVi === term.nameVi && detailVi === term.detailVi && (empty || official(term))) return { write: null };
  return {
    write: {
      before: { nameVi: term.nameVi, detailVi: term.detailVi, viOrigin: term.viOrigin, state: term.state },
      after: { nameVi, detailVi, viOrigin: empty ? null : 'admin', state: 'ok' },
    },
  };
}

export function loreProgress(rows) {
  const out = {};
  for (const r of rows) {
    const p = (out[r.characterId] ??= { total: 0, done: 0, legacy: 0, changed: 0 });
    p.total += 1;
    if (r.state === 'source_changed') p.changed += 1;
    else if (r.viOrigin === 'admin' && r.vi) p.done += 1;
    else if (r.viOrigin === 'legacy_workbook') p.legacy += 1;
  }
  return out;
}

export function termUsage(profiles) {
  const usage = new Map();
  const add = (code, id) => { if (code) usage.set(code, (usage.get(code) ?? new Set()).add(id)); };
  for (const p of profiles) {
    add(p.organisationCode ? `ORG_${p.organisationCode}` : null, p.characterId);
    for (const code of [p.relicTypeCode, p.eraCode, p.museumCode, p.eraRangeCode]) add(code, p.characterId);
    for (const r of p.structure?.reports ?? []) if (r.kind === 'basic' && r.unlock?.type === 2) add(`AFFINITY_${r.unlock.elementId}`, p.characterId);
  }
  return Object.fromEntries([...usage].map(([code, ids]) => [code, [...ids].sort()]));
}

export function previousCnByUnit(history) {
  const out = {};
  const imports = history.filter((h) => h.eventType === 'source_import' && h.oldValue?.sourceCn != null)
    .sort((a, b) => String(b.editedAt).localeCompare(String(a.editedAt)));
  for (const h of imports) out[h.fieldName] ??= h.oldValue.sourceCn;
  return out;
}

export function archiveImagesFor(manifest, characterId) {
  const base = String(manifest.public_base_url || '').replace(/\/$/, '');
  return Object.values(manifest.assets || {})
    .filter((a) => a.category === 'archive' && a.character_id === characterId)
    .sort((a, b) => Number(a.key.includes('/head_')) - Number(b.key.includes('/head_')) || a.key.localeCompare(b.key))
    .map((a) => ({ url: `${base}/${a.key}`, width: a.width, height: a.height }));
}

const termView = (terms, code) => {
  const t = code ? terms.get(code) : null;
  return t ? { code: t.code, kind: t.kind, nameCn: t.nameCn, nameVi: t.nameVi, official: official(t) } : null;
};

export function shapeLoreRecord({ characterId, revision, profile, texts, terms, history, archiveImages }) {
  const previous = previousCnByUnit(history);
  const basicUnlocks = profile.structure.reports.filter((r) => r.kind === 'basic' && r.unlock?.type === 2);
  return {
    characterId,
    revision,
    structure: profile.structure,
    units: texts.filter((t) => t.sourcePresent).map((t) => ({
      unitKey: t.unitKey, sourceCn: t.sourceCn, vi: t.vi, viOrigin: t.viOrigin, state: t.state,
      previousCn: t.state === 'source_changed' ? previous[t.unitKey] ?? null : null,
    })),
    organisation: termView(terms, profile.organisationCode ? `ORG_${profile.organisationCode}` : null),
    relic: profile.legacyRelicFields?.hasEntry ? {
      type: termView(terms, profile.relicTypeCode), era: termView(terms, profile.eraCode),
      museum: termView(terms, profile.museumCode), eraRange: termView(terms, profile.eraRangeCode),
    } : null,
    affinity: Object.fromEntries(basicUnlocks.map((r) => [r.unlock.elementId, termView(terms, `AFFINITY_${r.unlock.elementId}`)])),
    archiveImages,
    history,
  };
}
