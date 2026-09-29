# WHMX — Site audit follow-up (open items)

> Source: the site-wide audit of 2026-09-28 (`/impeccable audit` + `ponytail:ponytail-audit`, read-only, self-review)
> and the fixes of 2026-09-28/29. Everything **done** is summarised in §1; everything **still open** is in §2–§6 with
> its location and a proposal. Pick items from here; record the decision and move the line to §1 when done.
> Entry point for the project: [`../WHMX_CURRENT_STATE_FINAL_2026-09-28.md`](../WHMX_CURRENT_STATE_FINAL_2026-09-28.md).
> Detector output and the scripts used for the checks: `D:\BaiTapCode\WHMX\_claude_scratch\audit\` (not in git).

## 1. Done (2026-09-28 → 29, all verified on production)

| Item | Commit |
|---|---|
| B1 lightbox scroll lock after a route change · B2 calculator picker left open after Back · B3 message when `data.json` fails · B4 admin API no longer loads sharp/AWS SDK | `d8aadec` |
| Dead code: Vue-island CSS (~1 000 lines), catalog drawer + calculator phone bar, 462 overridden CSS declarations, router table (564 → 394), theme.js, loader path rewrite, `manualUnlock`, Lenis helpers, `class-variance-authority`; shared `JOB_NAMES`/`RARITY_LABELS`/`fold` · B5 gold focus ring · B6 `role`/`aria-current` · B7 placeholder, rarity text, Lv toggle gold · B8 punctuation regex | `6543e83` |
| Build tab: plain weapon labels, no stray `›` · B9 calculator renders once (subscriber registered before the first route) · B10 escaped not-found slug | `2f64f80` |
| Build tab: rotations always stacked (label above note and steps) | `a4546fb` |
| Drift group 1: light-theme tokens merged into `:root` (dark only), 2 `[data-theme="light"]` rules removed, undefined `--text-secondary`/`--text-primary` → tokens, brand-mark declaration that ended in an undefined `var(--font-main)` removed (it already fell back to inherit — no change), second gold `#c7a86b` + its rgba (30 uses, gallery) and the light gold `rgba(184,153,71,…)` → `--accent` / `color-mix(var(--accent) …)`. Computed style of every element compared before/after on 12 routes: only those 45 elements changed | this commit |

Owner rulings recorded in `DESIGN.md`: buff keyword orange is the game's colour (D1); small secondary labels < 12 px are fine (D2); weapon labels are plain captions; the calculator's teal is intentional (D4b, 2026-09-29).

## 2. Design drift still open (DESIGN.md)

