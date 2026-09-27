// scripts/lib/game-ref-import-plan.mjs
// Pure: what the game-reference importer must write (game_references rows + its lore_terms kinds).
// Never deletes; VI is never touched (planTerms).
import { GAME_REF_TERM_KINDS } from './game-ref-source.mjs';
import { planTerms } from './profile-import-plan.mjs';

// current.refs: Map "kind|code" → { id, sourceHash, sourcePresent }; current.terms: Map code → lore_terms row (all kinds).
export function planGameRefImport({ normalized, current }) {
  const counts = { inserted: 0, updated: 0, unchanged: 0, conflicted: 0, absent: 0 };
  const plan = { refs: [], terms: [], audits: [], touchedTerms: new Set(), cnChanged: false, counts };

  const keys = new Set();
  for (const ref of normalized.refs) {
    const key = `${ref.kind}|${ref.code}`;
    keys.add(key);
    const old = current.refs.get(key);
    if (!old) { plan.refs.push({ key, action: 'insert', row: ref }); counts.inserted += 1; continue; }
    if (old.sourceHash === ref.sourceHash && old.sourcePresent) { plan.refs.push({ key, action: 'unchanged' }); counts.unchanged += 1; continue; }
    plan.refs.push({ key, action: 'update', patch: { data: ref.data, sourceHash: ref.sourceHash, sourcePresent: true } });
    counts.updated += 1;
  }
  for (const [key, old] of current.refs) {
    if (keys.has(key) || !old.sourcePresent) continue;
    plan.refs.push({ key, action: 'absent', patch: { sourcePresent: false } });
    counts.absent += 1;
  }

  planTerms(plan, normalized.terms, current.terms, (kind) => GAME_REF_TERM_KINDS.includes(kind));
  plan.changed = plan.refs.some((r) => r.action !== 'unchanged') || plan.touchedTerms.size > 0;
  return plan;
}
