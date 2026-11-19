import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inScope, loreUnitGroups, teaUnitGroups, termProgress, voiceUnitGroups } from './loreUnits.mts';

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

test('inScope: three scopes by prefix', () => {
  assert.equal(inScope('voice.A0100001.regardsLine', 'voice'), true);
  assert.equal(inScope('voice.A0100001.regardsLine', 'lore'), false);
  assert.equal(inScope('voice.A0100001.regardsLine', 'tea'), false);
  assert.equal(inScope('quote', 'voice'), false);
});

test('voiceUnitGroups: groups like the tab, labels VI · CN, skin and pack names, unlock / zone, audio', () => {
  const ln = (o: object) => ({ skin: 'A0100001', type: 'regardsLine', order: 2, label: '问候', text: '北风', key: 'voice/a0100/1001/a0100001_regardsLine.mp3' as string | null, ...o });
  const doc = { version: 'r3177', asset_base_url: 'https://cdn.example/', id: 'A0100', langs: [
    { lang: '1001', name: '中文-普通话', cv: '', lines: [
      ln({ type: 'levelUpLine', label: '升级' }), ln({}), ln({ type: 'touchLine_4', label: '投契之谈', unlock: '精研解锁', key: null }),
      ln({ type: 'timeLine_1', label: '时间1', zone: '6:00–18:00' }), ln({ skin: 'A0100002' }),
    ] },
    { lang: '1007', name: '古埃及语（女收藏家）', cv: '', lines: [ln({ type: 'dropLine', label: '招集' })] },
  ] };
  const mp3 = 'https://cdn.example/voice/a0100/1001/a0100001_regardsLine.mp3';
  const keys = ['voice.A0100001.levelUpLine', 'voice.A0100001.regardsLine', 'voice.A0100001.touchLine_4', 'voice.A0100001.timeLine_1', 'voice.A0100002.regardsLine', 'voice.A0100001.dropLine.1007'];
  const g = voiceUnitGroups(doc, keys, (id) => (id === 'A0100002' ? 'Áo mới' : id));
  assert.deepEqual(g.map((x) => x.group), ['Đời thường', 'Phát triển']);
  assert.deepEqual(g[0].items, [
    { unitKey: 'voice.A0100001.regardsLine', label: 'Chào hỏi · 问候', audio: mp3 },
    { unitKey: 'voice.A0100001.touchLine_4', label: 'Đầu Khế chi đàm · 投契之谈', extra: 'Mở khoá: 精研解锁' },
    { unitKey: 'voice.A0100001.timeLine_1', label: 'Trò chuyện theo giờ 1 · 时间1', extra: 'Khung giờ 6:00–18:00', audio: mp3 },
    { unitKey: 'voice.A0100002.regardsLine', label: 'Chào hỏi · 问候 · Áo mới', audio: mp3 },
    { unitKey: 'voice.A0100001.dropLine.1007', label: 'Chiêu mộ · 招集 · 古埃及语（女收藏家）', audio: mp3 },
  ]);
  assert.deepEqual(g[1].items, [{ unitKey: 'voice.A0100001.levelUpLine', label: 'Lên cấp · 升级', audio: mp3 }]);
  assert.deepEqual(voiceUnitGroups(null, keys), []);
  assert.deepEqual(voiceUnitGroups(doc, []), []);
});
