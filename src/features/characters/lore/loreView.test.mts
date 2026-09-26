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
    { label: 'Loại', value: { text: 'Vũ khí', untranslated: false }, detail: null },
    { label: 'Niên đại', value: { text: '18世纪', untranslated: true }, detail: null },
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

test('term descriptions, relic name, people and the untranslated flag (B4 ticket + notice)', () => {
  const view = buildLoreView({
    name_vi: 'Heart Shaped Barrel', fullname_vi: 'Heart Shaped Barrel', fullname_cn: '心形枪管线膛前装燧发枪',
    profile: {
      department: 'Học Viện Anh Quốc', department_detail: { cn: '发端于雾都伦敦', vi: null },
      entity_status: 'An toàn', record_id: 'E-401-176504', eval_intro: '介绍', eval_intro_vi: 'Giới thiệu',
      relic_info: { type: { cn: '武器', vi: 'Vũ khí', detail: '武器是…', detail_vi: 'Vũ khí là…' }, era: { cn: '18世纪', vi: null, detail: '', detail_vi: null } },
    },
  });
  assert.deepEqual(view.facts[0], { label: 'Loại', value: { text: 'Vũ khí', untranslated: false }, detail: { text: 'Vũ khí là…', untranslated: false } });
  assert.equal(view.facts[1].detail, null);
  assert.deepEqual(view.relicName, { text: '心形枪管线膛前装燧发枪', untranslated: true }); // fullname_vi = the character name, not a relic-name translation
  assert.deepEqual(view.people, { department: 'Học Viện Anh Quốc', departmentDetail: { text: '发端于雾都伦敦', untranslated: true }, status: 'An toàn', recordId: 'E-401-176504' });
  assert.equal(view.hasUntranslated, true);
  assert.equal(buildLoreView({ profile: { eval_intro_vi: 'Chỉ VI' } }).hasUntranslated, false);
  assert.equal(buildLoreView({ profile: { record_id: 'X-1' } }).empty, false);
  assert.equal(buildLoreView({}).people, null);
});

test('relic tags with a confirmed label become extra facts; unconfirmed fields (tag4) stay hidden', () => {
  const view = buildLoreView({ profile: { relic_info: {
    type: { cn: '瓷器' },
    tags: [
      { field: 'tag1', cn: '五彩', vi: null, detail: '五彩是…', detail_vi: null },
      { field: 'tag2', cn: '曾侯乙墓', vi: null, detail: '', detail_vi: null },
      { field: 'tag3', cn: '景德镇官窑', vi: 'Quan diêu Cảnh Đức Trấn', detail: '', detail_vi: null },
      { field: 'tag4', cn: '外销文物', vi: null, detail: '', detail_vi: null },
    ],
  } } });
  assert.deepEqual(view.facts.map((f) => [f.label, f.value.text]), [['Loại', '瓷器'], ['Kỹ thuật', '五彩'], ['Nơi khai quật', '曾侯乙墓'], ['Nơi sản xuất', 'Quan diêu Cảnh Đức Trấn']]);
  assert.deepEqual(view.facts[1].detail, { text: '五彩是…', untranslated: true });
});

test('quote: VI else CN; shown on Tổng Quan, so it does not count for the lore tab notice or emptiness', () => {
  const view = buildLoreView({ profile: { quote: '我是器者。', quote_vi: null } });
  assert.deepEqual(view.quote, { text: '我是器者。', untranslated: true });
  assert.equal(view.hasUntranslated, false);
  assert.equal(view.empty, true);
});
