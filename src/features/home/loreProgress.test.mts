import assert from 'node:assert/strict';
import test from 'node:test';

import { loreProgress } from './loreProgress.mts';

// v2 lore overlay profiles (server/profile/shape-character-profile.mjs); titles/labels never count.
const profile = (vi: boolean, at: string | null = null) => ({
  vi_updated_at: at,
  quote: '你好', quote_vi: vi ? 'Xin chào' : null,
  eval_intro: '介绍', eval_intro_vi: vi ? 'Giới thiệu' : null,
  reports: [{ title: '报告1', title_vi: 'Báo cáo 1', content: '内容', content_vi: null }],
  relic_info: { intro: '', intro_vi: null, timeline: [{ label: '金', label_vi: 'Kim', story: '故事', story_vi: vi ? 'Chuyện' : null }] },
});

test('counts main texts only; a profile is done when all of them are; recent = newest translated first', () => {
  const p = loreProgress({
    A1: { id: 'A1', profile: { ...profile(true, '2026-09-20T00:00:00Z'), reports: [] } },  // 3/3 done
    A2: { id: 'A2', profile: profile(true, '2026-09-25T00:00:00Z') },                        // 3/4
    A3: { id: 'A3', profile: profile(false, '2026-09-30T00:00:00Z') },                       // 0/4: a title edit, not recent
    A4: { id: 'A4', profile: { record_id: 'x', eval_intro: '介绍', reports: [], relic_info: {} } }, // legacy CN shape: skipped
  });
  assert.deepEqual([p.done, p.total, p.unitsDone, p.unitsTotal], [1, 3, 6, 11]);
  assert.deepEqual(p.recent, ['A2', 'A1']);
});

test('nothing left to translate, or no overlay, hides the block', () => {
  assert.equal(loreProgress({ A1: { id: 'A1', profile: { ...profile(true), reports: [] } } }).visible, false);
  assert.equal(loreProgress({ A4: { id: 'A4', profile: { eval_intro: '介绍' } } }).visible, false);
  assert.equal(loreProgress({ A2: { id: 'A2', profile: profile(true) } }).visible, true);
});
