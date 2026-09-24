// scripts/lib/profile-import-plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProfileImport } from './profile-import-plan.mjs';

const profile = (units) => ({ characterId: 'V0053', recordId: 'r', sourceHash: 'P1', structure: { reports: [], timeline: [] }, units });
const u = (unitKey, sourceCn) => ({ unitKey, sourceCn, sourceRef: `ref:${unitKey}`, sourceHash: `h:${sourceCn}` });
const term = { code: 'K1001', kind: 'relic_type', nameCn: '玉器', detailCn: '', sourceHash: 'T1' };
const empty = () => ({ profiles: new Map(), texts: new Map(), terms: new Map() });

test('first import inserts everything', () => {
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A')])], terms: [term] }, current: empty() });
  assert.equal(plan.profiles[0].action, 'insert');
  assert.equal(plan.textInserts.length, 1);
  assert.equal(plan.terms[0].action, 'insert');
  assert.equal(plan.cnChanged, false);
});

test('re-running identical inputs changes nothing', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|card_intro', { id: 't1', sourceCn: 'A', sourceHash: 'h:A', vi: null, state: 'ok', sourcePresent: true });
  current.terms.set('K1001', { entityId: 'e2', sourceHash: 'T1', nameVi: null, detailVi: null, state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A')])], terms: [term] }, current });
  assert.equal(plan.textInserts.length + plan.textUpdates.length + plan.audits.length, 0);
  assert.equal(plan.profiles[0].action, 'unchanged');
  assert.equal(plan.counts.unchanged, 3);
});

test('CN change under VI keeps VI, flags source_changed and audits', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|card_intro', { id: 't1', sourceCn: 'A', sourceHash: 'h:A', vi: 'Việt', state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'B')])], terms: [] }, current });
  assert.deepEqual(plan.textUpdates[0].patch, { sourceCn: 'B', sourceRef: 'ref:card_intro', sourceHash: 'h:B', sourcePresent: true, state: 'source_changed' });
  assert.equal(plan.audits[0].fieldName, 'card_intro');
  assert.equal(plan.counts.conflicted, 1);
  assert.equal(plan.cnChanged, true);
  assert.ok(plan.touchedProfiles.has('V0053'));
});

test('a unit missing from raw is marked absent, never deleted', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|timeline.A.story', { id: 't9', sourceCn: 'X', sourceHash: 'h:X', vi: 'Y', state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([])], terms: [] }, current });
  assert.deepEqual(plan.textUpdates, [{ id: 't9', characterId: 'V0053', unitKey: 'timeline.A.story', patch: { sourcePresent: false } }]);
  assert.equal(plan.counts.absent, 1);
});

test('any write needs a publish, including a new unit on an existing profile (review #4)', async () => {
  const { needsPublish } = await import('./profile-import-plan.mjs');
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|card_intro', { id: 't1', sourceCn: 'A', sourceHash: 'h:A', vi: null, state: 'ok', sourcePresent: true });
  const withNewReport = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A'), u('report.X.title', 'R')])], terms: [] }, current });
  assert.equal(withNewReport.cnChanged, false);
  assert.equal(needsPublish(withNewReport), true);
  const identical = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A')])], terms: [] }, current });
  assert.equal(needsPublish(identical), false);
});

test('profiles and terms gone from raw are marked absent once, never deleted (review #13)', () => {
  const current = empty();
  current.profiles.set('Z9999', { entityId: 'z', sourceHash: 'P9', sourcePresent: true });
  current.profiles.set('Y0001', { entityId: 'y', sourceHash: 'P8', sourcePresent: false });
  current.terms.set('K9999', { entityId: 'k', sourceHash: 'T9', nameVi: null, detailVi: null, state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [], terms: [] }, current });
  assert.deepEqual(plan.profiles, [{ characterId: 'Z9999', action: 'absent' }]);
  assert.deepEqual(plan.terms, [{ code: 'K9999', action: 'absent', patch: { sourcePresent: false } }]);
  assert.equal(plan.counts.absent, 2);
  assert.ok(plan.touchedProfiles.has('Z9999') && plan.touchedTerms.has('K9999'));
});
