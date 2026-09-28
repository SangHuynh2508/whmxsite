import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSite } from './siteSearch.mts';

const characters = {
  W0176: { id: 'W0176', slug: 'thuong-chu-dong-nhan', name_vi: 'Thương Chu Đồng Nhân', name_cn: '商周铜人', skins: [
    { skinID: 'W0176001', name_vi: 'Tạo Hình', name_cn: '肖形', is_base: true },
    { skinID: 'W0176002', name_vi: 'Đồng Nhân Dạ Yến', name_cn: '铜人夜宴', is_base: false },
  ] },
  A0001: { id: 'A0001', slug: 'son-thuy-nhan-vat-kinh', name_vi: 'Sơn Thủy Nhân Vật Kính', name_cn: '山水人物镜', skins: [] },
  X0001: { id: 'X0001', name_vi: '', name_cn: '无名', skins: [{ skinID: 'X0001002', name_vi: '', name_cn: '夜宴服', is_base: false }] },
};

test('accent-insensitive Vietnamese: "thuong chu" finds Thương Chu Đồng Nhân', () => {
  const [hit] = searchSite('thuong chu', characters);
  assert.deepEqual(hit, { kind: 'character', title: 'Thương Chu Đồng Nhân', sub: '商周铜人', characterId: 'W0176', href: '#/characters/thuong-chu-dong-nhan' });
});

test('Chinese names match; a character without a VI name shows its CN name and links by ID', () => {
  assert.equal(searchSite('人物', characters)[0].title, 'Sơn Thủy Nhân Vật Kính');
  assert.deepEqual(searchSite('无名', characters)[0], { kind: 'character', title: '无名', sub: '无名', characterId: 'X0001', href: '#/characters/X0001' });
});

test('skins: the base outfit is left out; a skin links to its page and names its character', () => {
  assert.deepEqual(searchSite('tao hinh', characters), []);
  assert.deepEqual(searchSite('da yen', characters), [
    { kind: 'skin', title: 'Đồng Nhân Dạ Yến', sub: 'Thương Chu Đồng Nhân', characterId: 'W0176', href: '#/skins/W0176002' },
  ]);
});

test('names that start with the query come first; characters before skins; blank query and limit', () => {
  assert.deepEqual(searchSite('dong nhan', characters).map((r) => r.title), ['Đồng Nhân Dạ Yến', 'Thương Chu Đồng Nhân']);
  assert.deepEqual(searchSite('夜宴', characters).map((r) => r.kind), ['skin', 'skin']);
  assert.deepEqual(searchSite('  ', characters), []);
  assert.equal(searchSite('n', characters, 2).length, 2);
});
