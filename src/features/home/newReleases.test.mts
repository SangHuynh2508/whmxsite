import assert from 'node:assert/strict';
import test from 'node:test';

import { newReleases } from './newReleases.mts';

const chars = {
  A0184: { id: 'A0184', name_vi: 'Thác Kim Bác Sơn Lư', name_cn: '错金博山炉', icon: 'assets/characters/avatars/A0184.png', unlock_date: 500,
    skins: [{ skinID: 'A0184001', name_cn: 'base', is_base: true, unlock_date: 500 }] },
  A0170: { id: 'A0170', name_cn: '小宋香炉', unlock_date: 100,
    skins: [{ skinID: 'A0170003', name_vi: 'Áo mới', name_cn: '新衣', is_base: false, unlock_date: 520, image: 'https://r2/x.webp' }] },
  W0185: { id: 'W0185', name_cn: '刻本山海经', unlock_date: 9000, skins: [] },
};

test('newest first; base skins and future unlocks excluded; isNew from the version start', () => {
  const out = newReleases(chars, 600, 400);
  assert.deepEqual(out.map((r) => [r.kind, r.id, r.isNew]), [['skin', 'A0170003', true], ['character', 'A0184', true], ['character', 'A0170', false]]);
  assert.equal(out[0].name, 'Áo mới');
  assert.equal(out[1].name, 'Thác Kim Bác Sơn Lư');
  assert.equal(out[2].name, '小宋香炉');
});

test('limit and no version', () => {
  assert.equal(newReleases(chars, 600, null, 1).length, 1);
  assert.equal(newReleases(chars, 600, null)[0].isNew, false);
});
