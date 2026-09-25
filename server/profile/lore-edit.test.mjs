// server/profile/lore-edit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveImagesFor, cleanVi, loreProgress, planLoreTextEdit, planTermEdit, previousCnByUnit, shapeLoreRecord, termUsage } from './lore-edit.mjs';

const unit = (unitKey, vi = null, viOrigin = null, state = 'ok') => ({ id: `id-${unitKey}`, unitKey, vi, viOrigin, state });

test('keeps inner line breaks; trims ends; CRLF becomes LF; empty is null', () => {
  assert.equal(cleanVi('  a\r\n\r\nb  '), 'a\n\nb');
  assert.equal(cleanVi('   '), null);
  assert.equal(cleanVi(null), null);
});

test('an unknown unit key is rejected, nothing is written', () => {
  assert.deepEqual(planLoreTextEdit([unit('card_intro')], { nope: 'x' }), { error: 'UNKNOWN_UNIT', unknown: ['nope'] });
});

test('new text becomes an official admin translation', () => {
  const { writes } = planLoreTextEdit([unit('card_intro')], { card_intro: ' Xin chào ' });
  assert.deepEqual(writes, [{ id: 'id-card_intro', unitKey: 'card_intro', before: { vi: null, viOrigin: null, state: 'ok' }, after: { vi: 'Xin chào', viOrigin: 'admin', state: 'ok' } }]);
});

test('same text makes a legacy or changed unit official; an official unit with the same text is skipped', () => {
  const units = [unit('a', 'x', 'legacy_workbook'), unit('b', 'y', 'admin', 'source_changed'), unit('c', 'z', 'admin')];
  const { writes } = planLoreTextEdit(units, { a: 'x', b: 'y', c: 'z' });
  assert.deepEqual(writes.map((w) => [w.unitKey, w.after.viOrigin, w.after.state]), [['a', 'admin', 'ok'], ['b', 'admin', 'ok']]);
});

test('empty text clears vi and origin (back to "chưa dịch")', () => {
  const { writes } = planLoreTextEdit([unit('a', 'x', 'admin')], { a: '' });
  assert.deepEqual(writes[0].after, { vi: null, viOrigin: null, state: 'ok' });
  assert.deepEqual(planLoreTextEdit([unit('a')], { a: null }).writes, []);
});

test('term edit: both empty clears the origin; same official values are skipped', () => {
  const term = { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' };
  assert.deepEqual(planTermEdit(term, { nameVi: ' Thanh ', detailVi: '' }).write.after, { nameVi: 'Thanh', detailVi: null, viOrigin: 'admin', state: 'ok' });
  const official = { nameVi: 'Thanh', detailVi: null, viOrigin: 'admin', state: 'ok' };
  assert.equal(planTermEdit(official, { nameVi: 'Thanh', detailVi: null }).write, null);
  assert.deepEqual(planTermEdit(official, { nameVi: '', detailVi: '' }).write.after, { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' });
});

test('progress counts done, legacy and CN-changed per character', () => {
  const rows = [
    { characterId: 'A1', vi: 'x', viOrigin: 'admin', state: 'ok' },
    { characterId: 'A1', vi: 'y', viOrigin: 'legacy_workbook', state: 'ok' },
    { characterId: 'A1', vi: 'z', viOrigin: 'admin', state: 'source_changed' },
    { characterId: 'A1', vi: null, viOrigin: null, state: 'ok' },
  ];
  assert.deepEqual(loreProgress(rows), { A1: { total: 4, done: 1, legacy: 1, changed: 1 } });
});

test('term usage covers organisation, relic codes and affinity levels', () => {
  const p = { characterId: 'A1', organisationCode: '3', relicTypeCode: 'K1', eraCode: 'T2', museumCode: null, eraRangeCode: null,
    structure: { reports: [{ kind: 'basic', unlock: { type: 2, elementId: '4' } }, { kind: 'special', unlock: { type: 3, elementId: '9' } }] } };
  assert.deepEqual(termUsage([p, { ...p, characterId: 'A2', relicTypeCode: null }]), {
    ORG_3: ['A1', 'A2'], K1: ['A1'], T2: ['A1', 'A2'], AFFINITY_4: ['A1', 'A2'],
  });
});

test('previous CN comes from the newest source import of that unit', () => {
  const h = [
    { fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: 'new-old' }, editedAt: '2026-09-25T10:00:00Z' },
    { fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: 'old-old' }, editedAt: '2026-09-20T10:00:00Z' },
    { fieldName: 'card_intro', eventType: 'human_edit', oldValue: { vi: 'x' }, editedAt: '2026-09-26T10:00:00Z' },
  ];
  assert.deepEqual(previousCnByUnit(h), { card_intro: 'new-old' });
});

test('archive images come from the publish manifest, main image first', () => {
  const manifest = { public_base_url: 'https://cdn.example', assets: {
    'characters/a0001/archives/head_a0001.webp': { key: 'characters/a0001/archives/head_a0001.webp', character_id: 'A0001', category: 'archive', width: 128, height: 124 },
    'characters/a0001/archives/a0001.webp': { key: 'characters/a0001/archives/a0001.webp', character_id: 'A0001', category: 'archive', width: 505, height: 481 },
    'characters/a0001/cards/a0001.webp': { key: 'characters/a0001/cards/a0001.webp', character_id: 'A0001', category: 'card', width: 1, height: 1 },
  } };
  assert.deepEqual(archiveImagesFor(manifest, 'A0001'), [
    { url: 'https://cdn.example/characters/a0001/archives/a0001.webp', width: 505, height: 481 },
    { url: 'https://cdn.example/characters/a0001/archives/head_a0001.webp', width: 128, height: 124 },
  ]);
});

test('the lore record lists present units with previous CN only for changed ones, and resolves terms', () => {
  const terms = new Map([['K1', { code: 'K1', kind: 'relic_type', nameCn: '金银器', nameVi: null, viOrigin: null, state: 'ok' }]]);
  const profile = { organisationCode: null, relicTypeCode: 'K1', eraCode: null, museumCode: null, eraRangeCode: null,
    legacyRelicFields: { hasEntry: true }, structure: { reports: [], timeline: [] } };
  const texts = [
    { unitKey: 'card_intro', sourceCn: '新', vi: 'x', viOrigin: 'admin', state: 'source_changed', sourcePresent: true },
    { unitKey: 'relic_intro', sourceCn: '甲', vi: null, viOrigin: null, state: 'ok', sourcePresent: true },
    { unitKey: 'gone', sourceCn: '乙', vi: null, viOrigin: null, state: 'ok', sourcePresent: false },
  ];
  const history = [{ fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: '旧' }, editedAt: '2026-09-25T00:00:00Z' }];
  const r = shapeLoreRecord({ characterId: 'A1', revision: 3, profile, texts, terms, history, archiveImages: [] });
  assert.deepEqual(r.units.map((u) => [u.unitKey, u.previousCn]), [['card_intro', '旧'], ['relic_intro', null]]);
  assert.deepEqual(r.relic.type, { code: 'K1', kind: 'relic_type', nameCn: '金银器', nameVi: null, official: false });
  assert.equal(r.relic.era, null);
  assert.equal(r.revision, 3);
});
