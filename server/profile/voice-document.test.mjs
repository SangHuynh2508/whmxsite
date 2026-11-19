// server/profile/voice-document.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceDocument } from './voice-document.mjs';

const row = (unitKey, vi, o = {}) => ({ characterId: 'A0100', unitKey, vi, viOrigin: vi ? 'admin' : null, state: 'ok', sourcePresent: true, ...o });

test('only published VI, key without the voice. prefix, characters without VI left out', () => {
  const doc = JSON.parse(buildVoiceDocument({
    texts: [
      row('voice.A0100001.regardsLine', 'Gió bấc'),
      row('voice.A0100001.dropLine.1007', 'Câu riêng'),
      row('voice.A0100001.touchLine_1', null),
      row('voice.A0100001.touchLine_2', 'Cũ', { state: 'source_changed' }),
      row('voice.A0100001.touchLine_3', 'Mất', { sourcePresent: false }),
      row('voice.A0100001.touchLine_5', 'Bản cũ', { viOrigin: 'legacy_workbook' }),
      row('voice.A0200001.regardsLine', null, { characterId: 'A0200' }),
    ],
    unlocks: [
      { nameCn: '精研解锁', nameVi: 'Mở khi Tinh Nghiên', viOrigin: 'admin', state: 'ok', sourcePresent: true },
      { nameCn: '功能模块开发中', nameVi: null, viOrigin: null, state: 'ok', sourcePresent: true },
    ],
  }).body);
  assert.deepEqual(doc, {
    version: 1,
    unlock: { '精研解锁': 'Mở khi Tinh Nghiên' },
    characters: { A0100: { 'A0100001.dropLine.1007': 'Câu riêng', 'A0100001.regardsLine': 'Gió bấc' } },
  });
});

test('nothing translated still makes a valid document; same input, same file name', () => {
  const a = buildVoiceDocument({ texts: [], unlocks: [] });
  assert.deepEqual(JSON.parse(a.body), { version: 1, unlock: {}, characters: {} });
  assert.match(a.fileName, /^voice\.[0-9a-f]{12}\.json$/);
  assert.equal(buildVoiceDocument({ texts: [], unlocks: [] }).fileName, a.fileName);
});
