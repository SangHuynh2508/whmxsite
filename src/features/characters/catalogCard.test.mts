import assert from 'node:assert/strict';
import test from 'node:test';

import { catalogCardHtml, type CatalogCard } from './catalogCard.mts';

const card = (extra: Partial<CatalogCard> = {}): CatalogCard => ({
  slug: 'thac-kim-bac-son-lu', name: 'Thác Kim Bác Sơn Lư', rare: 4, rarityLabel: 'SSR', job: 3, jobLabel: 'Viễn Kích',
  limited: true, primary: 'https://r2/a.webp', secondary: null, huanzhangIcon: null, ...extra,
});

test('rarity is the game glow (pz_<rare>), not a label; limited is the art seal, not a border class', () => {
  const html = catalogCardHtml(card());
  assert.match(html, /cc-glow" style="background-image:url\(\/assets\/frames\/ui_ty_kp_pz_4\.png\)"/);
  assert.doesNotMatch(html, /rarity-label|is-limited/);
});

test('the name sits under the art; screen readers get rarity, job and Limited', () => {
  const html = catalogCardHtml(card());
  assert.match(html, /<\/span><span class="cc-name">Thác Kim Bác Sơn Lư<\/span><\/a>$/);
  assert.match(html, /aria-label="Thác Kim Bác Sơn Lư · Viễn Kích · SSR · Limited"/);
  assert.doesNotMatch(catalogCardHtml(card({ limited: false })), /Limited/);
});

test('optional layers: the breakthrough card on hover and the Hoán Chương mark', () => {
  assert.doesNotMatch(catalogCardHtml(card()), /cc-art-alt|cc-hz/);
  const html = catalogCardHtml(card({ secondary: 'https://r2/b.webp', huanzhangIcon: '/assets/hz.png' }));
  assert.match(html, /class="cc-art-alt" src="https:\/\/r2\/b\.webp"/);
  assert.match(html, /class="cc-hz"/);
  assert.match(html, /has-alt/);
});
