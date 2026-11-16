import test from 'node:test';
import assert from 'node:assert/strict';
import { splitData } from './split_data.mjs';

test('splitData: heavy fields go to the detail, the index keeps the rest and a profile brief', () => {
  const data = {
    items: { a: 1 }, buff_registry: { B1: { x: 1 } },
    characters: { A1: { id: 'A1', name_vi: 'X', skins: [1], skills: [1], talents: [2], zhizhi: [3], brilliant_skills: [], brilliant_info: null, profile: { department: 'D', record_id: 'R', quote: 'q' } } },
  };
  const { index, details, buffs } = splitData(data);
  assert.deepEqual(index.characters.A1, { id: 'A1', name_vi: 'X', skins: [1], profile: { department: 'D', record_id: 'R' } });
  assert.deepEqual(details.A1, { skills: [1], talents: [2], zhizhi: [3], brilliant_skills: [], brilliant_info: null, profile: data.characters.A1.profile });
  assert.deepEqual(buffs, { B1: { x: 1 } });
  assert.deepEqual(index.items, { a: 1 });
  assert.equal('buff_registry' in index, false);
});
