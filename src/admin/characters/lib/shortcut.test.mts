import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSaveShortcut } from './shortcut.mts';

const key = (k: string, mod: 'ctrl' | 'meta' | '' = 'ctrl') => ({ key: k, ctrlKey: mod === 'ctrl', metaKey: mod === 'meta' });
test('Ctrl/⌘+S saves only while Khí Giả is the visible admin area', () => {
  assert.equal(isSaveShortcut(key('s'), '#/admin/characters/A0001'), true);
  assert.equal(isSaveShortcut(key('S'), '#/admin/characters/A0001/lore'), true);
  assert.equal(isSaveShortcut(key('s', 'meta'), '#/admin/characters'), true);
  assert.equal(isSaveShortcut(key('s'), '#/admin'), false);
  assert.equal(isSaveShortcut(key('s'), '#/admin/accounts'), false);
  assert.equal(isSaveShortcut(key('s', ''), '#/admin/characters/A0001'), false);
});
