import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionaryHref, isDone, legacyTermsHref, mergeSameText, outOfStep, parseDictionaryRoute, progress, tabOfGameKind } from './dictionary.mts';

test('Từ điển routes: tab + optional code, weapons by default', () => {
  assert.deepEqual(parseDictionaryRoute('#/admin/dictionary'), { tab: 'weapons' });
  assert.deepEqual(parseDictionaryRoute('#/admin/dictionary/lore/ORG_3'), { tab: 'lore', code: 'ORG_3' });
  assert.deepEqual(parseDictionaryRoute('#/admin/dictionary/weapons/weapon%3A31244'), { tab: 'weapons', code: 'weapon:31244' });
  assert.deepEqual(parseDictionaryRoute('#/admin/dictionary/nope'), { tab: 'weapons' });
  assert.deepEqual(parseDictionaryRoute('#/admin/dictionary/lore/%E0'), { tab: 'weapons' });
  assert.equal(dictionaryHref('deepen', 'job_style:401'), '#/admin/dictionary/deepen/job_style%3A401');
  assert.equal(dictionaryHref('affixes'), '#/admin/dictionary/affixes');
});

test('game text kinds belong to one tab', () => {
  assert.deepEqual(['weapon', 'weapon_skill', 'weapon_affix', 'job_style', 'style_sector', 'style_talent'].map(tabOfGameKind),
    ['weapons', 'weapons', 'affixes', 'deepen', 'deepen', 'deepen']);
});

test('the old terms pages (links in history, bookmarks) open the matching tab', () => {
  assert.equal(legacyTermsHref({ view: 'terms' }), '#/admin/dictionary/lore');
  assert.equal(legacyTermsHref({ view: 'terms', code: 'O7016' }), '#/admin/dictionary/lore/O7016');
  assert.equal(legacyTermsHref({ view: 'gameTerms' }), '#/admin/dictionary/weapons');
  assert.equal(legacyTermsHref({ view: 'gameTerms', code: 'style_talent:W10101' }), '#/admin/dictionary/deepen/style_talent%3AW10101');
});

test('done = what the public page shows in VI: official name, and the description when there is one', () => {
  const t = (patch = {}) => ({ nameCn: '名', nameVi: 'Tên', detailCn: '', detailVi: null, viOrigin: 'admin' as const, state: 'ok' as const, ...patch });
  assert.equal(isDone(t()), true);
  assert.equal(isDone(t({ detailCn: '说明' })), false);
  assert.equal(isDone(t({ detailCn: '说明', detailVi: 'Mô tả' })), true);
  assert.equal(isDone(t({ viOrigin: null })), false);
  assert.equal(isDone(t({ state: 'source_changed' })), false);
  assert.deepEqual(progress([t(), t({ nameVi: null }), t()]), { done: 2, total: 3 });
  // a game row with no Chinese at all (weapon skill EW4034) has nothing to translate
  assert.equal(isDone(t({ nameCn: '', nameVi: null, viOrigin: null })), true);
});

test('same Chinese in one kind → one row (the 深造 columns: 4 names × 15 styles); the row shows a translated twin', () => {
  const t = (kind: string, code: string, nameCn: string, patch = {}) =>
    ({ kind, code, nameCn, detailCn: '', nameVi: null, detailVi: null, viOrigin: null, state: 'ok' as const, ...patch });
  const rows = mergeSameText([
    t('style_sector', 'A1_01', '重峦'), t('style_sector', 'A2_01', '重峦', { nameVi: 'Trùng Loan', viOrigin: 'admin' }),
    t('style_sector', 'A1_02', '源流'), t('style_talent', 'X', '重峦'), t('style_sector', 'D1_01', '重峦'),
  ]);
  assert.deepEqual(rows.map((r) => [r.code, r.twins.map((x) => x.code)]),
    [['A2_01', ['A1_01', 'A2_01', 'D1_01']], ['A1_02', ['A1_02']], ['X', ['X']]]);
  // twins not carrying the row's translation (to offer "Áp dụng cho các mục còn lại")
  assert.deepEqual(outOfStep(rows[0]).map((x) => x.code), ['A1_01', 'D1_01']);
  assert.deepEqual(outOfStep(rows[1]), []);
  // a different description is a different text
  assert.equal(mergeSameText([t('style_talent', 'a', '伤害', { detailCn: '1' }), t('style_talent', 'b', '伤害', { detailCn: '2' })]).length, 2);
});
