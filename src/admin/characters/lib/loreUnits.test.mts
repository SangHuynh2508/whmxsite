import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loreUnitGroups } from './loreUnits.mts';

test('groups units in reading order with Vietnamese labels, numbering basic reports and naming secret ones', () => {
  const structure = { reports: [
    { fileId: 'f1', kind: 'basic', unlock: { type: 2, elementId: '1' } },
    { fileId: 'f2', kind: 'basic', unlock: { type: 0, elementId: '' } },
    { fileId: 's1', kind: 'special', unlock: { type: 3, elementId: '9' } },
  ], timeline: ['A'] };
  const keys = ['card_intro', 'report.f1.title', 'report.f1.content', 'report.f2.title', 'report.f2.content', 'report.s1.title', 'report.s1.content', 'relic_intro', 'timeline.A.label', 'timeline.A.story'];
  const groups = loreUnitGroups(structure, keys, { 1: { nameCn: '感应', nameVi: null } });
  assert.deepEqual(groups.map((g) => g.group), ['Giới thiệu', 'Báo cáo', 'Hiện vật', 'Dòng thời gian']);
  assert.deepEqual(groups[1].items.map((i) => i.label), ['Tiêu đề 1', 'Báo cáo 1', 'Tiêu đề 2', 'Báo cáo 2', 'Tiêu đề mật', 'Báo cáo mật']);
  assert.equal(groups[1].items[0].extra, 'Mở khoá: thiện cảm 1 · 感应');
  assert.deepEqual(groups[3].items.map((i) => i.label), ['Mốc A', 'Câu chuyện A']);
});

test('units missing from the record are left out; empty groups disappear', () => {
  const groups = loreUnitGroups({ reports: [], timeline: [] }, ['card_intro'], {});
  assert.deepEqual(groups.map((g) => [g.group, g.items.length]), [['Giới thiệu', 1]]);
});

test('the quote is translatable in the Giới thiệu group, before the evaluation', () => {
  const groups = loreUnitGroups({ reports: [], timeline: [] }, ['card_intro', 'quote'], {});
  assert.deepEqual(groups[0].items.map((i) => i.unitKey), ['quote', 'card_intro']);
});
