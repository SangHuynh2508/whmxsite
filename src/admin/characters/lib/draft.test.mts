import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft.mts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

test('round-trips a draft and never throws when storage is unavailable', () => {
  const s = memory();
  const key = draftKey('character', 'A0001');
  saveDraft(s, key, { nameVi: 'x' });
  assert.deepEqual(loadDraft(s, key), { nameVi: 'x' });
  clearDraft(s, key);
  assert.equal(loadDraft(s, key), null);
  assert.doesNotThrow(() => { saveDraft(broken, key, {}); clearDraft(broken, key); });
  assert.equal(loadDraft(broken, key), null);
});
