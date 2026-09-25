import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedDraft, changesFor, draftToRestore, fieldValue } from './fields.mts';

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

// Review 2026-09-25 #1: the stored draft holds only what the user changed. Restored over a newer
// record (after a 409), a colleague's newer values survive instead of being reverted.
test('a restored draft carries only the fields the user changed', () => {
  const k = ['nameVi', 'tagsVi'];
  const before = { nameVi: { value: 'a', source: 'a' }, tagsVi: { value: 't', source: 't' } };
  const stored = changedDraft({ nameVi: 'mine', tagsVi: 't' }, before, k);
  assert.deepEqual(stored, { nameVi: 'mine' });
  const after = { nameVi: { value: 'a', source: 'a' }, tagsVi: { value: 'colleague', source: 't' } };
  const restored = { nameVi: 'a', tagsVi: 'colleague', ...stored };
  assert.deepEqual(changesFor(restored, after, k), { nameVi: 'mine' });
});

test('never offers a draft identical to the record; merges a real one over current values', () => {
  const k = ['nameVi', 'tagsVi'];
  const rec = { nameVi: { value: 'a', source: 'a' }, tagsVi: { value: 't', source: 't' } };
  assert.equal(draftToRestore({ nameVi: 'a' }, rec, k), null);
  assert.equal(draftToRestore(null, rec, k), null);
  assert.deepEqual(draftToRestore({ nameVi: 'mine' }, rec, k), { nameVi: 'mine', tagsVi: 't' });
});
