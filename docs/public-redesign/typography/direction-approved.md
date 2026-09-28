# Typography — approved direction (2026-09-28)

Owner opened the question ("về font inter thì nếu m có đề xuất khác thì đổi cũng được … vì trước đó ko sài skill nào
cả"). Hard requirement: full Vietnamese — every candidate ships Google Fonts' `vietnamese` subset (checked with the CSS
API on 2026-09-28). Chinese stays Noto Serif SC in every option.

Shown on real site content (`design-demos/specimen.html?font=inter|a|b|c`; screenshots in `_claude_scratch/font-*.png`,
not committed): character header, tabs, Build sheet excerpt (7202, untranslated affixes, ATK/SKILL tags, skill text
with coloured numbers), lore paragraph and relic ticket.

- Today: Inter + Noto Serif.
- A: Be Vietnam Pro + Noto Serif — Vietnamese-designed, but wide ("Xem thiên phú ›" wrapped; tight phone cells).
- **B: IBM Plex Sans + Literata** — crisp small sizes, even numerals, catalogue character; Literata built for reading.
- C: Source Sans 3 + Source Serif 4 — same family as Noto Serif SC, but a low x-height made 12 px labels small.

**Picked: B.** Owner: "oke chốt B đi".

Implemented: `index.html` Google Fonts link (IBM Plex Sans 400–700, Literata 500–700 + italic 500, Noto Serif SC);
`src/styles/tokens.css` `--font-sans: 'IBM Plex Sans'…`, `--font-serif: 'Literata', 'Noto Serif SC', serif` (Literata
has no CJK, so Chinese falls back to Noto Serif SC in the same run); literal `'Noto Serif'` stacks in `style.css`,
`loreTab.css`, `adminShell.css` now use the token. Check at 1440 and 390 px over 10 routes: no horizontal scroll; one
clip found and fixed (the Lv.100 / Lv.120 toggle on Thông Tin at 390 px now wraps under its title).
