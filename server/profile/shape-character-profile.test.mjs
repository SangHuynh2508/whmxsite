// server/profile/shape-character-profile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeCharacterProfile } from './shape-character-profile.mjs';

const t = (sourceCn, vi = null, viOrigin = null, state = 'ok') => ({ sourceCn, vi, viOrigin, state });
const term = (nameCn, nameVi = null, viOrigin = null, state = 'ok') => ({ nameCn, nameVi, viOrigin, state });
const profile = {
  recordId: '1-131-100', staffStatusCn: '已登记', storeStatusCn: '安全', organisationCode: '2',
  relicTypeCode: 'K1001', eraCode: 'T2005', museumCode: 'S3059', eraRangeCode: 'P8002',
  legacyRelicFields: { hasEntry: true, relicName: 'K1001', dynasty: 'T2005', museum: 'S3059' },
  structure: {
    reports: [
      { fileId: 'V005301', kind: 'basic', unlock: { type: 2, elementId: '1' } },
      { fileId: 'V005302', kind: 'basic', unlock: { type: 2, elementId: '5' } },
      { fileId: 'V005305', kind: 'special', unlock: { type: 3, elementId: 'M700011' } },
    ],
    timeline: ['A'],
  },
};
const texts = new Map([
  ['card_intro', t('介绍', 'Giới thiệu', 'admin')],
  ['report.V005301.title', t('报告1', 'Báo cáo 1', 'legacy_workbook')],
  ['report.V005301.content', t('内容1', 'Nội dung 1', 'admin', 'source_changed')],
  ['report.V005302.title', t('报告2')],
  ['report.V005305.title', t('特别')],
  ['relic_intro', t('本源')],
  ['timeline.A.label', t('战国', 'Chiến Quốc', 'admin')],
  ['timeline.A.story', t('故事')],
]);
const terms = new Map([
  ['ORG_2', term('商业部')], ['K1001', term('玉器', 'Ngọc Khí', 'admin')], ['T2005', term('春秋战国')],
  ['S3059', term('杭州博物馆')], ['AFFINITY_1', term('感应')], ['AFFINITY_5', term('鹿鸣', 'Lộc Minh', 'admin')],
]);

test('legacy shape reproduces the old build', () => {
  assert.deepEqual(shapeCharacterProfile({ profile, texts }, terms, { shape: 'legacy' }), {
    record_id: '1-131-100', department: 'Bộ Thương Mại', staff_status: 'Đã đăng ký', entity_status: 'An toàn',
    eval_intro: '介绍',
    reports: [{ id: 'V005301', title: '报告1', content: '内容1' }, { id: 'V005302', title: '报告2', content: '' }],
    relic_info: { relic_name: 'K1001', dynasty: 'T2005', museum: 'S3059', intro: '本源' },
  });
});

test('v2 shape publishes only admin+ok VI and resolves codes', () => {
  const v2 = shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' });
  assert.equal(v2.eval_intro_vi, 'Giới thiệu');
  assert.equal(v2.reports[0].title_vi, null);   // legacy_workbook is never exported
  assert.equal(v2.reports[0].content_vi, null); // source_changed is withheld
  assert.deepEqual(v2.reports.map((r) => [r.kind, r.unlock_level, r.unlock_name, r.unlock_name_vi]), [
    ['basic', 1, '感应', null], ['basic', 5, '鹿鸣', 'Lộc Minh'], ['special', null, null, null],
  ]);
  assert.deepEqual(v2.relic_info.type, { cn: '玉器', vi: 'Ngọc Khí', detail: '', detail_vi: null });
  assert.deepEqual(v2.relic_info.timeline, [{ label: '战国', label_vi: 'Chiến Quốc', story: '故事', story_vi: null }]);
  assert.ok(!JSON.stringify(v2).match(/"[KTSP]\d{4}"|V0053\d\d/), 'no raw codes or file ids');
});

test('v2 relic terms and the department carry their descriptions for the public popups (published VI only)', () => {
  const withDetail = new Map(terms);
  withDetail.set('K1001', { ...term('玉器', 'Ngọc Khí', 'admin'), detailCn: '玉器是…', detailVi: 'Ngọc khí là…' });
  withDetail.set('S3059', { ...term('杭州博物馆', 'Bảo tàng Hàng Châu'), detailCn: '杭州博物馆位于…', detailVi: 'nháp' }); // not admin → withheld
  withDetail.set('ORG_2', { ...term('商业部'), detailCn: '商业部负责…' });
  const v2 = shapeCharacterProfile({ profile, texts }, withDetail, { shape: 'v2' });
  assert.deepEqual(v2.relic_info.type, { cn: '玉器', vi: 'Ngọc Khí', detail: '玉器是…', detail_vi: 'Ngọc khí là…' });
  assert.deepEqual(v2.relic_info.museum, { cn: '杭州博物馆', vi: null, detail: '杭州博物馆位于…', detail_vi: null });
  assert.deepEqual(v2.relic_info.era, { cn: '春秋战国', vi: null, detail: '', detail_vi: null });
  assert.deepEqual(v2.department_detail, { cn: '商业部负责…', vi: null });
  assert.equal('department_detail' in shapeCharacterProfile({ profile, texts }, withDetail, { shape: 'legacy' }), false);
});

