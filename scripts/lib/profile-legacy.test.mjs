// scripts/lib/profile-legacy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLegacyCells } from './profile-legacy.mjs';

const profiles = [{
  characterId: 'A0144',
  structure: { reports: [{ fileId: 'A014401', kind: 'basic' }, { fileId: 'A014402', kind: 'basic' }] },
  units: [
    { unitKey: 'card_intro', sourceCn: '介绍' },
    { unitKey: 'report.A014401.title', sourceCn: '观察报告1' },
    { unitKey: 'report.A014402.content', sourceCn: '内容2' },
    { unitKey: 'relic_intro', sourceCn: '本源' },
  ],
}];
const row = (profile_id, category, text_cn, text_vi) => ({ profile_id, character_id: 'A0144', category, text_cn, text_vi });

test('maps the four text categories and skips status/code rows', () => {
  const out = matchLegacyCells([
    row('A0144_intro', 'card_intro', '介绍', 'Giới thiệu'),
    row('A0144_report_title_1', 'report_title', '观察报告1', 'Báo cáo 1'),
    row('A0144_report_content_2', 'report_content', '内容2-旧', 'Nội dung 2'),
    row('A0144_relic_intro', 'relic_intro', '本源', 'Bản nguyên'),
    row('A0144_staff', 'staff_status', '已登记', 'Đã đăng ký'),
    row('A0144_relic_name', 'relic_name', 'K1028', 'K1028'),
    row('A0144_report_title_3', 'report_title', '观察报告3', 'Báo cáo 3'),
  ], profiles);
  assert.deepEqual(out.seeds, [
    { characterId: 'A0144', unitKey: 'card_intro', vi: 'Giới thiệu', sourceChanged: false },
    { characterId: 'A0144', unitKey: 'report.A014401.title', vi: 'Báo cáo 1', sourceChanged: false },
    { characterId: 'A0144', unitKey: 'report.A014402.content', vi: 'Nội dung 2', sourceChanged: true },
    { characterId: 'A0144', unitKey: 'relic_intro', vi: 'Bản nguyên', sourceChanged: false },
  ]);
  assert.deepEqual(out.ignored.map((i) => i.reason), ['code_map_category', 'raw_code_copy', 'no_matching_unit']);
});
