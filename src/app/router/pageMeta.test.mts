import test from 'node:test';
import assert from 'node:assert/strict';
import { pageTitle } from './pageMeta.mts';

const data = { characters: { W0097: { id: 'W0097', slug: 'sach-kells', name_vi: 'Sách Kells', name_cn: '凯尔特之书', skins: [{ skinID: 'W0097002', name_vi: '', name_cn: '写照' }] } } };

test('pageTitle matches the prerendered titles', () => {
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'overview' }, data), 'Sách Kells (凯尔特之书) — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'build' }, data), 'Build Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'lore' }, data), 'Hồ sơ Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'skin-detail', skinId: 'W0097002' }, data), '写照 — Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'home' }, data), 'Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'missing' }, data), 'Vật Hoa Di Tân Wiki');
});
