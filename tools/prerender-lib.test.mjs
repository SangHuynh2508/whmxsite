import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPages, renderPage, sitemap, robots, escapeHtml, loadTierLists, SITE_ORIGIN, DEFAULT_IMAGE } from './prerender-lib.mjs';

const char = {
  id: 'W0097', slug: 'sach-kells', name_vi: 'Sách Kells', name_cn: '凯尔特之书', rare: 4, job: 4, tags_vi: 'Viễn Chiến; Hỗ Trợ',
  cards: ['https://r2/characters/w0097/cards/w0097001.webp', 'https://r2/characters/w0097/cards/w0097002.webp'],
  skills: [{ levels: [{ name_vi: 'Kỳ Tích', name_cn: '奇迹' }] }, { levels: [{ name_vi: '', name_cn: '圣言' }] }],
  profile: { eval_intro_vi: 'Một bộ sách "quý" & <color=#fff>cổ</color>.', eval_intro: '中文' },
  skins: [{ skinID: 'W0097001', is_base: true, name_vi: 'Tạo Hình', name_cn: '肖形' },
          { skinID: 'W0097002', is_base: false, name_vi: '', name_cn: '写照', obtain_vi: '', obtain_cn: '通过器者考核解锁' }],
};
const data = { characters: { W0097: char } };
const music = { tracks: [{ id: 'Bgm_Map', name_vi: 'Bản đồ', name_cn: '地图' }] };
const tierLists = [{ slug: 'tong-hop', status: 'published', doc: { title: 'Tổng hợp', author: '新月' } },
                   { slug: 'cu', status: 'archived', doc: { title: 'Cũ', author: 'x' } }];
const pages = buildPages({ data, music, tierLists });
const byPath = Object.fromEntries(pages.map((p) => [p.path, p]));

test('buildPages: the page set', () => {
  for (const p of ['/', '/characters', '/characters/sach-kells', '/characters/sach-kells/build', '/characters/sach-kells/lore',
    '/skins/W0097002', '/gallery', '/tier-list', '/tier-list/tong-hop', '/music', '/music/Bgm_Map', '/banners', '/info']) assert.ok(byPath[p], p);
  assert.equal(byPath['/skins/W0097001'], undefined, 'base skin has no page');
  assert.equal(byPath['/tier-list/cu'], undefined, 'archived list has no page');
});

test('buildPages: character meta, CN fallback, card image', () => {
  const p = byPath['/characters/sach-kells'];
  assert.equal(p.title, 'Sách Kells (凯尔特之书) — Vật Hoa Di Tân Wiki');
  assert.match(p.description, /Kỳ Tích/);
  assert.match(p.description, /圣言/); // untranslated skill shows the Chinese name
  assert.equal(p.image, char.cards[0]);
  assert.equal(byPath['/characters/sach-kells/build'].title, 'Build Sách Kells — Vật Hoa Di Tân Wiki');
  assert.match(byPath['/characters/sach-kells/lore'].description, /Một bộ sách/);
  assert.equal(byPath['/skins/W0097002'].title, '写照 — Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(byPath['/skins/W0097002'].image, char.cards[1]);
  assert.equal(byPath['/'].image, DEFAULT_IMAGE);
});

const template = `<html><head><base href="/" /><title>Vật Hoa Di Tân Wiki</title>
<meta name="description" content="x" />
<meta property="og:title" content="x" />
<meta property="og:description" content="x" />
<meta property="og:url" content="${SITE_ORIGIN}/" />
<meta property="og:image" content="${DEFAULT_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
</head><body><div id="prerender" class="prerender"></div></body></html>`;

test('renderPage: meta replaced, canonical added, text escaped', () => {
  const html = renderPage(template, byPath['/characters/sach-kells/lore']);
  assert.match(html, /<title>Hồ sơ Sách Kells — Vật Hoa Di Tân Wiki<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE_ORIGIN}/characters/sach-kells/lore" />`));
  assert.match(html, new RegExp(`og:url" content="${SITE_ORIGIN}/characters/sach-kells/lore"`));
  assert.match(html, /og:image" content="https:\/\/r2\/characters\/w0097\/cards\/w0097001.webp"/);
  assert.doesNotMatch(html, /og:image:width/); // card size is not 1200×630
  assert.match(html, /&quot;quý&quot; &amp; cổ\./); // game colour tags dropped, the rest escaped
  assert.doesNotMatch(html, /<color/);
  assert.match(html, /<div id="prerender" class="prerender"><h1>Hồ sơ Sách Kells<\/h1>/);
  assert.match(renderPage(template, byPath['/']), /og:image:width/); // default image keeps its size
});

test('escapeHtml', () => assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'));

test('sitemap + robots', () => {
  const xml = sitemap(pages);
  assert.match(xml, new RegExp(`<loc>${SITE_ORIGIN}/characters/sach-kells/build</loc>`));
  assert.equal((xml.match(/<url>/g) || []).length, pages.length);
  assert.match(robots(), new RegExp(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`));
  assert.doesNotMatch(robots(), /whmxcalc/);
});

test('loadTierLists: follows the game pointer; any failure → []', async () => {
  const doc = { version: 1, refs: {}, texts: {}, builds: {}, tierLists: [{ slug: 'a', status: 'published', doc: {} }] };
  const files = { 'https://r2/lore/production/game.pointer.json': { file: 'game.0123456789ab.json' },
                  'https://r2/lore/production/game.0123456789ab.json': doc };
  const ok = async (url) => (files[url] ? { ok: true, json: async () => files[url] } : { ok: false, status: 404 });
  assert.deepEqual((await loadTierLists('https://r2/lore/production/lore.pointer.json', ok)).map((l) => l.slug), ['a']);
  assert.deepEqual(await loadTierLists(undefined, ok), []);
  assert.deepEqual(await loadTierLists('https://r2/x/lore.pointer.json', ok), []); // 404
  assert.deepEqual(await loadTierLists('https://r2/lore/production/lore.pointer.json', async () => { throw new Error('offline'); }), []);
});
