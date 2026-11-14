import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecipes, type CoffeeDoc } from './coffeeData.mts';

const doc = {
  version: 'r1', shop: [],
  ingredients: [
    { id: 'M02', slot: 1, lv: 1, name_cn: '云咖2号', icon: '', tag: '酸', desc_cn: '' },
    { id: 'M19', slot: 3, lv: 1, name_cn: '玫瑰蜜', icon: '', tag: '花香', desc_cn: '' },
  ],
  recipes: [
    { id: 'R007', lv: 1, name_cn: '手冲云咖', hint_cn: '没有酒吗？那来杯酸的，有特色的吧！', tags: ['酸'], mats: ['M02', 'M02', 'M02'], customer: { id: 'D0095', name_cn: '鎏金骑士', name_vi: 'Lưu Kim Kỵ Sĩ', slug: '', avatar: '' } },
    { id: 'R008', lv: 1, name_cn: '花蜜云咖', hint_cn: '没有酒吗？那来杯酸的吧！要加花花！', tags: ['酸', '花香'], mats: ['M02', 'M02', 'M19'], customer: { id: '', name_cn: '', name_vi: '', slug: '', avatar: '' } },
  ],
} as CoffeeDoc;

test('filterRecipes: hint, ingredient, customer VI without accents, several words', () => {
  assert.equal(filterRecipes(doc, '').length, 2);
  assert.deepEqual(filterRecipes(doc, '没有酒').map((r) => r.id), ['R007', 'R008']);
  assert.deepEqual(filterRecipes(doc, '花花').map((r) => r.id), ['R008']);
  assert.deepEqual(filterRecipes(doc, '玫瑰蜜').map((r) => r.id), ['R008']);
  assert.deepEqual(filterRecipes(doc, 'luu kim').map((r) => r.id), ['R007']);
  assert.deepEqual(filterRecipes(doc, '没有酒 手冲').map((r) => r.id), ['R007']);
  assert.equal(filterRecipes(doc, 'xyz').length, 0);
});
