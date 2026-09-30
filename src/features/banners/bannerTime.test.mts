import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate, remaining, status } from './bannerTime.mts';

const S = 1_000;
test('status: start inclusive, end exclusive', () => {
  assert.equal(status(99 * S, 100, 200), 'upcoming');
  assert.equal(status(100 * S, 100, 200), 'active');
  assert.equal(status(199_999, 100, 200), 'active');
  assert.equal(status(200 * S, 100, 200), 'ended');
});

test('remaining: days+hours, hours+minutes, minutes, under a minute', () => {
  const end = 1_000_000;
  assert.equal(remaining((end - (8 * 86400 + 10 * 3600 + 59)) * S, end), '8 ngày 10 giờ');
  assert.equal(remaining((end - (5 * 3600 + 12 * 60 + 30)) * S, end), '5 giờ 12 phút');
  assert.equal(remaining((end - (45 * 60 + 5)) * S, end), '45 phút');
  assert.equal(remaining((end - 30) * S, end), '< 1 phút');
  assert.equal(remaining((end + 5) * S, end), '');
});

test('formatDate uses the given time zone', () => {
  // 2026-10-21 18:00 UTC = 2026-10-22 01:00 in Vietnam
  const s = Date.UTC(2026, 9, 21, 18, 0) / 1000;
  assert.equal(formatDate(s, 'Asia/Ho_Chi_Minh'), '22/10/2026');
  assert.equal(formatDate(s, 'UTC'), '21/10/2026');
});
