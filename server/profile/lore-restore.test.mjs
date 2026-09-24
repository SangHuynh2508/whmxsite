// server/profile/lore-restore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRestore } from './lore-restore.mjs';

test('lists only VI fields that differ; never CN', () => {
  const snapshot = {
    profileTexts: [
      { profileEntityId: 'p1', unitKey: 'card_intro', sourceCn: 'OLD CN', vi: 'Cũ', viOrigin: 'admin', state: 'ok' },
      { profileEntityId: 'p1', unitKey: 'relic_intro', sourceCn: 'x', vi: null, viOrigin: null, state: 'ok' },
    ],
    loreTerms: [{ code: 'K1001', nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' }],
  };
  const current = {
    profileTexts: [
      { id: 't1', profileEntityId: 'p1', unitKey: 'card_intro', sourceCn: 'NEW CN', vi: 'Mới', viOrigin: 'admin', state: 'ok' },
      { id: 't2', profileEntityId: 'p1', unitKey: 'relic_intro', sourceCn: 'x', vi: null, viOrigin: null, state: 'ok' },
    ],
    loreTerms: [{ code: 'K1001', nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }],
  };
  const plan = planRestore(snapshot, current);
  assert.deepEqual(plan.texts, [{ id: 't1', unitKey: 'card_intro', before: { vi: 'Mới', viOrigin: 'admin', state: 'ok' }, after: { vi: 'Cũ', viOrigin: 'admin', state: 'ok' } }]);
  assert.deepEqual(plan.terms, [{ code: 'K1001', before: { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }, after: { nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' } }]);
});
