import assert from 'node:assert/strict';
import test from 'node:test';
import { strings, s } from './strings.mts';

test('every vi key has a non-empty cn key and vice versa', () => {
  assert.deepEqual(Object.keys(strings.cn).sort(), Object.keys(strings.vi).sort());
  for (const [k, v] of Object.entries(strings.cn)) assert.ok(v, `cn.${k} empty`);
});

test('s() returns the requested language', () => {
  assert.equal(s('navCharacters', 'vi'), 'Khí Giả');
  assert.equal(s('navCharacters', 'cn'), '器者');
});
