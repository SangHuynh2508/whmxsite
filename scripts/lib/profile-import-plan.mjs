// scripts/lib/profile-import-plan.mjs
// Pure: what the importer must write. Never deletes; VI is never touched here.
export function planProfileImport({ normalized, current }) {
  const counts = { inserted: 0, updated: 0, unchanged: 0, conflicted: 0, absent: 0 };
  const plan = { profiles: [], textInserts: [], textUpdates: [], terms: [], audits: [], touchedProfiles: new Set(), touchedTerms: new Set(), cnChanged: false, counts };

  for (const profile of normalized.profiles) {
    const { units, ...row } = profile;
    const existing = current.profiles.get(profile.characterId);
    const action = !existing ? 'insert' : existing.sourceHash !== profile.sourceHash || !existing.sourcePresent ? 'update' : 'unchanged';
    plan.profiles.push({ characterId: profile.characterId, action, row });
    counts[action === 'insert' ? 'inserted' : action === 'update' ? 'updated' : 'unchanged'] += 1;
    if (action !== 'unchanged') plan.touchedProfiles.add(profile.characterId);

    const seen = new Set();
    for (const unit of units) {
      const key = `${profile.characterId}|${unit.unitKey}`;
      seen.add(key);
      const old = current.texts.get(key);
      if (!old) {
        plan.textInserts.push({ characterId: profile.characterId, ...unit });
        counts.inserted += 1;
        plan.touchedProfiles.add(profile.characterId);
        continue;
      }
      if (old.sourceHash === unit.sourceHash && old.sourcePresent) { counts.unchanged += 1; continue; }
      const patch = { sourceCn: unit.sourceCn, sourceRef: unit.sourceRef, sourceHash: unit.sourceHash, sourcePresent: true };
      if (old.sourceHash !== unit.sourceHash) {
        plan.cnChanged = true;
        if (old.vi !== null) { patch.state = 'source_changed'; counts.conflicted += 1; } else counts.updated += 1;
        plan.audits.push({ scope: 'profile', key: profile.characterId, fieldName: unit.unitKey, oldValue: { sourceCn: old.sourceCn }, newValue: { sourceCn: unit.sourceCn } });
      } else counts.updated += 1;
      plan.textUpdates.push({ id: old.id, characterId: profile.characterId, unitKey: unit.unitKey, patch });
      plan.touchedProfiles.add(profile.characterId);
    }
    for (const [key, old] of current.texts) {
      if (!key.startsWith(`${profile.characterId}|`) || seen.has(key) || !old.sourcePresent) continue;
      plan.textUpdates.push({ id: old.id, characterId: profile.characterId, unitKey: key.split('|')[1], patch: { sourcePresent: false } });
      counts.absent += 1;
      plan.touchedProfiles.add(profile.characterId);
    }
  }

  for (const term of normalized.terms) {
    const old = current.terms.get(term.code);
    if (!old) { plan.terms.push({ code: term.code, action: 'insert', row: term }); counts.inserted += 1; plan.touchedTerms.add(term.code); continue; }
    if (old.sourceHash === term.sourceHash && old.sourcePresent) { plan.terms.push({ code: term.code, action: 'unchanged' }); counts.unchanged += 1; continue; }
    const patch = { kind: term.kind, nameCn: term.nameCn, detailCn: term.detailCn, sourceHash: term.sourceHash, sourcePresent: true };
    if (old.sourceHash !== term.sourceHash) {
      plan.cnChanged = true;
      if (old.nameVi !== null || old.detailVi !== null) { patch.state = 'source_changed'; counts.conflicted += 1; } else counts.updated += 1;
      plan.audits.push({ scope: 'term', key: term.code, fieldName: 'name_detail', oldValue: { sourceHash: old.sourceHash }, newValue: { nameCn: term.nameCn, detailCn: term.detailCn } });
    } else counts.updated += 1;
    plan.terms.push({ code: term.code, action: 'update', patch });
    plan.touchedTerms.add(term.code);
  }
  return plan;
}

// Any change to what the published document is built from means the live lore is stale.
export const needsPublish = (plan) => plan.touchedProfiles.size > 0 || plan.touchedTerms.size > 0;
