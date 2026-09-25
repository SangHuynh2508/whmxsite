import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorReducer, initialEditor } from './editorState.mts';

test('keeps typed values on 409 and on any failed save', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'typed' });
  s = editorReducer(s, { type: 'saveStart' });
  s = editorReducer(s, { type: 'saveFail', error: Object.assign(new Error('X'), { status: 409 }) });
  assert.equal(s.draft.nameVi, 'typed');
  assert.equal(s.status, 'conflict');
  s = editorReducer(s, { type: 'saveFail', error: Object.assign(new Error('X'), { status: 401 }) });
  assert.equal(s.draft.nameVi, 'typed');
  assert.equal(s.status, 'error');
  assert.match(s.message, /hết hạn/);
});

test('saveOk replaces the draft with the saved values; discard restores', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'b' });
  s = editorReducer(s, { type: 'saveOk', draft: { nameVi: 'b' } });
  assert.deepEqual([s.draft.nameVi, s.status], ['b', 'saved']);
  s = editorReducer(s, { type: 'discard', draft: { nameVi: 'a' } });
  assert.deepEqual([s.draft.nameVi, s.status], ['a', 'idle']);
});

// After a save the page reloads the record, which re-hydrates the editor; the "Đã lưu." feedback
// must survive whichever of saveOk / hydrate lands last.
test('hydrate after a successful save keeps the saved status', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'saveOk', draft: { nameVi: 'b' } });
  s = editorReducer(s, { type: 'hydrate', draft: { nameVi: 'b' } });
  assert.deepEqual([s.draft.nameVi, s.status, s.message], ['b', 'saved', 'Đã lưu.']);
  s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'hydrate', draft: { nameVi: 'c' } });
  assert.equal(s.status, 'idle');
});
