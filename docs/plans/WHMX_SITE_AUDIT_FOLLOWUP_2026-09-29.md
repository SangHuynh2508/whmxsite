# WHMX — Site audit follow-up (open items)

> Source: the site-wide audit of 2026-09-28 (`/impeccable audit` + `ponytail:ponytail-audit`, read-only, self-review)
> and the fixes of 2026-09-28/29. Everything **done** is summarised in §1; everything **still open** is in §2–§6 with
> its location, a proposal and why it was not done yet. Pick items from here; record the decision and move the line to
> §1 when done. Entry point for the project: [`../WHMX_CURRENT_STATE_FINAL_2026-10-02.md`](../WHMX_CURRENT_STATE_FINAL_2026-10-02.md).
> Detector output and the scripts used for the checks (style dumps + `diff_dumps.py`, Playwright checks):
> `D:\BaiTapCode\WHMX\_claude_scratch\audit\` (not in git).

## 1. Done (2026-09-28 → 29, all verified on production)

| Item | Commit |
|---|---|
| B1 lightbox scroll lock after a route change · B2 calculator picker left open after Back · B3 message when `data.json` fails · B4 admin API no longer loads sharp/AWS SDK | `d8aadec` |
| Dead code: Vue-island CSS (~1 000 lines), catalog drawer + calculator phone bar, 462 overridden CSS declarations, router table (564 → 394), theme.js, loader path rewrite, `manualUnlock`, Lenis helpers, `class-variance-authority`; shared `JOB_NAMES`/`RARITY_LABELS`/`fold` · B5 gold focus ring · B6 `role`/`aria-current` · B7 placeholder, rarity text, Lv toggle gold · B8 punctuation regex | `6543e83` |
| Build tab: plain weapon labels, no stray `›` · B9 calculator renders once (subscriber registered before the first route) · B10 escaped not-found slug | `2f64f80` |
| Build tab: rotations always stacked (label above note and steps) | `a4546fb` |
| Drift group 1: light-theme tokens merged into `:root`, 2 `[data-theme="light"]` rules, undefined `--text-secondary`/`--text-primary`, second gold `#c7a86b` (30 uses) and light gold → `--accent`. Only the 45 intended elements changed (computed-style diff, 12 routes) | `93e455a` |
| Vercel: 29 deployments pruned to the 5 newest (Production alias `whmxsite-60jokawil` kept), owner yes 2026-09-29 | — |
| Drift group 2: "物" nav mark and the Chinese name under the character title → `--font-serif` (D11, D12; owner: "theo m"); tab underlines `#c4a265` → `--accent` (D4e); 22 `#fff` texts → `--text-main` (D4e); calculator picker scrim 75 % → `--scrim` (D4f); 52 literal gold `rgba(212,183,99,x)` → `color-mix(in srgb, var(--accent) x%, transparent)` (D4d, same colour); `--text-subtle` merged into `--text-muted` in 20 files incl. Admin, token removed (D8); the last `[data-theme="dark"]` rule folded into its base (D13); `--app-nav-collapsed-width` documented as the content offset (60 px rail + 12 px gap, D10 — no layout change). Section headings under the character name `h3` → `h2` (Tổng quan, Thông Tin) and skill names `h4` → `h3` (styles unchanged); the character not-found page styled like the empty state (it had no CSS); `evidence.check.mjs` → `evidence.test.mjs`, now in `npm test`. Computed-style diff on 12 routes: only colour/font changes of the elements above (1 768 values in 34 distinct rules), everything else identical | `dbc2f62` |
| D4c "Hồi VP" pill teal kept (owner) and made a token `--energy-gain` (same colour, checked in the browser) | next commit |

Owner rulings recorded in `DESIGN.md`: buff keyword orange is the game's colour (D1); small secondary labels < 12 px are fine (D2); weapon labels are plain captions; the calculator's teal is intentional (D4b, 2026-09-29).

## 2. Design drift still open

| # | What | Where | Proposal / why not yet | Changes the look? |
|---|---|---|---|---|
| D5 | Layout transitions: the nav rail animates `width` and the page `margin-left` (`style.css` L71, L292, the rail rule ~L5400, feedback button `left`); gallery hero progress bar `width` (`skinGallery.css` L353) | | Rail: a transform rewrite of the rail is a big change for a hover effect — only if it ever feels janky. Progress bar → `transform: scaleX()` when the gallery moves to React (§5) | no |
| D7b | 49 `box-shadow` (No-Shadow rule): 35 in `style.css`, 14 in `skinGallery.css` | | Remove per area when that area is reworked (§5) — one sweep would change the feel of every page at once | yes |
| D9 | Radius drift 2/3/4/8 px → 6 px; lore report tabs → the in-content tab style | `style.css`, `loreTab.css` | When the area is touched (§5) | yes |
| D4g | White-alpha frames on the character page tabs and skin strip tabs (`rgba(255,255,255,.28/.45)`) | `style.css` `.cd-tab-item*`, `.skin-strip-tab*` | Kept on purpose: DESIGN "Tabs" asks for a *brighter frame* on the active tab; a token for it (`--frame-bright`) if a second use appears | — |

## 3. Accessibility / structure

- Done: heading order on character pages (h1 → h2 → h3). Still: popover titles (`h4` in Build/Lore popovers) sit outside the page outline — they are dialogs, fine as they are.
- Calculator: the rarity text "SSR" sits above the `<h2>` name (detector "kicker above heading") — cosmetic, leave.
- Lore reading column: the detector counted ~89 characters per line, but `.lore-prose` is `max-width: 66ch` as DESIGN asks — `ch` is the width of "0" and Vietnamese letters are narrower. False positive, nothing to do.

## 4. Code (ponytail) still open

- `isReducedMotion` is written 9 times (small; merging adds as many imports as it removes — do it with the React migration).
- Admin data layer in JS (`src/admin/**/*Api.js`, `evidence.js`) → `.ts` when touched.
- `tools/`: 35 one-shot `apply_*` / `restore_*` / `execute_recovery_*` Python scripts — the owner's localization history; **do not delete without the owner**.
- Gallery hero auto-rotation timer (`skinGalleryView.js` ~L1302, a `visibilitychange` listener added on every render, never removed) — could not be reproduced on production; recheck when the gallery moves to React.

## 5. React migration order (touch it, improve it — no big-bang)

Each step is its own piece of work (spec/plan per the owner's workflow); the look stays the same unless the owner asks
for a redesign (then huashu-design first). Clear the §2 items of the area in the same step.

1. Character page shell + Tổng quan (`characterDetail.js` 338, `overviewView.js`) — the Build/Lore islands are React already; removes the `flushSync` / 300 ms wait and the `innerHTML` templates.
2. Trang Phục + Thư Viện (`skinGalleryView.js` 1 543, `skinDetailView.js`, `galleryView.js`, `loreReveal.js`) — lightbox as a native `<dialog>`; D5 progress bar; the timer in §4.
3. Danh sách Khí Giả (`characterCatalogView.js`).
4. Thông Tin + Thiên Phú (`infoView.js` 928, `talentsView.js`) — together with the owner's buff-popup fix (state file §8 banner).
5. Calculator (`talentGraph.js`, `calcCharacterPicker.js`, `resourceSummary.js`, `characterHeader.js`, `state.js`).
6. Router + boot last.

## 6. Operations

- Vercel: each push adds two deployments; keep the 5 newest — `npx vercel ls whmxsite --format=json` (paginate with `--next`), keep the Production alias (`npx vercel inspect https://whmxsite.vercel.app`), `npx vercel remove <url> --yes`. Pruned 2026-09-29 (29 → 5).
