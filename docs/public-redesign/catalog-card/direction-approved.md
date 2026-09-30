# Khí Giả card — approved direction (2026-09-30)

Owner asked to compose the game's ticket from its sprites ("lấy mấy cái ảnh này ra rồi ghép với card nhân vật"):
`ui_ty_kp_di1` (base + cream stub), the 1 : 2 card art (exactly the 146 × 292 window), `ui_ty_kp_pz_<rare>` (rarity glow:
4 red, 3 gold, 2 teal = data.json `rare`), `ui_ty_kp_bian` (white frame); job icon where the game shows Trí Tri (owner: the
site's white job icon, no Trí Tri box). Sprites taken from the older `spriteatlas_commonres` / `uiatlas_uicollectoreventversion2`
copies in `NeoArtifacts/Assets/bundles` (the r3071 copies are not cached); `ui_home_kbn_bi*` / `ui_cd_jnbx_*` were not in them.

Shown: `design-demos/catalog-ticket.html` (the white ticket in the catalogue) and `design-demos/card-options.html`
(1 · Vé game, 2 · Vé tối, 3 · Không khung). Owner: the white frame clashes with the dark site; the rarity fade and the game's
own 限 seal (printed in the art of all 11 `is_limited` characters — checked on all 135 cards) should replace the red border.
**Picked: 3 · Không khung, also for the Tổng quan tab** (owner: "chốt hướng 3 và dùng cho tab tổng quan"); the calculator
panel card (was a misaligned ticket stub, owner: "ảnh nó bị lệch") uses the same card.

Implemented:
- `src/features/characters/catalogCard.mts` (+ test): `catalogCardHtml` (catalogue) and `cardArtLayers(rare, job)` (glow + job),
  shared by the catalogue, `detail/overviewView.js` and the calculator panel (`index.html` `#profile-card-layers`,
  `characterHeader.js`).
- `.cc-art`: 1 : 2 art, 6 px corners, `--bg-elevated` behind; `.cc-glow` = `/assets/frames/ui_ty_kp_pz_<rare>.png` over the
  last 19.86%; `.cc-job` 25% wide at 4.1% from the foot with `--art-icon-shadow`; `.cc-hz` (Hoán Chương) top-right; name
  under the art in 700 14 px serif; hover only crossfades to the breakthrough card (owner: no lift, no underline).
- No "SSR" label and no Limited border; rarity, job and Limited are in the card's accessible name and tooltip.
- Removed: the old card CSS (`.card-media`, `.rarity-label`, `.card-bottom-overlay`, `.card-identity`, `.is-limited`, …), the
  ticket stub CSS and `public/assets/frames/ui_ty_kp_{di1,di2,bian}.png` (no longer used).

## Correction (2026-09-30)

Owner: "ý là giống tab tổng quan là có cái thẻ răng cưa á" — "chốt hướng 3 và dùng cho tab tổng quan" meant option 3 for
the catalogue and **the game ticket (scalloped stub) for the Tổng quan tab**, and the calculator panel the same as Tổng quan.
Now: `ticketHtml` (catalogCard.mts) = `ui_ty_kp_di1_body.png` (di1 cropped to its 146 × 333 body) + the 1 : 2 art with
`cardArtLayers` (rarity glow + job) + `ui_ty_kp_bian.png` + the VI name in the stub (800 serif, `--on-vivid` ink); `.tk` in
style.css. Tổng quan at 256 px, calculator at 200 px (thumbnails still swap the art); the old name captions are gone
(the name is in the stub). The catalogue keeps the frameless `.cc-card`.
