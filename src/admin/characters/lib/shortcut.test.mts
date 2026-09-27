import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSaveShortcut } from './shortcut.mts';

const key = (k: string, mod: 'ctrl' | 'meta' | '' = 'ctrl') => ({ key: k, ctrlKey: mod === 'ctrl', metaKey: mod === 'meta' });
test('Ctrl/⌘+S saves only while Khí Giả is the visible admin area', () => {
  const K = '#/admin/characters/A0001';
  assert.equal(isSaveShortcut(key('s'), '#/admin/characters/A0001', K), true);
  assert.equal(isSaveShortcut(key('S'), '#/admin/characters/A0001/lore', K), true);
  assert.equal(isSaveShortcut(key('s', 'meta'), '#/admin/characters', K), true);
  assert.equal(isSaveShortcut(key('s'), '#/admin', K), false);
  assert.equal(isSaveShortcut(key('s'), '#/admin/accounts', K), false);
  assert.equal(isSaveShortcut(key('s', ''), '#/admin/characters/A0001', K), false);
});

test('Từ điển saves its own editor; the hidden Khí Giả editors do not save from there, and the other way round', () => {
  const D = '#/admin/dictionary/weapons/weapon%3A31244';
  assert.equal(isSaveShortcut(key('s'), '#/admin/dictionary/weapons', D), true);
  assert.equal(isSaveShortcut(key('s'), '#/admin/dictionary/lore', '#/admin/characters/W0182/lore'), false);
  assert.equal(isSaveShortcut(key('s'), '#/admin/characters/W0182/lore', D), false);
});
