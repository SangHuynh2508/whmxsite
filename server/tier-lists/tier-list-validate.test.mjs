import assert from 'node:assert/strict';
import test from 'node:test';

import { SLUG, defaultTierListDoc, tierListContext, validateTierList } from './tier-list-validate.mjs';

const ctx = tierListContext({ A0170: { has_huanzhang: true }, W0182: { has_huanzhang: false }, D0017: {}, ...Object.fromEntries(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map((id) => [id, {}])) });
const doc = (patch = {}) => ({ ...defaultTierListDoc('Tier List'), ...patch });
const codes = (r) => r.errors.map((e) => `${e.path} ${e.code}`);

test('the default document is valid and has the S+ … X tiers', () => {
  const r = validateTierList(defaultTierListDoc('Tier List'), ctx);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.doc.solo.tiers.map((t) => t.label), ['S+', 'S', 'A', 'B', 'C', 'D', 'X']);
  assert.equal(r.doc.solo.tiers.at(-1).description, 'Chưa thử');
});

test('entries keep zhizhi 1–6 and hc only for a character with Hoán Chương', () => {
  const tiers = [{ label: 'S', description: '', joinAbove: false, entries: [
    { characterId: 'A0170', zhizhi: 3, hc: true }, { characterId: 'W0182', hc: true }, { characterId: 'D0017', zhizhi: 7 }, { characterId: 'X9999' },
  ] }];
  const r = validateTierList(doc({ solo: { note: '', tiers } }), ctx);
  assert.deepEqual(r.doc.solo.tiers[0].entries[0], { characterId: 'A0170', zhizhi: 3, hc: true });
  assert.deepEqual(codes(r), ['solo.tiers.0.entries.1.hc NO_HUANZHANG', 'solo.tiers.0.entries.2.zhizhi BAD_ZHIZHI', 'solo.tiers.0.entries.3.characterId UNKNOWN_CHARACTER']);
});

test('the same character twice in Nhân vật needs different badges', () => {
  const tiers = [
    { label: 'S+', description: '', joinAbove: false, entries: [{ characterId: 'A0170', zhizhi: 3, hc: true }] },
    { label: 'A', description: '', joinAbove: false, entries: [{ characterId: 'A0170' }, { characterId: 'A0170', zhizhi: 3, hc: true }] },
  ];
  assert.deepEqual(codes(validateTierList(doc({ solo: { note: '', tiers } }), ctx)), ['solo.tiers.1.entries.1 DUPLICATE_ENTRY']);
});

test('joinAbove: never on the first tier, and a joined tier keeps no description', () => {
  const tiers = [
    { label: 'S+', description: 'Top', joinAbove: true, entries: [] },
    { label: 'S', description: 'ignored', joinAbove: true, entries: [] },
  ];
  const r = validateTierList(doc({ solo: { note: '', tiers } }), ctx);
  assert.deepEqual(r.doc.solo.tiers.map((t) => [t.joinAbove, t.description]), [[false, 'Top'], [true, '']]);
});

test('limits: title, url, labels, tier count, team size and duplicates in a team', () => {
  const groups = [
    { name: '', note: '', members: [] },
    { name: 'Bảy', note: '', members: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map((characterId) => ({ characterId })) },
    { name: 'Trùng', note: '', members: [{ characterId: 'C1' }, { characterId: 'C1' }] },
  ];
  const r = validateTierList(doc({ title: ' ', sourceUrl: 'javascript:alert(1)', solo: { note: '', tiers: [] }, teams: { note: '', groups } }), ctx);
  assert.deepEqual(codes(r), [
    'title REQUIRED', 'sourceUrl BAD_URL', 'solo.tiers TOO_FEW', 'teams.groups.0.name REQUIRED', 'teams.groups.0.members TOO_FEW',
    'teams.groups.1.members TOO_MANY', 'teams.groups.2.members.1 DUPLICATE_MEMBER',
  ]);
  assert.deepEqual(codes(validateTierList(doc({ solo: { note: '', tiers: [{ label: 'TOOLONG', entries: [] }] } }), ctx)), ['solo.tiers.0.label TOO_LONG']);
});

test('text is trimmed, unknown fields dropped, non-objects rejected', () => {
  const r = validateTierList({ ...doc({ title: '  Tier  ' }), extra: 1 }, ctx);
  assert.equal(r.doc.title, 'Tier');
  assert.equal('extra' in r.doc, false);
  assert.deepEqual(validateTierList(null, ctx), { doc: null, errors: [{ path: '', code: 'BAD_SHAPE' }] });
});

test('slug format', () => {
  for (const ok of ['tong-hop', 'a1', 'pvp-2026']) assert.ok(SLUG.test(ok), ok);
  for (const bad of ['Tong-hop', 'a--b', '-a', 'a-', 'tổng', '']) assert.ok(!SLUG.test(bad), bad);
});
