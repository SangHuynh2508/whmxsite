// scripts/lib/voice-source.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignUnlockCodes, voiceUnits } from './voice-source.mjs';

const line = (o) => ({ skin: 'A0100001', type: 'regardsLine', order: 2, label: '问候', text: '今日吹的是北风。', key: 'k', ...o });
const DOC = { id: 'A0100', langs: [
  { lang: '1001', lines: [
    line({}),
    line({ type: 'dropLine', text: '吾乃愿望杯。' }),
    line({ type: 'touchLine_4', text: '', unlock: '感应达到投契解锁' }),
    line({ type: 'touchLine_5', text: '鹿鸣', unlock: '精研解锁' }),
  ] },
  { lang: '1007', lines: [
    line({ text: ' 今日吹的是北风。 ' }), // same CN as the main pack → no key
    line({ type: 'dropLine', text: '另一句。' }), // different CN → its own key
    line({ type: 'touchLine_4', text: '', unlock: '感应达到投契解锁' }),
  ] },
] };

test('main pack keys, alt pack only when the CN differs, empty lines skipped', () => {
  const { units } = voiceUnits(DOC);
  assert.deepEqual(units.map((u) => u.unitKey), [
    'voice.A0100001.regardsLine', 'voice.A0100001.dropLine', 'voice.A0100001.touchLine_5', 'voice.A0100001.dropLine.1007',
  ]);
  const alt = units.at(-1);
  assert.equal(alt.sourceCn, '另一句。');
  assert.equal(alt.sourceRef, 'voice:A0100/1007/A0100001/dropLine');
  assert.match(alt.sourceHash, /^[0-9a-f]{64}$/);
});

test('unlock texts: unique, sorted, empty ignored', () => {
  assert.deepEqual(voiceUnits(DOC).unlocks, ['感应达到投契解锁', '精研解锁'].sort());
  assert.deepEqual(voiceUnits({ id: 'X', langs: [{ lang: '1001', lines: [line({ unlock: '  ' })] }] }).unlocks, []);
});

test('unlock codes: existing kept, new ones numbered after the highest', () => {
  const first = assignUnlockCodes(['乙', '甲'], new Map());
  assert.deepEqual([...first], [['乙', 'VOICE_UNLOCK_1'], ['甲', 'VOICE_UNLOCK_2']]); // sorted CN order
  const again = assignUnlockCodes(['丙', '甲'], new Map([['乙', 'VOICE_UNLOCK_1'], ['甲', 'VOICE_UNLOCK_2']]));
  assert.deepEqual([...again], [['丙', 'VOICE_UNLOCK_3'], ['甲', 'VOICE_UNLOCK_2']]);
});
