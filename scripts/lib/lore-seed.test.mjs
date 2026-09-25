// scripts/lib/lore-seed.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_TITLE_VI, planOrgSeed, planTitleSeed } from './lore-seed.mjs';

const t = (characterId, unitKey, sourceCn, vi = null, viOrigin = null, state = 'ok') => ({ characterId, unitKey, sourceCn, vi, viOrigin, state });

test('report titles: exact CN only; official admin text is never overwritten; legacy is listed as replaced', () => {
  const rows = [
    t('A1', 'report.f1.title', '观察报告1'),
    t('A1', 'report.f2.title', '观察报告2', 'Cũ', 'legacy_workbook'),
    t('A1', 'report.f3.title', '观察报告3', 'Của người dịch', 'admin'),
    t('A1', 'report.f4.title', '观察报告4', 'Báo cáo quan sát 4', 'admin'),
    t('A1', 'report.s1.title', '加密报告A'),
    t('A1', 'report.f5.title', '特别报告'),
    t('A1', 'report.f1.content', '观察报告1'),
  ];
  const plan = planTitleSeed(rows);
  assert.deepEqual(plan.writes, [
    { characterId: 'A1', unitKey: 'report.f1.title', vi: 'Báo cáo quan sát 1' },
    { characterId: 'A1', unitKey: 'report.f2.title', vi: 'Báo cáo quan sát 2' },
    { characterId: 'A1', unitKey: 'report.s1.title', vi: 'Báo cáo mật A' },
  ]);
  assert.deepEqual(plan.replacedLegacy.map((r) => r.unitKey), ['report.f2.title']);
  assert.deepEqual(plan.keptAdmin.map((r) => r.unitKey), ['report.f3.title']);
  assert.deepEqual(plan.unknownCn.map((r) => r.sourceCn), ['特别报告']);
  assert.equal(REPORT_TITLE_VI['加密报告A'], 'Báo cáo mật A');
});

test('organisations: ORG_* terms get the current VI names; official ones and unmapped CN are reported', () => {
  const terms = [
    { code: 'ORG_1', nameCn: '资料部', nameVi: null, viOrigin: null, state: 'ok' },
    { code: 'ORG_2', nameCn: '技术部', nameVi: 'Bộ Kỹ Thuật', viOrigin: 'admin', state: 'ok' },
    { code: 'ORG_9', nameCn: '未知', nameVi: null, viOrigin: null, state: 'ok' },
    { code: 'K1', nameCn: '金银器', nameVi: null, viOrigin: null, state: 'ok' },
  ];
  const plan = planOrgSeed(terms, { 资料部: 'Bộ Tư Liệu', 技术部: 'Bộ Kỹ Thuật' });
  assert.deepEqual(plan.writes, [{ code: 'ORG_1', nameVi: 'Bộ Tư Liệu' }]);
  assert.deepEqual(plan.alreadyOfficial, ['ORG_2']);
  assert.deepEqual(plan.unmapped, ['ORG_9']);
});
