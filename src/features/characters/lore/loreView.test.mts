import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLoreView, pick } from './loreView.mts';

test('pick: VI wins, else CN flagged untranslated, blank VI counts as missing', () => {
  assert.deepEqual(pick('Tên', '名'), { text: 'Tên', untranslated: false });
  assert.deepEqual(pick(null, '名'), { text: '名', untranslated: true });
  assert.deepEqual(pick('   ', '名'), { text: '名', untranslated: true });
  assert.deepEqual(pick(undefined, '  '), null);
});

const v2 = {
  archive: { image: 'https://r2/a.webp', head: 'https://r2/h.webp' },
  profile: {
    eval_intro: '介绍', eval_intro_vi: 'Giới thiệu',
    reports: [
      { kind: 'basic', title: '观察报告1', title_vi: 'Báo cáo quan sát 1', content: '内容', unlock_level: 5, unlock_name: '鹿鸣', unlock_name_vi: null },
      { kind: 'special', title: '机密报告A', title_vi: null, content: '', unlock_level: null, unlock_name: null },
      { kind: 'basic', title: '', content: '' },
    ],
    relic_info: {
      type: { cn: '武器', vi: 'Vũ khí' }, era: { cn: '18世纪', vi: null }, museum: { cn: '', vi: null },
      intro: '燧发枪', intro_vi: null,
      timeline: [{ label: '现今', label_vi: 'Hiện nay', story: '藏于温莎城堡。', story_vi: null }, { label: '', story: '' }],
    },
  },
};

test('v2 shape: every unit VI or CN, empty units and reports dropped, special report flagged', () => {
  const view = buildLoreView(v2);
  assert.deepEqual(view.archive, v2.archive);
  assert.deepEqual(view.intro, { text: 'Giới thiệu', untranslated: false });
  assert.deepEqual(view.facts, [
    { label: 'Loại', value: { text: 'Vũ khí', untranslated: false } },
    { label: 'Niên đại', value: { text: '18世纪', untranslated: true } },
  ]);
  assert.equal(view.reports.length, 2);
  assert.deepEqual(view.reports[0], {
    title: { text: 'Báo cáo quan sát 1', untranslated: false }, content: { text: '内容', untranslated: true },
    unlock: { text: '鹿鸣', untranslated: true }, unlockLevel: 5, special: false,
  });
  assert.equal(view.reports[1].special, true);
  assert.equal(view.reports[1].content, null);
  assert.deepEqual(view.relicIntro, { text: '燧发枪', untranslated: true });
  assert.deepEqual(view.timeline, [{ label: { text: 'Hiện nay', untranslated: false }, story: { text: '藏于温莎城堡。', untranslated: true } }]);
  assert.equal(view.empty, false);
});

test('legacy shape (overlay failed): CN everywhere, relic fields from legacy keys', () => {
  const view = buildLoreView({ profile: {
    eval_intro: '介绍', reports: [{ id: 1, title: '观察报告1', content: '内容' }],
    relic_info: { relic_name: '铜镜', dynasty: '金代', museum: '黑龙江省博物馆', intro: '金代铜镜' },
  } });
  assert.deepEqual(view.intro, { text: '介绍', untranslated: true });
  assert.deepEqual(view.facts.map((f) => f.label), ['Hiện vật', 'Niên đại', 'Nơi lưu giữ']);
  assert.equal(view.reports[0].title?.untranslated, true);
  assert.equal(view.reports[0].unlock, null);
  assert.deepEqual(view.relicIntro, { text: '金代铜镜', untranslated: true });
  assert.deepEqual(view.timeline, []);
});

test('no profile / empty relic_info / no archive → empty view, no crash', () => {
  for (const char of [{}, null, { profile: { relic_info: {} } }, { profile: { reports: 'bad' } }]) {
    const view = buildLoreView(char);
    assert.equal(view.empty, true);
    assert.equal(view.archive, null);
    assert.deepEqual(view.facts, []);
  }
});
