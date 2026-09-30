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

test('ticketHtml: the game ticket (stub, frame, glow, job) with the name in the stub; the image can carry an id', async () => {
  const { ticketHtml } = await import('./catalogCard.mts');
  const html = ticketHtml({ image: 'https://r2/a.webp', rare: 3, job: 2, name: 'Thiên Cầu Nghi', imageId: 'profile-card-img' });
  assert.match(html, /^<div class="tk">/);
  assert.match(html, /<img class="tk-img" id="profile-card-img" src="https:\/\/r2\/a\.webp" alt="Thiên Cầu Nghi"/);
  assert.match(html, /ui_ty_kp_pz_3\.png/);
  assert.match(html, /<span class="tk-frame"><\/span><span class="tk-name">Thiên Cầu Nghi<\/span><\/div>$/);
  assert.doesNotMatch(ticketHtml({ image: 'x', rare: 4, job: 1, name: 'A' }), / id="/);
});
