// server/profile/lore-restore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRestore } from './lore-restore.mjs';

const text = (profileEntityId, characterId, unitKey, sourceHash, vi, viOrigin, state = 'ok', id) =>
  ({ id, profileEntityId, characterId, unitKey, sourceHash, vi, viOrigin, state });

test('matches by character ID, so a rebuilt DB with new UUIDs still restores (review #1)', () => {
  const snapshot = {
    version: 2,
    profileTexts: [text('old-uuid', 'A0001', 'card_intro', 'h1', 'Cũ', 'admin')],
    loreTerms: [{ code: 'K1001', sourceHash: 'k1', nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' }],
  };
  const current = {
    profileTexts: [text('new-uuid', 'A0001', 'card_intro', 'h1', null, null, 'ok', 't1')],
    loreTerms: [{ code: 'K1001', sourceHash: 'k1', nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }],
  };
  const plan = planRestore(snapshot, current);
  assert.deepEqual(plan.texts, [{ id: 't1', characterId: 'A0001', unitKey: 'card_intro', before: { vi: null, viOrigin: null, state: 'ok' }, after: { vi: 'Cũ', viOrigin: 'admin', state: 'ok' } }]);
  assert.deepEqual(plan.terms.map((t) => t.after), [{ nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' }]);
  assert.deepEqual(plan.unmatched, []);
});

test('restored VI over changed CN is flagged source_changed, never ok (review #2)', () => {
  const snapshot = {
    version: 2,
    profileTexts: [text('p', 'A0001', 'card_intro', 'OLD', 'Cũ', 'admin')],
    loreTerms: [{ code: 'K1001', sourceHash: 'OLD', nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' }],
  };
  const current = {
    profileTexts: [text('p', 'A0001', 'card_intro', 'NEW', 'Mới', 'admin', 'source_changed', 't1')],
    loreTerms: [{ code: 'K1001', sourceHash: 'NEW', nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }],
  };
  const plan = planRestore(snapshot, current);
  assert.equal(plan.texts[0].after.state, 'source_changed');
  assert.equal(plan.terms[0].after.state, 'source_changed');
});

test('snapshot rows with no current row are reported, not silently dropped', () => {
  const snapshot = { version: 2, profileTexts: [text('p', 'Z9999', 'card_intro', 'h', 'x', 'admin')], loreTerms: [] };
  const plan = planRestore(snapshot, { profileTexts: [], loreTerms: [] });
  assert.deepEqual(plan.unmatched, ['Z9999|card_intro']);
});

test('a backup without character IDs is refused', () => {
  assert.throws(() => planRestore({ version: 1, profileTexts: [], loreTerms: [] }, { profileTexts: [], loreTerms: [] }), /version/);
});