| # | What | Where | Proposal | Changes the look? |
|---|---|---|---|---|
| D4c | Teal outside the calculator: the "hồi phục" skill pill on Thông Tin | `src/style.css` `.skill-meta-pill.recover` (~L4924) | **Owner to decide:** keep (make it a named token, e.g. `--pill-recover`) or gold / a game colour | yes (one pill) |
| D4d | 54 literal `rgba(212, 183, 99, x)` (= the accent at some alpha) | `src/style.css`, `skinGallery.css`, feature CSS | `color-mix(in srgb, var(--accent) x%, transparent)` — same colour, token-based | no |
| D4e | 37 `#fff` / white-alpha borders (character page tabs, skin strip tabs) | `src/style.css` | `--text-main` / hairline tokens; the page-tab underline `#c4a265` → `--accent` (DESIGN "Tabs") | slightly |
| D4f | Three scrims (60 / 35 / 70 % night-ink) | calculator picker, gallery lightbox, admin dialog | one `--scrim` | slightly |
| D5 | Layout transitions: the nav rail animates `width` and the page `margin-left` (`style.css` L71, L292, L5403; the feedback button `left` L6096); gallery hero progress bar `width` (`skinGallery.css` L353) | | Rail: only if it ever feels janky (a transform rewrite of the rail is a big change). Progress bar → `transform: scaleX()` when the gallery moves to React | no |
| D7b | 49 `box-shadow` (No-Shadow rule): 35 in `style.css`, 14 in `skinGallery.css` | | Remove per area when that area is reworked (React migration), not in one sweep — it changes the feel of many pages at once | yes |
| D8 | `--text-subtle` and `--text-muted` are one role (owner 2026-09-28) | tokens + ~all CSS | Replace `--text-subtle` with `--text-muted`, drop the token | slightly (#8A9099 → #9097A0) |
| D9 | Radius drift 2/3/4/8 px → 6 px; lore report tabs → in-content tab style | `style.css`, `loreTab.css` | When the area is touched | yes |
| D10 | Rail renders 60 px, token `--app-nav-collapsed-width` says 72 px | `tokens.css`, `style.css` | Set the token to 60 or drop it | no |
| D11 | Brand mark "物" is meant to be serif (Noto Serif SC) but has always inherited the sans | `style.css` `.app-nav-brand-mark` | **Owner:** use `var(--font-serif)`? | yes (one glyph) |
| D12 | The Chinese name under the character title renders in the sans | character header CSS | `var(--font-serif)` for `.cd-name-cn` | yes |
| D13 | One `[data-theme="dark"] …` selector left in `style.css` (always true) | `style.css` | Drop the prefix — check specificity first | no |

## 3. Accessibility / structure (impeccable detector, not yet handled)

- Heading levels skip on character pages: `<h1>` name → `<h3>` "Chỉ Số Chiến Đấu" (Thông Tin), `<h4>` "Đồ vàng bạc" (lore). Make the section headings `<h2>` (styles unchanged).
- Calculator: the rarity text "SSR" sits above the `<h2>` name (detector: kicker above heading) — cosmetic.
- The character not-found page (`.char-not-found`, `.btn-primary`) has **no CSS** — it renders as plain unstyled text. Give it the `#empty-state` look (found while fixing B10).
- Lore reading column measured ~89 characters per line at 1440 px (DESIGN.md says max 66 ch for prose) — check `loreTab.css`.

## 4. Code (ponytail) still open

- `isReducedMotion` is written 9 times (small; merging adds as many imports as it removes — do it with the React migration).
- Admin data layer in JS (`src/admin/**/*Api.js`, `evidence.js`) → `.ts` when touched; `src/admin/preview/evidence.check.mjs` is not run by `npm test` (rename to `*.test.mjs` so it runs).
- `tools/`: 35 one-shot `apply_*` / `restore_*` / `execute_recovery_*` Python scripts — the owner's localization history; **do not delete without the owner**.
- Gallery hero auto-rotation timer (`skinGalleryView.js` ~L1302, `visibilitychange` listener added on every render, never removed) — could not be reproduced on production; recheck when the gallery moves to React.

## 5. React migration order (touch it, improve it — no big-bang)

1. Character page shell + Tổng quan (`characterDetail.js` 338, `overviewView.js`) — the Build/Lore islands are React already; removes the `flushSync` / 300 ms wait and the `innerHTML` templates.
2. Trang Phục + Thư Viện (`skinGalleryView.js` 1 543, `skinDetailView.js`, `galleryView.js`, `loreReveal.js`) — lightbox as a native `<dialog>`.
3. Danh sách Khí Giả (`characterCatalogView.js`).
4. Thông Tin + Thiên Phú (`infoView.js` 928, `talentsView.js`) — together with the owner's buff-popup fix (state file §8 banner).
5. Calculator (`talentGraph.js`, `calcCharacterPicker.js`, `resourceSummary.js`, `characterHeader.js`, `state.js`).
6. Router + boot last.

## 6. Operations

- Vercel deployments: each push adds two; the owner keeps the 5 newest — prune with `npx vercel ls whmxsite --format=json` / `npx vercel remove <url> --yes` (keep the Production alias), owner's word first.
