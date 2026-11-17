import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultState, families, filterItems, loadGallery, origUrl, readState, stateUrl, subs, thumbUrl, tiles, title, viewUrl,
  type GalleryDoc, type GalleryItem, type GalleryState,
} from './galleryData.mts';

const it = (o: Partial<GalleryItem>): GalleryItem => ({ id: 'x', kind: 'story', file: 'gallery/story/x', w: 1680, h: 720,
  name_cn: '', name_vi: '', note_cn: '', note_vi: '', place_cn: '', place_vi: '', group: '', sub_cn: '', sub_vi: '',
  story_cn: '', story_vi: '', ...o });
const a = it({ id: 'cg_a', group: 'v3', sub_cn: '3.4上', story_cn: '镂忆琢名', story_vi: 'Lũ Ức Trác Danh' });
const b = it({ id: 'cg_b', group: 'v3', sub_cn: '3.5下', story_cn: '协韵行歌' });
const c = it({ id: 'cg_c', group: 'main', sub_cn: '来古', sub_vi: 'Lai Cổ' });
const a2 = it({ id: 'cg_a2', group: 'v3', sub_cn: '3.4上', story_cn: '镂忆琢名' });
const kv = it({ id: '2502', kind: 'kv', file: 'gallery/kv/2502', name_cn: '2.5下' });
const ld = it({ id: 'CG61001', kind: 'loading', file: 'gallery/loading/CG61001', name_cn: '静谧小院', name_vi: 'Tĩnh Mịch Tiểu Viện',
  note_cn: '不开启', note_vi: 'Không mở thu thập' });
const doc: GalleryDoc = { version: 'r3173', asset_base_url: 'https://r2.example/', items: [a, b, c, a2, kv, ld],
  variants: [['story', ['cg_a', 'cg_a2']]] };
const st = (o: Partial<GalleryState>): GalleryState => ({ kind: 'story', g: '', v: '', q: '', id: '', ...o });

test('versions newest first; other groups keep data order', () => {
  assert.deepEqual(subs(doc, 'v3'), ['3.5下', '3.4上']);
  assert.deepEqual(subs(doc, 'main'), ['来古']);
});

test('default: story tab on its newest version', () => {
  assert.deepEqual(defaultState(doc), st({ g: 'v3', v: '3.5下' }));
  assert.deepEqual(readState(doc, ''), defaultState(doc));
  assert.deepEqual(defaultState(doc, 'kv'), st({ kind: 'kv' }));
});

test('query round trip; unknown values fall back without a blank page', () => {
  const x = st({ g: 'v3', v: '3.4上', q: 'mưa & gió', id: 'cg_a' });
  assert.deepEqual(readState(doc, stateUrl(x)), x);
  assert.deepEqual(readState(doc, '#/gallery?kind=nope&g=zz&v=9.9&id=missing'), defaultState(doc));
  assert.deepEqual(readState(doc, '?kind=kv&g=v3&v=3.4上'), st({ kind: 'kv' }));
  assert.deepEqual(readState(doc, '?kind=story&g=v3'), st({ g: 'v3' })); // a group alone shows all of it
  assert.equal(stateUrl(st({ kind: 'kv' })), '/gallery?kind=kv');
});

test('a shared link to one image opens it even without its group / version', () => {
  assert.deepEqual(readState(doc, '?kind=story&id=cg_c'), st({ g: 'main', v: '来古', id: 'cg_c' }));
  assert.equal(readState(doc, '?kind=kv&id=cg_c').id, ''); // an id of another kind is ignored
});

test('filter: kind, group, version; a search spans the whole kind and folds Vietnamese marks', () => {
  assert.deepEqual(filterItems(doc, st({ g: 'v3' })).map((x) => x.id), ['cg_b', 'cg_a', 'cg_a2']);
  assert.deepEqual(filterItems(doc, st({ g: 'v3', v: '3.4上' })).map((x) => x.id), ['cg_a', 'cg_a2']);
  assert.deepEqual(filterItems(doc, st({ g: 'v3', v: '3.5下', q: 'lai co' })).map((x) => x.id), ['cg_c']);
  assert.deepEqual(filterItems(doc, st({ kind: 'loading', q: 'TĨNH MỊCH' })).map((x) => x.id), ['CG61001']);
  assert.deepEqual(filterItems(doc, st({ q: '3.4 thuong' })).map((x) => x.id), ['cg_a', 'cg_a2']);
});

test('near-identical images are one tile; the first kept member stands for it', () => {
  const fam = families(doc);
  const t = tiles(filterItems(doc, st({ g: 'v3', v: '3.4上' })), fam);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].f.map((x) => x.id), ['cg_a', 'cg_a2']);
  assert.equal(tiles([a2], fam)[0].it.id, 'cg_a2');
  assert.equal(families({ ...doc, variants: undefined }).size, 0); // before the owner's review: one tile per image
});

test('titles: own name, place, the story it opens in, version; a KV version label is not "untranslated"', () => {
  assert.deepEqual(title(ld, 'vi'), { text: 'Tĩnh Mịch Tiểu Viện', zh: false });
  assert.deepEqual(title(ld, 'cn'), { text: '静谧小院', zh: false });
  assert.deepEqual(title(a, 'vi'), { text: 'Lũ Ức Trác Danh', zh: false });
  assert.deepEqual(title(b, 'vi'), { text: '协韵行歌', zh: true });
  assert.deepEqual(title(c, 'vi'), { text: 'Lai Cổ', zh: false });
  assert.deepEqual(title(kv, 'vi'), { text: 'KV 2.5 Hạ', zh: false });
  assert.deepEqual(title(kv, 'cn'), { text: 'KV 2.5下', zh: false });
  assert.deepEqual(title(it({ id: 'cg_z', group: 'v3', sub_cn: '3.4上' }), 'vi'), { text: 'Bản 3.4 Thượng', zh: false });
  assert.deepEqual(title(it({ id: '18.2', kind: 'kv' }), 'vi'), { text: 'KV 18.2', zh: false });
});

test('image urls: thumb, view, original under the item file', () => {
  assert.equal(thumbUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/t.webp');
  assert.equal(viewUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/v.webp');
  assert.equal(origUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/o.png');
});

test('load returns null on a bad document or a failed fetch', async () => {
  assert.equal(await loadGallery(async () => new Response('{}')), null);
  assert.equal(await loadGallery(async () => { throw new Error('offline'); }), null);
  assert.equal((await loadGallery(async () => new Response(JSON.stringify(doc))))?.items.length, 6);
});
