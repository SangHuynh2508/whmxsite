import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inScope, loreUnitGroups, teaUnitGroups, termProgress } from './loreUnits.mts';

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

test('termProgress: shared terms the character uses, each counted once; missing terms are not counted', () => {
  const t = (code: string, done: boolean) => ({ code, done });
  assert.deepEqual(termProgress([t('K1', true), null, t('Y1', false), t('K1', true), t('ORG_3', true)]), { done: 2, total: 3 });
  assert.deepEqual(termProgress([]), { done: 0, total: 0 });
});

test('inScope splits tea units from lore units', () => {
  assert.equal(inScope('tea.comment.1', 'tea'), true);
  assert.equal(inScope('tea.comment.1', 'lore'), false);
  assert.equal(inScope('card_intro', 'lore'), true);
  assert.equal(inScope('card_intro', 'tea'), false);
});

test('teaUnitGroups: teas by name, the 8-topic pool, the branches with their follow-ups, endings; missing units dropped', () => {
  const tea = { teas: ['81009'], topics: [{ id: 'X101', trend: 1 }], branches: [{ id: 'X301', next: [{ id: 'X303', trend: 2 }] }] };
  const keys = ['tea.comment.1', 'tea.X101.ask', 'tea.X101.reply', 'tea.X301.ask', 'tea.X301.reply', 'tea.X303.ask', 'tea.X303.reply', 'tea.win', 'tea.lose'];
  const groups = teaUnitGroups(tea, keys, { 81009: { nameCn: '杏皮茶', nameVi: null } });
  assert.deepEqual(groups.map((g) => g.group), ['Trà', 'Câu 1–2 · 缘起 相知', 'Câu 3–4 · 契合', 'Kết thúc']);
  assert.deepEqual(groups[0].items, [{ unitKey: 'tea.comment.1', label: 'Lời bình · 杏皮茶' }]);
  assert.deepEqual(groups[1].items.map((i) => [i.label, i.extra]), [['Chủ đề 1 · hỏi', undefined], ['Chủ đề 1 · đáp', 'Phản ứng: thích']]);
  assert.deepEqual(groups[2].items.map((i) => i.label), ['Nhánh 1 · hỏi', 'Nhánh 1 · đáp', 'Nhánh 1.1 · hỏi', 'Nhánh 1.1 · đáp']);
  assert.equal(groups[2].items[3].extra, 'Phản ứng: bối rối');
  assert.deepEqual(groups[3].items.map((i) => i.unitKey), ['tea.win', 'tea.lose']);
  assert.deepEqual(teaUnitGroups(undefined, keys, {}), []);
});
