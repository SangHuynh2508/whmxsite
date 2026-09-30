import assert from 'node:assert/strict';
import test from 'node:test';

import { archive, artUrl, currentBanners, currentEvents, loadBanners, skinImage, sliceMeta, upCharacters, type Banner, type BannersDoc } from './bannersData.mts';

const b = (id: string, start: number, end: number, extra: Partial<Banner> = {}): Banner =>
  ({ id, name_cn: id, name_vi: null, type: 'time', kind_cn: '限时渠道', start, end, up: ['A0001'], up_skin: null, art: null, title: null, choice: null, ...extra });
const doc = (banners: Banner[]): BannersDoc =>
  ({ generated_at: 0, masterdata: '', asset_base_url: 'https://r2', version: null, hero: null, events: [], banners });
const S = 1000;

test('currentBanners: the latest batch; season and no-UP banners go last', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' }), b('340001', 100, 2000, { type: 'season' }),
    b('5003', 100, 900, { up: [] })]);
  assert.deepEqual(currentBanners(d, 150 * S).map((x) => x.id), ['2114', '340001', '5003']);
});

test('currentBanners keeps an ended batch and marks it ended (site data older than the game)', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' })]);
  assert.deepEqual(currentBanners(d, 950 * S).map((x) => x.id), ['2114']);
});

test('currentBanners ignores banners that have not started', () => {
  const d = doc([b('now', 100, 900), b('later', 500, 900)]);
  assert.deepEqual(currentBanners(d, 150 * S).map((x) => x.id), ['now']);
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

test('skinImage: the UP skin drawing from data.json, else null', () => {
  const chars = { A0001: { skins: [{ skinID: 'A0001001', image: 'https://r2/a.webp' }] } };
  assert.equal(skinImage(b('x', 0, 1, { up_skin: 'A0001001' }), chars), 'https://r2/a.webp');
  assert.equal(skinImage(b('x', 0, 1, { up_skin: 'A0001009' }), chars), null);
  assert.equal(skinImage(b('x', 0, 1, { up: ['W0185'], up_skin: 'W0185001' }), chars), null);
  assert.equal(skinImage(b('x', 0, 1), chars), null);
});

test('sliceMeta: type + time left, choice banners, ended current batch, archive dates', () => {
  const end = 1000;
  assert.deepEqual(sliceMeta(b('x', 0, end, { type: 'limited' }), (end - 3600 - 120) * S, false), { label: 'Giới hạn', left: '1 giờ 2 phút' });
  assert.deepEqual(sliceMeta(b('x', 0, end, { type: 'time', up: [], choice: 59 }), 0, false), { label: 'Tự chọn trong 59 Khí Giả', left: '16 phút' });
  assert.deepEqual(sliceMeta(b('x', 0, end), (end + 1) * S, false), { label: 'Đã kết thúc · chờ bản cập nhật', left: null });
  const s = Date.UTC(2026, 8, 10) / 1000, e = Date.UTC(2026, 8, 30) / 1000;
  assert.deepEqual(sliceMeta(b('x', s, e, { type: 'season' }), 0, true, 'UTC'), { label: 'Theo mùa · 10/09/2026 – 30/09/2026', left: null });
  assert.deepEqual(sliceMeta(b('x', s, e, { type: 'oldtime' }), 0, true, 'UTC').label, 'Thường trực · 10/09/2026 – 30/09/2026');
  assert.equal(sliceMeta(b('x', s, e, { type: 'new', kind_cn: '新渠道' }), 0, true, 'UTC').label, '新渠道 · 10/09/2026 – 30/09/2026');
});