// Organisation names are admin VI in lore_terms since the 2026-09 seed (spec Q7): no JS name map in v2.
test('v2 department is the published admin VI of the organisation term, else its CN', () => {
  assert.equal(shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' }).department, '商业部');
  const custom = new Map(terms); custom.set('ORG_2', term('商业部', 'Bộ Thương Nghiệp', 'admin'));
  assert.equal(shapeCharacterProfile({ profile, texts }, custom, { shape: 'v2' }).department, 'Bộ Thương Nghiệp');
  const unknown = new Map(terms); unknown.set('ORG_2', term('冬谷·繁星花协会'));
  assert.equal(shapeCharacterProfile({ profile, texts }, unknown, { shape: 'v2' }).department, '冬谷·繁星花协会');
});

test('no relic entry gives an empty legacy relic_info', () => {
  const noRelic = { ...profile, legacyRelicFields: { hasEntry: false, relicName: '', dynasty: '', museum: '' } };
  assert.deepEqual(shapeCharacterProfile({ profile: noRelic, texts: new Map() }, terms, { shape: 'legacy' }).relic_info, {});
});

test('v2 relic_info.tags lists the extra relic facts by raw field, with descriptions (published VI only)', () => {
  const tagged = { ...profile, structure: { ...profile.structure, relicTags: [{ field: 'tag1', code: 'M4012' }, { field: 'tag3', code: 'H6002' }] } };
  const withTags = new Map(terms);
  withTags.set('M4012', { ...term('五彩', 'Ngũ Thái', 'admin'), detailCn: '五彩是…' });
  withTags.set('H6002', { ...term('景德镇官窑'), detailCn: '官窑…' });
  const v2 = shapeCharacterProfile({ profile: tagged, texts }, withTags, { shape: 'v2' });
  assert.deepEqual(v2.relic_info.tags, [
    { field: 'tag1', cn: '五彩', vi: 'Ngũ Thái', detail: '五彩是…', detail_vi: null },
    { field: 'tag3', cn: '景德镇官窑', vi: null, detail: '官窑…', detail_vi: null },
  ]);
  assert.deepEqual(shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' }).relic_info.tags, []);
});

test('v2 exports the quote (published VI only)', () => {
  const withQuote = new Map(texts); withQuote.set('quote', t('我是器者。', 'Ta là khí giả.', 'admin'));
  const v2 = shapeCharacterProfile({ profile, texts: withQuote }, terms, { shape: 'v2' });
  assert.deepEqual([v2.quote, v2.quote_vi], ['我是器者。', 'Ta là khí giả.']);
  assert.deepEqual([shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' }).quote], ['']);
});

// Home "Bản dịch Hồ Sơ" (2026-10-02): the latest published VI of a main text orders "Mới dịch"; report titles and
// timeline labels are short labels, not a translation milestone.
test('v2 vi_updated_at is the latest published main-text VI, else null', () => {
  const at = (iso) => new Date(iso);
  const dated = new Map([
    ['card_intro', { ...t('介绍', 'Giới thiệu', 'admin'), viUpdatedAt: at('2026-09-20T01:00:00Z') }],
    ['report.V005301.content', { ...t('内容1', 'Nội dung 1', 'admin'), viUpdatedAt: at('2026-09-25T01:00:00Z') }],
    ['report.V005301.title', { ...t('报告1', 'Báo cáo 1', 'admin'), viUpdatedAt: at('2026-09-30T01:00:00Z') }],
    ['timeline.A.label', { ...t('战国', 'Chiến Quốc', 'admin'), viUpdatedAt: at('2026-09-30T01:00:00Z') }],
    ['relic_intro', { ...t('本源', 'nháp', 'admin', 'source_changed'), viUpdatedAt: at('2026-09-29T01:00:00Z') }],
  ]);
  assert.equal(shapeCharacterProfile({ profile, texts: dated }, terms, { shape: 'v2' }).vi_updated_at, '2026-09-25T01:00:00.000Z');
  assert.equal(shapeCharacterProfile({ profile, texts: new Map() }, terms, { shape: 'v2' }).vi_updated_at, null);
  assert.equal('vi_updated_at' in shapeCharacterProfile({ profile, texts: dated }, terms, { shape: 'legacy' }), false);
});

const teaProfile = { ...profile, structure: { ...profile.structure, tea: {
  teas: ['81009'],
  topics: [{ id: 'X101', trend: 1 }, { id: 'X201', trend: 2 }],
  branches: [{ id: 'X301', next: [{ id: 'X303', trend: 1 }, { id: 'X304', trend: 2 }] }],
} } };
const teaTexts = new Map([...texts,
  ['tea.X101.ask', t('夜市', 'Chợ đêm', 'admin')], ['tea.X101.reply', t('来吧')],
  ['tea.X201.ask', t('演唱会')], ['tea.X201.reply', t('（无人回应。）')],
  ['tea.X301.ask', t('酒馆')], ['tea.X301.reply', t('你猜？')],
  ['tea.X303.ask', t('随心')], ['tea.X303.reply', t('不错')], ['tea.X304.ask', t('真样')], ['tea.X304.reply', t('虚妄')],
  ['tea.comment.1', t('冰的', 'Uống lạnh', 'admin')], ['tea.win', t('好茶')], ['tea.lose', t('下次')],
]);
const teaTerms = new Map([...terms,
  ['81009', { ...term('杏皮茶', 'Trà vỏ mơ', 'admin'), detailCn: '西北饮品', detailVi: null }],
  ['TEA_STAGE_1', term('缘起')], ['TEA_STAGE_2', term('相知', 'Tương tri', 'admin')], ['TEA_STAGE_3', term('契合')],
  ['TEA_RESULT', term('瓦铫煮春雪\n淡香生古瓷')],
]);

test('v2 tea: teas with description and comment, stages, reactions, endings, shared poem', () => {
  const out = shapeCharacterProfile({ profile: teaProfile, texts: teaTexts }, teaTerms, { shape: 'v2' });
  assert.deepEqual(out.tea, {
    teas: [{ code: '81009', name: '杏皮茶', name_vi: 'Trà vỏ mơ', desc: '西北饮品', desc_vi: null, comment: '冰的', comment_vi: 'Uống lạnh' }],
    stages: [{ cn: '缘起', vi: null }, { cn: '相知', vi: 'Tương tri' }, { cn: '契合', vi: null }],
    topics: [
      { ask: '夜市', ask_vi: 'Chợ đêm', reply: '来吧', reply_vi: null, reaction: 'like' },
      { ask: '演唱会', ask_vi: null, reply: '（无人回应。）', reply_vi: null, reaction: 'puzzled' },
    ],
    branches: [{ ask: '酒馆', ask_vi: null, reply: '你猜？', reply_vi: null, next: [
      { ask: '随心', ask_vi: null, reply: '不错', reply_vi: null, reaction: 'like' },
      { ask: '真样', ask_vi: null, reply: '虚妄', reply_vi: null, reaction: 'puzzled' },
    ] }],
    win: '好茶', win_vi: null, lose: '下次', lose_vi: null,
    result: { cn: '瓦铫煮春雪\n淡香生古瓷', vi: null },
  });
  assert.equal(JSON.stringify(out.tea).includes('X101'), false); // no topic IDs in public output
});

test('v2 tea: a character\'s own poem wins; no tea structure → no tea key; tea VI never moves vi_updated_at', () => {
  const own = new Map([...teaTexts, ['tea.result', t('别的诗')]]);
  assert.deepEqual(shapeCharacterProfile({ profile: teaProfile, texts: own }, teaTerms, { shape: 'v2' }).tea.result, { cn: '别的诗', vi: null });
  assert.equal('tea' in shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' }), false);
  const dated = new Map([['tea.win', { ...t('好茶', 'Trà ngon', 'admin'), viUpdatedAt: new Date('2026-10-03T00:00:00Z') }]]);
  assert.equal(shapeCharacterProfile({ profile: teaProfile, texts: dated }, teaTerms, { shape: 'v2' }).vi_updated_at, null);
});

test('v2 tea: a character without tea endings (no highteaCharacterMap row) gets no shared poem', () => {
  const topicsOnly = new Map([['tea.X101.ask', t('夜市')], ['tea.X101.reply', t('来吧')]]);
  const p = { ...profile, structure: { ...profile.structure, tea: { teas: [], topics: [{ id: 'X101', trend: 1 }], branches: [] } } };
  assert.equal(shapeCharacterProfile({ profile: p, texts: topicsOnly }, teaTerms, { shape: 'v2' }).tea.result, null);
});
