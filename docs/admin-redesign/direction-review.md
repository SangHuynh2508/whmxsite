# WHMX Admin — 3 redesign directions for review (2026-09-23)

Shared input: [`critique-and-spec.md`](./critique-and-spec.md). Screenshots (1600×900, real
owner login, real API, dark theme): [`screens/`](./screens/). Owner's choice goes into
`direction-approved.md` (huashu gate file) — not written until the owner picks.

> **Historical.** B was promoted in Part C (2026-09-23). A, C, `_design-exploration/` and the `?direction=` switch were deleted, so the "view live" steps below no longer work.

**View live:** start `npx vercel dev` in `WhmxCalc/`, log in, then open
`http://localhost:3000/?direction=a#/admin` (or `b`, `c`). Plain `#/admin` still shows the
current AdminApp. The switch is dev-only — production builds contain none of this code
(verified: no direction strings in `dist/`).

All three: every Preview/Accounts feature of the current screen (list + search + filters,
create, full metadata form with JSON validation, owner-only lifecycle/visibility with reason
when disabled, 3 asset slots with upload/finalize, history, reconciliation, user list +
provision), dark text on gold, Vietnamese UI, only `tokens.css` colours, `tsc` clean. Each
was exercised live: open record → save (revision +1) → forced 409 → conflict message shown
**and the user's draft kept in the form** → Accounts → Character CMS Vue island mounts
(133 tiles). None use reactbits; all three dropped the login `MoltenMetal` background
(anti-motion rule) — it can be put back on whichever login is chosen.

| | A — Sổ cái đánh số | B — Linear split view | C — Vignelli accession register |
|---|---|---|---|
| Logic | 🎲 Roulette: `date +%S`=10 → web style #11 "Dark Editorial" (Brittany Chiang) | 🏆 Reference: Linear (verified linear.app docs + redesign post) | 🧠 Best designer: Massimo Vignelli (NPS Unigrid, Vignelli Canon) |
| Concept | Museum accession *numbers*: every route/section is numbered (01, 02, 02.3); left column is the register's spine | The accession *path* unverified→unreleased→released→retired: groups the list, marks each row, becomes the owner's 4-step control | The accession *register sheet*: heavy ink rules, numbered sections, a 4-cell lifecycle row where the saved stage is the one gold cell |
| Shell | Wide sticky left column (304px) with big serif title, numbered nav, account + logout (plain text) at the foot | Dim 200px sidebar (Hiện vật / Preview, Tài khoản at foot, logout icon) + 48px view header with actions | 48px top band with a 2px ink rule: Nhân vật / Preview left, Tài khoản + user + logout right |
| Preview | Full-width table (Hồ sơ / ID gốc / Vòng đời / Hiển thị / Rev); record opens as its own page with an in-page section outline (02.1–02.5) | List stays visible, record opens beside it; properties panel on the right (sticky ≥1536px) | List column (360px) + record column; list keeps filters/state when you switch routes |
| Type | Noto Serif display 84/60/40, Inter 15 body, mono labels | Inter 12–18, Noto Serif 36 for titles only — quietest, densest | Noto Serif 40 titles, 96–112px 物华弥新 on login, Inter 14 body |
| Character | Bold, editorial, most "WHMX-specific" | Most familiar/efficient for daily tool use | Most distinctive; strongest museum-catalogue identity |
| Files | `src/admin/layout/_design-exploration/a-ledger-spine/` | `.../b-accession-split/` | `.../c-accession-register/` |

## Things found and fixed during review (not design choices)

- Tailwind wasn't scanning the new folder on an already-running dev server → temporary
  `@source "../_design-exploration"` in `globals.css` (remove with the folder).
- Legacy `src/style.css:737` `.hidden { display:none !important }` silently kills every
  `hidden md:block`-style Tailwind pattern → all three now use `max-md:hidden` form; rule added
  to the spec for future React work.
- Tailwind preflight isn't loaded, so `<ol>` showed "1. 2." markers → scoped list/font reset in
  `globals.css` (`@layer legacy-reset`) — this one stays after promotion.
- C: record pane landed in the 360px column (same `.hidden` cause) → fixed. B: email column and
  empty right pane were invisible (same cause) → fixed.

## Not verified

- Light theme: the app is dark-only (`src/app/settings/theme.js` forces `data-theme="dark"`),
  so light isn't reachable; all three use tokens and would follow if it's re-enabled.
- Asset upload to R2 and owner finalize weren't exercised (would write real objects to the
  bucket); the UI calls the same `uploadAsset`/`finalizeUpload` functions as today.
- Mobile widths — layouts have breakpoints, not screenshot-checked.

## Environment note

`vercel dev` (CLI 59.25.4, Node 24.15, Windows) crashed twice during this session with exit
code `0xC0000409` (native stack-buffer overrun) — once for each of two separate instances,
so it's not caused by running two at once. If it keeps happening, try Node 22 LTS.
