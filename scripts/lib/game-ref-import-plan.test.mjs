import assert from 'node:assert/strict';
import test from 'node:test';

import { planGameRefImport } from './game-ref-import-plan.mjs';

const ref = (code, sourceHash, kind = 'weapon') => ({ kind, code, data: { job: 1 }, sourceHash });
const text = (code, nameCn, kind = 'weapon') => ({ kind, code, nameCn, detailCn: '', sourceHash: `h:${nameCn}` });
const empty = () => ({ refs: new Map(), texts: new Map() });
const currentRef = (sourceHash, sourcePresent = true) => ({ id: 'r1', sourceHash, sourcePresent });
const currentText = (kind, nameCn, nameVi = null) => ({ entityId: 'e1', kind, sourceHash: `h:${nameCn}`, nameVi, detailVi: null, state: 'ok', sourcePresent: true });

test('first import inserts every ref and term', () => {
  const plan = planGameRefImport({ normalized: { refs: [ref('30111', 'A')], texts: [text('30111', '路边物件盾')] }, current: empty() });
  assert.deepEqual(plan.refs.map((r) => [r.key, r.action]), [['weapon|30111', 'insert']]);
  assert.deepEqual(plan.terms.map((t) => [t.code, t.action]), [['weapon|30111', 'insert']]);
  assert.equal(plan.counts.inserted, 2);
  assert.equal(plan.changed, true);
});

test('identical input changes nothing', () => {
  const current = empty();
  current.refs.set('weapon|30111', currentRef('A'));
  current.texts.set('weapon|30111', currentText('weapon', '路边物件盾'));
  const plan = planGameRefImport({ normalized: { refs: [ref('30111', 'A')], texts: [text('30111', '路边物件盾')] }, current });
  assert.deepEqual(plan.refs.map((r) => r.action), ['unchanged']);
  assert.deepEqual(plan.terms.map((t) => t.action), ['unchanged']);
  assert.equal(plan.changed, false);
});

test('changed data updates the ref; a ref gone from MasterData is marked absent once, never deleted', () => {
  const current = empty();
  current.refs.set('weapon|30111', currentRef('A'));
  current.refs.set('weapon|99999', currentRef('Z'));
  current.refs.set('weapon|88888', currentRef('Y', false));
  const plan = planGameRefImport({ normalized: { refs: [ref('30111', 'B')], texts: [] }, current });
  assert.deepEqual(plan.refs.map((r) => [r.key, r.action]), [['weapon|30111', 'update'], ['weapon|99999', 'absent']]);
  assert.deepEqual(plan.refs[0].patch, { data: { job: 1 }, sourceHash: 'B', sourcePresent: true });
  assert.deepEqual(plan.refs[1].patch, { sourcePresent: false });
});

test('a CN change under a VI keeps the VI and flags source_changed (never writes VI)', () => {
  const current = empty();
  current.texts.set('weapon|30111', currentText('weapon', '旧名', 'Tên cũ'));
  const plan = planGameRefImport({ normalized: { refs: [], texts: [text('30111', '新名')] }, current });
  assert.equal(plan.terms[0].action, 'update');
  assert.deepEqual(plan.terms[0].patch, { kind: 'weapon', nameCn: '新名', detailCn: '', sourceHash: 'h:新名', sourcePresent: true, state: 'source_changed' });
  assert.equal(plan.counts.conflicted, 1);
});

test('a text gone from MasterData is marked absent once, never deleted', () => {
  const current = empty();
  current.texts.set('weapon|99999', currentText('weapon', '旧'));
  const plan = planGameRefImport({ normalized: { refs: [], texts: [] }, current });
  assert.deepEqual(plan.terms, [{ code: 'weapon|99999', action: 'absent', patch: { sourcePresent: false } }]);
  assert.equal(plan.changed, true);
});
