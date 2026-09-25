import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesFor, fieldValue, isDirty } from './fields.mts';

const record = { nameVi: { value: 'Lộc', source: 'Lộc', override: null, state: 'none' }, tagsVi: { value: 'a', source: 'b', override: 'a', state: 'active' } };

test('changesFor sends only changed keys and turns empty into null (revert to source)', () => {
  assert.deepEqual(changesFor({ nameVi: 'Lộc', tagsVi: '  ' }, record, ['nameVi', 'tagsVi']), { tagsVi: null });
  assert.deepEqual(changesFor({ nameVi: 'Lộc Giác', tagsVi: 'a' }, record, ['nameVi', 'tagsVi']), { nameVi: 'Lộc Giác' });
  assert.equal(isDirty({ nameVi: 'Lộc', tagsVi: 'a' }, record, ['nameVi', 'tagsVi']), false);
  assert.equal(fieldValue(record, 'missing'), '');
});
