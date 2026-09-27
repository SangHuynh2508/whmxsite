import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionaryHref, isDone, legacyTermsHref, parseDictionaryRoute, progress, tabOfGameKind } from './dictionary.mts';

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
