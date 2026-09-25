import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mustAskBeforeLeaving } from './leaveGuard.mts';

test('asks only when leaving a Khí Giả page with unsaved edits', () => {
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin/characters/A0001/skins', true), true);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin', true), true);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/characters', true), true);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin', false), false);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin/characters/A0001', true), false);
  assert.equal(mustAskBeforeLeaving('#/admin', '#/admin/accounts', true), false);
});
