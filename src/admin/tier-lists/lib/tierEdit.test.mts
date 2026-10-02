import assert from 'node:assert/strict';
import test from 'node:test';
import type { TierListDoc } from '../../../features/tier-list/tierView.mts';
import { addTier, canInsert, duplicateEntry, insertEntry, moveEntry, moveTier, removeEntry, removeTier, tierListErrors, updateEntry, updateTier } from './tierEdit.mts';

const e = (id: string) => ({ characterId: id });
const base = (): TierListDoc => ({
  title: 'T', author: '', sourceUrl: '', info: '',
  solo: { note: '', tiers: [
    { label: 'S', description: '', joinAbove: false, entries: [e('a'), e('b'), e('c')] },
    { label: 'A', description: 'x', joinAbove: false, entries: [e('d')] },
  ] },
  teams: { note: '', groups: [{ name: 'Đội', note: '', members: [e('a'), e('b'), e('c'), e('d'), e('e'), e('f')] }] },
});
const ids = (doc: TierListDoc, i: number) => doc.solo.tiers[i].entries.map((x) => x.characterId);

test('move inside a tier and across tiers; the source document is not mutated', () => {
  const doc = base();
  assert.deepEqual(ids(moveEntry(doc, { area: 'tier', list: 0, index: 0 }, { area: 'tier', list: 0, index: 3 }), 0), ['b', 'c', 'a']);
  assert.deepEqual(ids(moveEntry(doc, { area: 'tier', list: 0, index: 2 }, { area: 'tier', list: 0, index: 0 }), 0), ['c', 'a', 'b']);
  const across = moveEntry(doc, { area: 'tier', list: 0, index: 1 }, { area: 'tier', list: 1, index: 0 });
  assert.deepEqual([ids(across, 0), ids(across, 1)], [['a', 'c'], ['b', 'd']]);
  assert.deepEqual(ids(doc, 0), ['a', 'b', 'c']);
});

test('insert, remove, duplicate, badges', () => {
  const doc = base();
  assert.deepEqual(ids(insertEntry(doc, { area: 'tier', list: 1, index: 1 }, e('z')), 1), ['d', 'z']);
  assert.deepEqual(ids(removeEntry(doc, { area: 'tier', list: 0, index: 1 }), 0), ['a', 'c']);
  assert.deepEqual(duplicateEntry(updateEntry(doc, { area: 'tier', list: 1, index: 0 }, { zhizhi: 3, hc: true }), { area: 'tier', list: 1, index: 0 }).solo.tiers[1].entries,
    [{ characterId: 'd', zhizhi: 3, hc: true }, { characterId: 'd', zhizhi: 3, hc: true }]);
  assert.deepEqual(updateEntry(updateEntry(doc, { area: 'tier', list: 1, index: 0 }, { zhizhi: 2 }), { area: 'tier', list: 1, index: 0 }, { zhizhi: null, hc: false }).solo.tiers[1].entries[0], { characterId: 'd' });
});

test('a team holds at most 6', () => {
  const doc = base();
  assert.equal(canInsert(doc, 'team', 0), false);
  assert.equal(canInsert(removeEntry(doc, { area: 'team', list: 0, index: 0 }), 'team', 0), true);
  assert.equal(insertEntry(doc, { area: 'team', list: 0, index: 0 }, e('g')), doc); // refused → unchanged
});

test('tiers: add, move, remove, edit; joinAbove cleared on the first tier', () => {
  const doc = base();
  assert.deepEqual(addTier(doc).solo.tiers.map((t) => t.label), ['S', 'A', '?']);
  const moved = moveTier(updateTier(doc, 1, { joinAbove: true }), 1, -1);
  assert.deepEqual(moved.solo.tiers.map((t) => [t.label, t.joinAbove]), [['A', false], ['S', false]]);
  assert.deepEqual(removeTier(doc, 0).solo.tiers.map((t) => t.label), ['A']);
  assert.equal(removeTier(removeTier(doc, 0), 0).solo.tiers.length, 1); // never below one tier
});

test('server errors in Vietnamese', () => {
  assert.deepEqual(tierListErrors([{ path: 'solo.tiers.1.entries.0.hc', code: 'NO_HUANZHANG' }, { path: 'title', code: 'REQUIRED' }, { path: 'x', code: 'ODD' }]),
    ['Tier 2, ô 1: nhân vật này không có Hoán Chương', 'Tiêu đề: bắt buộc', 'x: ODD']);
});
