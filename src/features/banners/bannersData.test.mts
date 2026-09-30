import assert from 'node:assert/strict';
import test from 'node:test';

import { archive, artUrl, currentBanners, currentEvents, loadBanners, upCharacters, type Banner, type BannersDoc } from './bannersData.mts';

const b = (id: string, start: number, end: number, extra: Partial<Banner> = {}): Banner =>
  ({ id, name_cn: id, name_vi: null, type: 'time', kind_cn: '限时渠道', start, end, up: ['A0001'], up_skin: null, art: null, ...extra });
const doc = (banners: Banner[]): BannersDoc =>
  ({ generated_at: 0, masterdata: '', asset_base_url: 'https://r2', version: null, hero: null, events: [], banners });
const S = 1000;

test('currentBanners: the latest batch; season and no-UP banners go compact', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' }), b('340001', 100, 2000, { type: 'season' }),
    b('5003', 100, 900, { up: [] })]);
  const { featured, compact } = currentBanners(d, 150 * S);
  assert.deepEqual(featured.map((x) => x.id), ['2114']);
  assert.deepEqual(compact.map((x) => x.id), ['340001', '5003']);
});

test('currentBanners keeps an ended batch and marks it ended (site data older than the game)', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' })]);
  assert.deepEqual(currentBanners(d, 950 * S).featured.map((x) => x.id), ['2114']);
});

test('currentBanners ignores banners that have not started', () => {
  const d = doc([b('now', 100, 900), b('later', 500, 900)]);
  assert.deepEqual(currentBanners(d, 150 * S).featured.map((x) => x.id), ['now']);
});

test('currentEvents: only active events', () => {
  const d = { ...doc([]), events: [{ id: 1, name_cn: 'a', kind_cn: '', start: 100, end: 900 }, { id: 2, name_cn: 'b', kind_cn: '', start: 500, end: 900 }] };
  assert.deepEqual(currentEvents(d, 150 * S).map((e) => e.id), [1]);
});

test('archive: grouped by year of start (local), newest first, filters combine', () => {
  const y2025 = Date.UTC(2025, 5, 1) / 1000, y2026 = Date.UTC(2026, 5, 1) / 1000;
  const d = doc([b('a', y2026, y2026 + 10, { up: ['A0184'], type: 'limited' }), b('b', y2025, y2025 + 10), b('c', y2026 - 10, y2026)]);
  assert.deepEqual(archive(d, {}, 'UTC').map((g) => [g.year, g.banners.map((x) => x.id)]), [[2026, ['a', 'c']], [2025, ['b']]]);
  assert.deepEqual(archive(d, { character: 'A0184' }, 'UTC').map((g) => g.banners.map((x) => x.id)), [['a']]);
  assert.deepEqual(archive(d, { type: 'time', year: 2026 }, 'UTC').map((g) => g.banners.map((x) => x.id)), [['c']]);
});

test('upCharacters skips ids missing from data.json', () => {
  assert.deepEqual(upCharacters(b('x', 0, 1, { up: ['A0001', 'W0185'] }), { A0001: { slug: 'a' } }), [{ id: 'A0001', char: { slug: 'a' } }]);
});

test('artUrl joins the R2 base; null stays null', () => {
  const d = doc([]);
  assert.equal(artUrl(d, 'banners/2114.webp'), 'https://r2/banners/2114.webp');
  assert.equal(artUrl(d, null), null);
});

test('loadBanners returns null on 404 and on a bad shape', async () => {
  const res = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
  assert.equal(await loadBanners(res(404, {}) as typeof fetch), null);
  assert.equal(await loadBanners(res(200, { banners: 'x' }) as typeof fetch), null);
  assert.equal(await loadBanners((async () => new Response('<html>', { status: 200 })) as typeof fetch), null);
  const ok = await loadBanners(res(200, doc([b('1', 0, 1)])) as typeof fetch);
  assert.equal(ok?.banners.length, 1);
});
