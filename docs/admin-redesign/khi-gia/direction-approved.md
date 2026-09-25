# Khí Giả (React) — direction approved (huashu gate file)

- Date: 2026-09-25
- Shown: A `a-gallery` (roulette → Gallery Dark), B `b-workbench` (reference → Crowdin side-by-side), C `c-catalogue` (best designer → Kenya Hara). Comparison: `direction-review.md`; screenshots `screens/`.
- Owner's words (summary): likes C's lore fields (gold hairline beside the text, no box; A has it too but its image is too big for an edit page); likes B's navigation on desktop and phone (unit list that jumps to "Báo cáo / Tiêu đề…", especially on phones); B's 3 columns are best, but its scrollbars are too wide and white; list: C, but clicking the search box must not show a white box.
- Chosen: **Record = B, with C's bilingual pairs in the middle and thin dark scrollbars. List = C, with the search-focus fix. Phones = B.**
- Confirmed mix prototype: `design-demos/approved-mix.html` (`#record`, `#list`). Owner agreed with: C field style also on phones; B's small relic image in the right column.
- Follow-ups for the real build (not in the prototype, by the owner's request): scroll-spy (the unit list highlights the row scrolled into view, not only on click), a back-to-top button bottom-corner on phones, thinner/nicer scrollbars (optional).
- Build spec: `../khi-gia-direction.md`.
