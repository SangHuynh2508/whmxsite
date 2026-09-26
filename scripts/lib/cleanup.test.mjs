import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanupFailed } from './cleanup.mjs';

test('a failed cleanup step is reported and fails the run instead of being swallowed', (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
  const before = process.exitCode;
  try {
    cleanupFailed(new Error('delete from users failed'));
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = before;
  }
  assert.match(logged.join('\n'), /cleanup failed.*delete from users failed/);
});
