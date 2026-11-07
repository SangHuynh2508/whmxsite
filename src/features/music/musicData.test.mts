import assert from 'node:assert/strict';
import test from 'node:test';

import { assetUrl, filterTracks, groupCounts, loadMusic, trackTitle, type MusicTrack } from './musicData.mts';

const t = (o: Partial<MusicTrack>): MusicTrack => ({ id: 'x', file: 'music/bgm/x.mp3', cover: null, group: 'other', groups: ['other'],
  name_cn: '', name_vi: '', label_kind: '', label_cn: '', source_cn: '', stories: [], stories_total: 0,
  stages: { names_cn: [], count: 0 }, areas_cn: [], ...o });

const named = t({ id: 'novel_e2202', group: 'jukebox', groups: ['jukebox', 'story'], name_cn: '春华如梦', name_vi: 'Xuân Hoa Như Mộng' });
const battle = t({ id: 'bgm_battle_m01_01', group: 'stage', groups: ['stage'], label_kind: 'stage', label_cn: '远击的进阶：子' });
const both = t({ id: 'novel_m8', group: 'story', groups: ['story', 'stage'], label_kind: 'story', label_cn: '来古' });

test('filter by presence, not only the primary group', () => {
  assert.deepEqual(filterTracks([named, battle, both], 'stage', '').map((x) => x.id), ['bgm_battle_m01_01', 'novel_m8']);
  assert.equal(filterTracks([named, battle, both], 'all', '').length, 3);
});

test('search matches CN, VI, label and id, case-insensitive', () => {
  for (const q of ['春华', 'xuân hoa', '远击', 'BATTLE_M01', '  novel_m8 ']) assert.equal(filterTracks([named, battle, both], 'all', q).length, 1, q);
  assert.equal(filterTracks([named], 'all', 'không có').length, 0);
});

test('title: VI name in VI, CN name in CN, label otherwise, id last', () => {
  assert.equal(trackTitle(named, 'vi'), 'Xuân Hoa Như Mộng');
  assert.equal(trackTitle(named, 'cn'), '春华如梦');
  assert.equal(trackTitle(t({ ...named, name_vi: '' }), 'vi'), '春华如梦');
  assert.match(trackTitle(battle, 'vi'), /远击的进阶：子$/);
  assert.equal(trackTitle(t({ id: 'gacha_bgm' }), 'vi'), 'gacha_bgm');
});

test('counts per group by presence', () => {
  const c = groupCounts([named, battle, both]);
  assert.equal(c.stage, 2); assert.equal(c.jukebox, 1); assert.equal(c.other, 0);
});

test('asset url joins base and key', () => {
  assert.equal(assetUrl({ asset_base_url: 'https://r2.example/' } as never, 'music/bgm/x.mp3'), 'https://r2.example/music/bgm/x.mp3');
});

test('load returns null on a bad document or a failed fetch', async () => {
  assert.equal(await loadMusic(async () => new Response('{}')), null);
  assert.equal(await loadMusic(async () => { throw new Error('offline'); }), null);
  const ok = await loadMusic(async () => new Response(JSON.stringify({ version: 'r1', asset_base_url: '', tracks: [named] })));
  assert.equal(ok?.tracks.length, 1);
});
