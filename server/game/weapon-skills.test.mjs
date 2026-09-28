import assert from 'node:assert/strict';
import test from 'node:test';

import { withWeaponSkills } from './weapon-skills.mjs';

test('each weapon text carries its skill codes (from the weapon reference), so the Từ điển edits them together', () => {
  const texts = [
    { kind: 'weapon', code: '31244', nameCn: '金桂抱月灯' },
    { kind: 'weapon', code: '30999', nameCn: '旧灯' },
    { kind: 'weapon_skill', code: 'EW4033', nameCn: '甲' },
  ];
  const refs = [{ kind: 'weapon', code: '31244', data: { skillIds: ['EW4033', 'EW4034'] } }, { kind: 'job_style', code: '401', data: {} }];
  assert.deepEqual(withWeaponSkills(texts, refs), [
    { kind: 'weapon', code: '31244', nameCn: '金桂抱月灯', skillCodes: ['EW4033', 'EW4034'] },
    { kind: 'weapon', code: '30999', nameCn: '旧灯', skillCodes: [] },
    { kind: 'weapon_skill', code: 'EW4033', nameCn: '甲' },
  ]);
});
