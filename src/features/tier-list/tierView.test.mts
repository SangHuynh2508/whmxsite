import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeTitle, badges, chipCount, countMatches, emptyFilter, filterTiers, fmtDate, groupTiers, matchEntry, paragraphs, pickList, presentRarities, tileProps, visibleTabs, type PublishedList, type SiteChar, type Tier, type TierListDoc } from './tierView.mts';

const chars: Record<string, SiteChar> = {
  A0184: { id: 'A0184', slug: 'thac-kim-bac-son-lu', name_vi: 'Thác Kim Bác Sơn Lư', name_cn: '错金博山炉', rare: 4, job: 3, icon: 'assets/avatars/A0184.png' },
  W0182: { id: 'W0182', slug: 'ly-tieu-hai', name_vi: 'Lý Tiểu Hài Hạng Liên', name_cn: '李小孩项链', rare: 4, job: 4 },
  D0017: { id: 'D0017', slug: 'dong-ban', name_vi: '', name_cn: '铜版', rare: 2, job: 1 },
};
const tier = (label: string, ids: string[], description = '', joinAbove = false): Tier => ({ label, description, joinAbove, entries: ids.map((characterId) => ({ characterId })) });
const tiers = [tier('S+', ['A0184', 'GONE'], 'Top'), tier('S', ['W0182'], '', true), tier('A', ['D0017'], 'Good')];
const f = (patch = {}) => ({ ...emptyFilter(), ...patch });

test('groups: a joinAbove tier sits under the description above', () => {
  assert.deepEqual(groupTiers(tiers).map((g) => [g.description, g.tiers.map((t) => t.label)]), [['Top', ['S+', 'S']], ['Good', ['A']]]);
});

test('search: accent-insensitive VI, Chinese, trimmed; missing characters never match', () => {
  assert.ok(matchEntry({ characterId: 'A0184' }, chars, f({ q: '  THÁC kim ' })));
  assert.ok(matchEntry({ characterId: 'A0184' }, chars, f({ q: '博山' })));
  assert.ok(matchEntry({ characterId: 'D0017' }, chars, f({ q: 'dong' })) === false); // untranslated: only its CN matches
  assert.ok(matchEntry({ characterId: 'D0017' }, chars, f({ q: '铜' })));
  assert.equal(matchEntry({ characterId: 'GONE' }, chars, f()), false);
});

test('filters: AND between job and rarity, empty rows and groups dropped, counts', () => {
  const out = filterTiers(tiers, chars, f({ jobs: new Set([3, 4]) }));
  assert.deepEqual(out.map((g) => g.rows.map((r) => [r.tier.label, r.entries.map((e) => e.characterId)])), [[['S+', ['A0184']], ['S', ['W0182']]]]);
  assert.equal(countMatches(tiers, chars, f()), 3); // GONE is not counted
  assert.equal(chipCount(tiers, chars, f({ rarities: new Set([2]) }), 'jobs', 1), 1);
  assert.equal(chipCount(tiers, chars, f({ rarities: new Set([2]) }), 'jobs', 3), 0);
  assert.deepEqual(presentRarities(tiers, chars), [4, 2]);
});

test('tabs only with content', () => {
  const doc = { info: '  ', solo: { note: '', tiers }, teams: { note: '', groups: [] } } as unknown as TierListDoc;
  assert.deepEqual(visibleTabs(doc), ['characters']);
  assert.deepEqual(visibleTabs({ ...doc, info: 'x', teams: { note: '', groups: [{ name: 'T', note: '', members: [{ characterId: 'A0184' }] }] } }), ['characters', 'teams', 'info']);
});

test('info text: blank line = paragraph, "- " lines = bullets', () => {
  assert.deepEqual(paragraphs('Một\nhai\n\n- a\n- b\n\n'), [{ kind: 'p', lines: ['Một', 'hai'] }, { kind: 'ul', items: ['a', 'b'] }]);
  assert.deepEqual(paragraphs(''), []);
});

test('badges and tile', () => {
  assert.deepEqual(badges({ characterId: 'A0184', zhizhi: 3, hc: true }), ['Z3', 'HC']);
  assert.equal(badgeTitle({ characterId: 'A0184', zhizhi: 3, hc: true }), 'Trí Tri 3 · cần Hoán Chương');
  const t = tileProps({ characterId: 'D0017', zhizhi: 1 }, chars.D0017);
  assert.equal(t.name, '铜版');
  assert.equal(t.untranslated, true);
  assert.equal(t.href, '#/characters/dong-ban/build');
  assert.equal(t.label, '铜版 (chưa dịch) (Z1) · Túc Vệ · R');
  assert.equal(tileProps({ characterId: 'A0184' }, chars.A0184).avatar, '/assets/characters/avatars/A0184.png');
});

test('pickList: one list, index, none, missing; old documents without tierLists', () => {
  const l = (slug: string, status: 'published' | 'archived'): PublishedList => ({ slug, status, updatedAt: '2026-10-02T00:00:00Z', doc: {} as TierListDoc });
  assert.deepEqual(pickList(undefined, ''), { kind: 'none' });
  assert.deepEqual(pickList([], ''), { kind: 'none' });
  assert.deepEqual(pickList([l('a', 'published')], ''), { kind: 'list', list: l('a', 'published') });
  assert.equal(pickList([l('a', 'published'), l('b', 'archived')], '').kind, 'index');
  assert.equal(pickList([l('a', 'published')], 'b').kind, 'missing');
  assert.equal(pickList([l('a', 'published'), l('b', 'archived')], 'b').kind, 'list');
  assert.equal(fmtDate('2026-10-02T10:00:00Z'), '02/10/2026');
});
