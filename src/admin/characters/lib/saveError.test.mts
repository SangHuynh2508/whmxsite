import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveErrorMessage } from './saveError.mts';

const err = (status: number) => Object.assign(new Error('X'), { status });
test('maps save failures to Vietnamese messages', () => {
  assert.match(saveErrorMessage(err(409)), /người khác vừa lưu/);
  assert.match(saveErrorMessage(err(401)), /hết hạn/);
  assert.match(saveErrorMessage(err(403)), /không có quyền/);
  assert.match(saveErrorMessage(err(422)), /không hợp lệ/);
  assert.match(saveErrorMessage(new TypeError('Failed to fetch')), /Không thể lưu/);
});
