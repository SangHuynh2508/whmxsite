# Mobile navigation — approved direction (2026-09-28)

Problem (owner): the phone bottom dock showed an empty slot on pages without a search box. Options offered: (1) global
search overlay behind the 🔍; (2) drop the dock, keep ☰ (morph to ✕) under the report badge, full-screen menu. Owner
picked **(2) + a global search inside the menu** ("chọn B").

Shown (huashu gate, three variations of that concept, built serially — no subagents per the owner's rule; real data from
`public/data.json` via `design-demos/search-data.js`; screenshots in `_claude_scratch/nav-direction-*.png`, not committed):

- A · Mục lục (`design-demos/direction-a-index.html`) — full-screen sheet, boxed search on top, rows rise in order, ☰
  morphs to ✕ in place.
- B · Ngăn kéo lưu trữ (`design-demos/direction-b-drawer.html`) — drawer from the left with the lore-ticket material
  (grain, gold hairline, serif entries with CN, perforations); page dims and drifts.
- C · Bàn tra cứu (`design-demos/direction-c-desk.html`) — the menu grows out of ☰ as a circle; big auto-focused search;
  2 × 2 page tiles; avatar-grid results.

**Picked: A.** Owner, verbatim: "t nghĩ chọn A, với cả khi menu mở lên thì ẩn nút report đi cho đỡ vướng, bắt đầu làm
luôn, và push".

Implemented (`src/app/layout/AppNav.tsx` `MobileMenu`, `src/app/layout/siteSearch.mts` + test, `src/style.css`
`.mobile-menu-*`):
- ☰ fixed bottom-left (44 px, gold hairline, 6 px), report badge stacked above it; the badge hides while the menu is open.
- Sheet = native modal `<dialog>` (Esc, focus trap); the ✕ sits exactly where ☰ is; focus goes to ✕ on open so the phone
  keyboard stays down until the search box is tapped.
- Search: characters + non-base skins, accent-insensitive VI, CN substring, names starting with the query first; Enter
  opens the first result. Links close the sheet.
- GSAP: sheet fades in 0.22 s, blocks rise in order; new results arrive the same way; closing is instant; reduced motion
  skips it.
- The calculator keeps its own character picker (tap the avatar); the dock's 🔍 only opened the legacy `#sidebar` drawer.
