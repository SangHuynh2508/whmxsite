import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLang, langUrl, pickText, pick, txt } from './lang.mts';

test('resolveLang: url > stored > vi, junk ignored', () => {
  assert.equal(resolveLang('?lang=cn', 'vi'), 'cn');
  assert.equal(resolveLang('', 'cn'), 'cn');
  assert.equal(resolveLang('', null), 'vi');
  assert.equal(resolveLang('?lang=en', 'cn'), 'cn');
  assert.equal(resolveLang('?lang=', null), 'vi');
});

test('langUrl keeps hash and other params', () => {
  assert.equal(langUrl('https://x.app/?a=1#/characters/y', 'cn'), 'https://x.app/?a=1&lang=cn#/characters/y');
  assert.equal(langUrl('https://x.app/?lang=cn#/', 'vi'), 'https://x.app/?lang=vi#/');
});

test('pickText', () => {
  assert.deepEqual(pickText('Kiếm', '剑', 'vi'), { text: 'Kiếm', untranslated: false });
  assert.deepEqual(pickText('', '剑', 'vi'), { text: '剑', untranslated: true });
  assert.deepEqual(pickText('Kiếm', '剑', 'cn'), { text: '剑', untranslated: false });
  assert.deepEqual(pickText('Kiếm', '', 'cn'), { text: 'Kiếm', untranslated: false });
  assert.deepEqual(pickText(null, null, 'vi'), { text: '', untranslated: false });
});

test('pick / txt read *_vi / *_cn', () => {
  const o = { name_vi: '', name_cn: '剑', desc_vi: 'Mô tả', desc_cn: '描述' };
  assert.deepEqual(pick(o, 'name', 'vi'), { text: '剑', untranslated: true });
  assert.equal(txt(o, 'desc', 'cn'), '描述');
  assert.equal(txt(undefined, 'name', 'vi'), '');
});
