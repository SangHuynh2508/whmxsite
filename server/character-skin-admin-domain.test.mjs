import assert from 'node:assert/strict';
import test from 'node:test';

import { planFieldChange } from './character-skin-admin-domain.mjs';

const active = (overrideValue) => ({ state: 'active', overrideValue });

test('null or empty input clears an active override back to the source', () => {
  assert.deepEqual(planFieldChange('Tên nguồn', active('Tên sửa'), null), { previous: 'Tên sửa', next: 'Tên nguồn', clear: true });
  assert.deepEqual(planFieldChange('Tên nguồn', active('Tên sửa'), '  '), { previous: 'Tên sửa', next: 'Tên nguồn', clear: true });
});

test('null input without an override is a no-op, not an empty override', () => {
  assert.equal(planFieldChange('Tên nguồn', undefined, null), null);
});

test('an empty override already stored is cleared by null', () => {
  assert.deepEqual(planFieldChange('Tên nguồn', active(null), null), { previous: null, next: 'Tên nguồn', clear: true });
});

test('source is compared after trimming', () => {
  assert.equal(planFieldChange(' Tên nguồn ', undefined, 'Tên nguồn'), null);
  assert.deepEqual(planFieldChange(' Tên nguồn ', active('Tên sửa'), 'Tên nguồn'), { previous: 'Tên sửa', next: 'Tên nguồn', clear: true });
});

test('a different value becomes an override', () => {
  assert.deepEqual(planFieldChange('Tên nguồn', undefined, ' Tên mới '), { previous: 'Tên nguồn', next: 'Tên mới', clear: false });
  assert.deepEqual(planFieldChange('Tên nguồn', { state: 'cleared', overrideValue: 'Tên nguồn' }, 'Tên mới'), { previous: 'Tên nguồn', next: 'Tên mới', clear: false });
});
