import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesFor, fieldValue } from './fields.mts';

const record = {
  nameVi: { value: 'Lộc', source: 'Lộc', override: null, state: 'none' },
  tagsVi: { value: 'a', source: 'b', override: 'a', state: 'active' },
  nicknameVi: { value: 'x', source: null, override: 'x', state: 'active' },
};
const keys = ['nameVi', 'tagsVi', 'nicknameVi'];

// The server clears an override only when it receives the source value itself; null is stored as an
// override "empty" (server/character-skin-admin-domain.mjs updateEntity). So "empty = back to source"
// must send the source value.
test('an emptied field sends its source value, which the server treats as "clear the override"', () => {
  assert.deepEqual(changesFor({ nameVi: 'Lộc', tagsVi: '  ', nicknameVi: 'x' }, record, keys), { tagsVi: 'b' });
  assert.deepEqual(changesFor({ nameVi: 'Lộc', tagsVi: 'a', nicknameVi: '' }, record, keys), { nicknameVi: null });
});

test('emptying a field that already shows its source is not a change', () => {
  assert.deepEqual(changesFor({ nameVi: '', tagsVi: 'a', nicknameVi: 'x' }, record, keys), {});
});

test('typed text is sent trimmed; unchanged fields are not sent', () => {
  assert.deepEqual(changesFor({ nameVi: ' Lộc Giác ', tagsVi: 'a', nicknameVi: 'x' }, record, keys), { nameVi: 'Lộc Giác' });
  assert.deepEqual(changesFor({ nameVi: 'Lộc', tagsVi: 'a', nicknameVi: 'x' }, record, keys), {});
  assert.equal(fieldValue(record, 'missing'), '');
});
