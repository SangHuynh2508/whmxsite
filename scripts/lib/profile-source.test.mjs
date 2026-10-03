// scripts/lib/profile-source.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfileSources } from './profile-source.mjs';

const raw = {
  characterFiles: {
    V0053: {
      recordID: ' 1-131-100 ', stafflanText: '已登记', storelanText: '安全', cardIntrolanText: ' 介绍 ',
      basicFileID: ['V005301', 'V005302'], basicFileUnlock: [{ UnlockType: 2, ElementID: '1', Param: 1 }, { UnlockType: 2, ElementID: '5', Param: 1 }],
      specialFileID: ['V005305'], specialFileUnlock: [{ UnlockType: 3, ElementID: 'M700011', Param: 1 }],
    },
    W0021: { recordID: 'x', basicFileID: [] },
  },
  characterFileTextMap: {
    V005301: { titleLanText: '报告1', textLanText: '内容1' },
    V005302: { titleLanText: '', textLanText: '' },
    V005305: { titleLanText: '特别', textLanText: '特别内容' },
  },
  historicalRelicsMap: {
    V0053: {
      relics: 'K1001', dynasty: 'T2005', museum: 'S3059', photoDynasty: 'P8002',
      relicslanText: 'K1001', dynastylanText: 'T2005', museumlanText: 'S3059', introductionlanText: '本源',
      ageAlanText: '战国', ageStoryAlanText: '故事A', ageBlanText: '', ageStoryBlanText: '', ageElan: 'unused',
    },
  },
  historicalTextMap: {
    K1001: { Text: '玉器', TextIntroduce: '玉器介绍' }, T2005: { Text: '春秋战国', TextIntroduce: '' },
    S3059: { Text: '杭州博物馆', TextIntroduce: '馆' }, P8002: { Text: '夏商周', TextIntroduce: '' }, B5001: { Text: '墓', TextIntroduce: '' },
  },
  friendshipDescription: { 1: { level: 1, iconDescriptionLanText: '感应', descriptionLanText: '感应' }, 5: { level: 5, iconDescriptionLanText: '鹿鸣', descriptionLanText: '鹿鸣' } },
  characterTable: { V0053: { typeJJh: 2 }, W0021: { typeJJh: 1 } },
  typeJJHMap: { 2: { NameLanText: '商业部', FileLanText: '商业部介绍' }, 5: { NameLanText: '非冬谷', FileLanText: '测试' } },
};

test('builds units, structure and referenced terms only', () => {
  const out = normalizeProfileSources(raw, ['V0053']);
  assert.deepEqual(out.skipped, ['W0021']);
  const [p] = out.profiles;
  assert.equal(p.recordId, '1-131-100');
  assert.equal(p.organisationCode, '2');
  assert.deepEqual(p.legacyRelicFields, { hasEntry: true, relicName: 'K1001', dynasty: 'T2005', museum: 'S3059' });
  assert.deepEqual(p.structure.reports, [
    { fileId: 'V005301', kind: 'basic', unlock: { type: 2, elementId: '1' } },
    { fileId: 'V005302', kind: 'basic', unlock: { type: 2, elementId: '5' } },
    { fileId: 'V005305', kind: 'special', unlock: { type: 3, elementId: 'M700011' } },
  ]);
  assert.deepEqual(p.structure.timeline, ['A']);
  assert.deepEqual(p.units.map((u) => u.unitKey), [
    'card_intro', 'report.V005301.title', 'report.V005301.content',
    'report.V005305.title', 'report.V005305.content', 'relic_intro', 'timeline.A.label', 'timeline.A.story',
  ]);
  assert.equal(p.units[0].sourceCn, '介绍');
  assert.equal(p.units[1].sourceRef, 'characterFileTextMap:V005301.titleLanText');
  assert.deepEqual(out.terms.map((t) => t.code), ['AFFINITY_1', 'AFFINITY_5', 'K1001', 'ORG_2', 'P8002', 'S3059', 'T2005']);
  const org = out.terms.find((t) => t.code === 'ORG_2');
  assert.deepEqual([org.kind, org.nameCn, org.detailCn], ['organisation', '商业部', '商业部介绍']);
});

test('a referenced code missing from HistoricalTextMap aborts', () => {
  const broken = structuredClone(raw);
  delete broken.historicalTextMap.K1001;
  assert.throws(() => normalizeProfileSources(broken, ['V0053']), /K1001/);
});

test('hashes are stable across runs', () => {
  assert.equal(normalizeProfileSources(raw, ['V0053']).profiles[0].sourceHash, normalizeProfileSources(raw, ['V0053']).profiles[0].sourceHash);
});

test('imports every affinity level, even unreferenced ones (spec §3.4)', () => {
  const withLevel9 = structuredClone(raw);
  withLevel9.friendshipDescription[9] = { level: 9, iconDescriptionLanText: '莫逆', descriptionLanText: '莫逆之交' };
  const term = normalizeProfileSources(withLevel9, ['V0053']).terms.find((t) => t.code === 'AFFINITY_9');
  assert.deepEqual([term?.nameCn, term?.detailCn], ['莫逆', '莫逆之交']);
});

