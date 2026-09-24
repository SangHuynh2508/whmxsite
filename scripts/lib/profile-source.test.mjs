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
