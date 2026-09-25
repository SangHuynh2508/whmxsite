# Khí Giả (React) — approved visual direction (build spec)

> Plan: `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md` Task 2 step 3. Gate file and owner's words:
> `khi-gia/direction-approved.md`. Reference prototype: `khi-gia/design-demos/approved-mix.html`
> (`#record`, `#list`) — copy measurements from it; it is not shipped.

**One line:** list = C (register index), record = B (workbench: pane list · editor · context, tabs in the header,
chip strip on phones) with C's bilingual pairs in the middle (no field boxes, a hairline left of the VI text
that turns gold on focus/dirty).

## 1. Tokens and type

Colours only from `src/styles/tokens.css` (dark), used as Tailwind arbitrary values (`bg-(--bg-main)`,
`text-(--text-subtle)`, `border-(--border-color)` …), as Preview/Accounts do.

| Use | Token |
|---|---|
| Page / sticky headers | `--bg-main` |
| Rail, save bar, header strips | `--bg-surface` |
| Hover row | `--bg-surface-hover` |
| Active tab background | `--bg-elevated` |
| Hairlines / section rules | `--border-color` / `--border-strong` |
| Text / secondary / captions | `--text-main` / `--text-muted` / `--text-subtle` |
| Gold: active rail line, dirty count, legacy note, primary button, focus | `--accent`; active unit background `--accent-light` |
| "Tiếng Trung đã đổi" | `--rarity-ssr-text` (text), `--rarity-ssr-bg` if a fill is needed |
| Status dots (the prototype's green is not a token) | done `--text-muted`, legacy `--accent`, changed `--rarity-ssr-text`, todo hollow ring `--text-subtle` (shape, not only colour, tells done from todo) |
| Motion | `--motion-fast` (120 ms), `--motion-normal` (180 ms), `--ease-standard` |

Fonts: `--font-sans` (Inter) for VI and UI; `--font-serif` (Noto Serif SC) for CN text, CN names and the list's
names. Caption style: 11–12 px, `tracking-[.12em]`–`[.3em]`, uppercase, `--text-subtle`.
Never the bare `hidden` class (`max-md:hidden`, conditional render).

## 2. List (`#/admin/characters`) — C

- Centered column `max-w-[1100px]`, padding 56/40 px (phones 32/16).
- Kicker "KHÍ GIẢ", big serif count "133 hồ sơ", one muted lead line.
- Search row: borderless input 18 px + text filter buttons (Tất cả · Chưa xong · Có bản cũ · Tiếng Trung đã đổi
  · Thuật ngữ lore). **Focus: no outline/box on the input; the row's bottom rule turns `--accent`**
  (`:focus-within`). Active filter = `--text-main`, others `--text-subtle`.
  Phase 1 has no lore progress: show only "Tất cả" + search; the lore filters/fractions arrive in phase 2.
- Entries: CSS `columns:2` (1 column below 900 px), each a button row: 44 px round avatar, serif VI name + CN
  small, `ID · rarity · organisation`, right-aligned fraction (phase 2). Hover = soft horizontal gradient.

## 3. Record (`#/admin/characters/:id/:module`) — B

- View header: breadcrumb "Khí Giả / A0144". Record header strip: 36 px avatar, VI name + CN serif, module tabs
  (active: `--bg-elevated` + 2 px gold inset underline). Tabs scroll horizontally on phones.
- Body: `grid-template-columns: 260px 1fr 280px` (≥1100 px), `220px 1fr` (760–1100, context hidden),
  stacked on phones. Each pane scrolls on its own on desktop; the page scrolls on phones.
- Save bar: full-width strip at the bottom (desktop: count · hint · `Ctrl S` · Bỏ thay đổi · Lưu); fixed to
  the bottom on phones (count · Bỏ · Lưu).

Per module (phase 1):

| Module | Left pane | Middle | Right pane |
|---|---|---|---|
| Tổng quan | none (4 fields) → middle spans | pairs: source value ↔ VI (`OverridableField`) | portrait, IDs, recent history |
| Trang phục | skin list (thumbnail, VI/CN name) — same style as the lore unit list | selected skin's pairs (name, description, obtain) + read-only series/acquisition | skin image |
| Nguồn | none | key/value, read-only | — |
| Lịch sử | none | `HistoryList` | — |
| Lore (phase 2) | unit list grouped Giới thiệu · Báo cáo · Hiện vật · Dòng thời gian, status dot + CN preview | pairs | relic image (small, B size), relic terms, progress, recent history |

### Pair (the shared field look, from C)

- Row: 2 columns (`1fr 1fr`, gap 48 px), padding 24/32 px, hairline `border-top` between rows; caption row
  spanning both columns (label `--text-muted` 500, extras like "Mở khoá: thiện cảm 1 · 感应"); active row's
  label turns `--accent`.
- Source: serif 15 px / line-height 2, `--text-muted`-ish, `white-space: pre-line`.
- VI: `<textarea>` with **no border, no background, no outline**; Inter 300 16 px / 1.9; placeholder italic
  "Viết bản tiếng Việt…". Auto-grow (`field-sizing: content` where supported; JS height fallback).
- Hairline 1 px, 24 px left of the VI text (12 px on phones): `--border-color`; **`--accent` on
  `:focus-within` or when dirty.** This is the focus indicator — keep it (accessibility).
- Notes under the text as plain text, not pills: "Bản cũ · chưa lưu" (`--accent`) + "Dùng bản này";
  "Tiếng Trung đã đổi" (`--rarity-ssr-text`) + "So bản cũ"; "Chưa dịch"; then "Chép nguồn", "Phóng to", and the
  character count right-aligned. For overridable fields: "Đang dùng bản sửa" + "Trả về gốc".
- Phones: one column, source above VI, same hairline.

### Unit list ↔ editor sync (owner, 2026-09-25)

- Click a unit (desktop list or phone chip) → the editor scrolls to that row (smooth unless reduced motion) and
  focuses its VI field **without** a second `scrollIntoView` (it cancels the smooth scroll — scroll only the list's
  own `scrollLeft/scrollTop`).
- **Scroll-spy:** while scrolling, the unit whose row sits at the top of the editor becomes active
  (`IntersectionObserver` on the rows, root = editor pane on desktop / viewport on phones, top rootMargin =
  sticky header height). Focusing a row also makes it active. The active chip/list item is kept visible.
- Phones: the chip strip is `position: sticky; top: 0`; rows use `scroll-margin-top` = strip height.
  Page containers use `overflow-x: clip` (not `hidden`, which breaks sticky).
- **Phones: a back-to-top button** in the bottom corner above the save bar, shown after scrolling past the
  record header; `aria-label="Lên đầu trang"`.

## 4. Scrollbars (owner: thinner, nicer — optional)

The public site already styles `::-webkit-scrollbar` 8 px in `tokens.css`. In the admin root:
6 px, transparent track, rounded thumb `--border-strong`, `--text-subtle` on hover; the thumb shows only while
the pane is hovered or scrolling (`.pane:hover::-webkit-scrollbar-thumb`). Firefox: `scrollbar-width: thin;
scrollbar-color: var(--border-strong) transparent` inside `@supports (-moz-appearance: none)` — setting
`scrollbar-color` in Chrome would disable the `::-webkit-scrollbar` styling.

## 5. States

| Component | States |
|---|---|
| List | loading (skeleton lines), error + "Thử lại", empty search "Không có nhân vật khớp" |
| Pair | clean · focused (gold hairline) · dirty (gold hairline) · legacy (note) · source changed (red note) · saving (field read-only) |
| Save bar | not rendered when clean & idle · "N thay đổi chưa lưu" · saving (Lưu disabled) · "Đã lưu." · error message (`role="status"`) · 409 banner above the editor: "Có người khác vừa lưu…" + "Tải bản mới (bản của bạn giữ trong nháp)" |
| Draft | on open with a stored draft: native `confirm('Có bản nháp chưa lưu. Khôi phục?')` as in the plan (an inline banner only if the owner asks) |

## 6. Motion intent (Task 8)

- Press: buttons `scale(.97)` over `--motion-fast`.
- Tabs, list hover, unit highlight, hairline colour: colour/background transitions `--motion-fast`/`--motion-normal`, `--ease-standard`.
- Module/record change: View Transitions API cross-fade (~180 ms), feature-detected.
- Save: count → "Đã lưu." swap, no bounce.
- `prefers-reduced-motion: reduce`: no transitions, instant scrolling.
