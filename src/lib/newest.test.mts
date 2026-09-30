import assert from 'node:assert/strict';
import test from 'node:test';

import { newestFirst } from './newest.mts';

test('release date descending, undated last, same date by id descending', () => {
  const rows = [
    { id: 'A0001', date: 100 }, { id: 'A0184', date: 500 }, { id: 'W0097', date: null }, { id: 'A0170', date: 500 }, { id: 'D0183', date: 0 },
  ];
  rows.sort((a, b) => newestFirst(a.date, b.date, a.id, b.id));
  assert.deepEqual(rows.map((r) => r.id), ['A0184', 'A0170', 'A0001', 'W0097', 'D0183']);
});