test('a DB character missing from raw is reported, not given an empty profile (review #13)', () => {
  const out = normalizeProfileSources(raw, ['V0053', 'Z9999']);
  assert.deepEqual(out.missingFromRaw, ['Z9999']);
  assert.deepEqual(out.profiles.map((p) => p.characterId), ['V0053']);
});

test('relic tags tag1..tag4 become structure.relicTags + relic_tag terms, only when present (owner 2026-09-26)', () => {
  const withTags = structuredClone(raw);
  Object.assign(withTags.historicalRelicsMap.V0053, { tag1: 'M4012', tag2: '', tag3: 'H6002', tag4: '' });
  Object.assign(withTags.historicalTextMap, { M4012: { Text: '五彩', TextIntroduce: '五彩介绍' }, H6002: { Text: '景德镇官窑', TextIntroduce: '官窑' } });
  const [p] = normalizeProfileSources(withTags, ['V0053']).profiles;
  assert.deepEqual(p.structure.relicTags, [{ field: 'tag1', code: 'M4012' }, { field: 'tag3', code: 'H6002' }]);
  const terms = normalizeProfileSources(withTags, ['V0053']).terms.filter((t) => t.kind === 'relic_tag');
  assert.deepEqual(terms.map((t) => [t.code, t.nameCn, t.detailCn]), [['H6002', '景德镇官窑', '官窑'], ['M4012', '五彩', '五彩介绍']]);
  // no tags → no key, so existing profiles keep their source hash
  assert.equal('relicTags' in normalizeProfileSources(raw, ['V0053']).profiles[0].structure, false);
  delete withTags.historicalTextMap.H6002;
  assert.throws(() => normalizeProfileSources(withTags, ['V0053']), /H6002/);
});

test('quote = recruit line (dropLineLanText) of the base skin, as a translatable unit (owner 2026-09-26)', () => {
  const withLines = structuredClone(raw);
  // real shape: { characterId: [skins…] }
  withLines.characterSkins = { V0053: [{ skinID: 'V0053002', characterId: 'V0053', bIsBaseSkin: false }, { skinID: 'V0053001', characterId: 'V0053', bIsBaseSkin: true }] };
  withLines.characterLines = { a: { id: 'V0053002', dropLineLanText: '皮肤台词' }, b: { id: 'V0053001', dropLineLanText: ' 我是器者。 ' } };
  const [p] = normalizeProfileSources(withLines, ['V0053']).profiles;
  const quote = p.units.find((u) => u.unitKey === 'quote');
  assert.deepEqual([quote.sourceCn, quote.sourceRef], ['我是器者。', 'characterLines:V0053001.dropLineLanText']);
  assert.equal(normalizeProfileSources(raw, ['V0053']).profiles[0].units.some((u) => u.unitKey === 'quote'), false);
});

const teaRaw = {
  ...raw,
  playerAskMap: {
    V0053101: { ID: 'V0053101', CharacterId: 'V0053', Trend: 1, TopicType: 1, TopicNext: [], TopicContentLanText: ' 夜市 ', TopicRespLanText: 'player，来吧' },
    V0053201: { ID: 'V0053201', CharacterId: 'V0053', Trend: 2, TopicType: 1, TopicNext: [], TopicContentLanText: '演唱会', TopicRespLanText: '（茶室里一时无人回应。）' },
    V0053301: { ID: 'V0053301', CharacterId: 'V0053', Trend: 0, TopicType: 2, TopicNext: ['V0053303', 'V0053304'], TopicContentLanText: '酒馆', TopicRespLanText: '你猜？' },
    V0053303: { ID: 'V0053303', CharacterId: 'V0053', Trend: 1, TopicType: 0, TopicNext: [], TopicContentLanText: '随心', TopicRespLanText: '不错' },
    V0053304: { ID: 'V0053304', CharacterId: 'V0053', Trend: 2, TopicType: 0, TopicNext: [], TopicContentLanText: '真样', TopicRespLanText: '虚妄' },
    W0021101: { ID: 'W0021101', CharacterId: 'W0021', Trend: 1, TopicType: 1, TopicNext: [], TopicContentLanText: 'x', TopicRespLanText: 'y' },
  },
  highteaCharacterMap: {
    // the game stores the poem's line breaks as a literal backslash + "n"
    V0053: { UPTea: ['81009'], Comments: ['highteaLan_hightea_comment1Lan_V0053'], VictoryEndLanText: '好茶', VictoryEnd2LanText: String.raw`瓦铫煮春雪\n淡香生古瓷`, FailEnd: '下次' },
    A0001: { UPTea: [], Comments: [], VictoryEndLanText: 'a', VictoryEnd2LanText: String.raw`瓦铫煮春雪\n淡香生古瓷`, FailEnd: 'b' },
  },
  itemMap: { 81009: { nameLanText: '杏皮茶', DescriptionLanText: '西北特色饮品' } },
  teaLang: { highteaLan_hightea_comment1Lan_V0053: '冰的杏皮茶解腻' },
};

test('tea: topics, openers with their follow-ups, favourite teas with comments, endings, shared terms', () => {
  const out = normalizeProfileSources(teaRaw, ['V0053']);
  const [p] = out.profiles;
  assert.deepEqual(p.structure.tea, {
    teas: ['81009'],
    topics: [{ id: 'V0053101', trend: 1 }, { id: 'V0053201', trend: 2 }],
    branches: [{ id: 'V0053301', next: [{ id: 'V0053303', trend: 1 }, { id: 'V0053304', trend: 2 }] }],
  });
  const tea = Object.fromEntries(p.units.filter((u) => u.unitKey.startsWith('tea.')).map((u) => [u.unitKey, u.sourceCn]));
  assert.deepEqual(tea, {
    'tea.V0053101.ask': '夜市', 'tea.V0053101.reply': 'player，来吧',
    'tea.V0053201.ask': '演唱会', 'tea.V0053201.reply': '（茶室里一时无人回应。）',
    'tea.V0053301.ask': '酒馆', 'tea.V0053301.reply': '你猜？',
    'tea.V0053303.ask': '随心', 'tea.V0053303.reply': '不错',
    'tea.V0053304.ask': '真样', 'tea.V0053304.reply': '虚妄',
    'tea.comment.1': '冰的杏皮茶解腻', 'tea.win': '好茶', 'tea.lose': '下次',
  });
  assert.equal(p.units.find((u) => u.unitKey === 'tea.comment.1').sourceRef, 'lang:highteaLan_hightea_comment1Lan_V0053');
  const term = (code) => out.terms.find((t) => t.code === code);
  assert.deepEqual([term('81009').kind, term('81009').nameCn, term('81009').detailCn], ['tea', '杏皮茶', '西北特色饮品']);
  assert.deepEqual(['TEA_STAGE_1', 'TEA_STAGE_2', 'TEA_STAGE_3'].map((c) => [term(c).kind, term(c).nameCn]), [['tea_text', '缘起'], ['tea_text', '相知'], ['tea_text', '契合']]);
  assert.equal(term('TEA_RESULT').nameCn, '瓦铫煮春雪\n淡香生古瓷'); // the game's literal "\n" becomes a line break
  assert.deepEqual(out.teaOdd, ['V0053']); // 2 topics, 1 opener: not the usual 8 / 2 / 2
  assert.deepEqual(out.teaOwnResult, []);
});

test('tea: topics without a highteaCharacterMap row import alone; a different result poem becomes tea.result', () => {
  const r = structuredClone(teaRaw);
  delete r.highteaCharacterMap.V0053;
  let [p] = normalizeProfileSources(r, ['V0053']).profiles;
  assert.deepEqual(p.structure.tea.teas, []);
  assert.equal(p.units.some((u) => ['tea.win', 'tea.lose', 'tea.comment.1'].includes(u.unitKey)), false);

  const own = structuredClone(teaRaw);
  own.highteaCharacterMap.V0053.VictoryEnd2LanText = '别的诗';
  own.highteaCharacterMap.B0001 = { ...own.highteaCharacterMap.A0001 }; // the shared poem stays the most common one
  const out = normalizeProfileSources(own, ['V0053']);
  [p] = out.profiles;
  assert.equal(p.units.find((u) => u.unitKey === 'tea.result').sourceCn, '别的诗');
  assert.deepEqual(out.teaOwnResult, ['V0053']);
});

test('tea: no tea data keeps the profile structure (and its hash) unchanged', () => {
  const plain = normalizeProfileSources(raw, ['V0053']).profiles[0];
  const withEmptyTea = normalizeProfileSources({ ...raw, playerAskMap: {}, highteaCharacterMap: {}, itemMap: {}, teaLang: {} }, ['V0053']).profiles[0];
  assert.equal(withEmptyTea.structure.tea, undefined);
  assert.equal(withEmptyTea.sourceHash, plain.sourceHash);
});

test('tea: a broken TopicNext, a missing tea item or a missing comment text aborts with the culprit named', () => {
  const broken = structuredClone(teaRaw);
  broken.playerAskMap.V0053301.TopicNext = ['V0053399'];
  assert.throws(() => normalizeProfileSources(broken, ['V0053']), /V0053399.*V0053301/);
  const noItem = structuredClone(teaRaw);
  noItem.itemMap = {};
  assert.throws(() => normalizeProfileSources(noItem, ['V0053']), /81009.*V0053/);
  const noLang = structuredClone(teaRaw);
  noLang.teaLang = {};
  assert.throws(() => normalizeProfileSources(noLang, ['V0053']), /comment1Lan_V0053/);
});
