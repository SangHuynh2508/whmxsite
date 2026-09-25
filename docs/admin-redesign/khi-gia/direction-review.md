# Khí Giả (React) — 3 directions for review (2026-09-25)

Brief: `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md` Task 2 and spec
`docs/superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md` §3/§5. All three keep the approved
Admin shell (60 px rail + view header, Direction B of 2026-09-23), use only `tokens.css` dark colours,
and show real data: the list (16 real characters, real lore progress from the `development` branch)
and A0144 Thiên Cầu Nghi's Lore module (14 real units, 10 with legacy VI). Simulated to show every
state: the "tiếng Trung đã đổi" badge on the relic intro and two dirty fields (save bar visible).

Open locally: `docs/admin-redesign/khi-gia/design-demos/<file>.html#record` or `#list` (double-click).
Screenshots: `screens/{a,b,c}-{record-desktop,list-desktop,record-phone}.png` (1440×900 and 375×812).

| | A — Gallery | B — Workbench | C — Catalogue |
|---|---|---|---|
| Logic | 🎲 Roulette: `date +%S`=57 → web style #18 "Gallery Dark" (Glass / Bottega Veneta) | 🏆 Reference: Crowdin online editor, Side-by-Side mode (support.crowdin.com/online-editor — string list with status, source left / translation right) | 🧠 Best designer: Kenya Hara (emptiness; Muji/Takeo paper catalogues) |
| Idea | The art is the only colour; UI recedes to hairlines and EXIF-style captions. Lore reads like museum wall labels: CN caption small above, VI large below | A translation desk: every unit listed with a status dot on the left, CN | VI grid in the middle, context (relic photo, terms, progress, history) on the right | A facing-page catalogue: original on the left page, Vietnamese on the right page, each unit on the same row; the list is a register index |
| List | Gallery wall of full drawings with a thin progress hairline | Dense table: avatar, name, ID, organisation, stacked progress bar (saved / legacy) | Two-column text register, round portraits, "8 / 14" fractions |
| Record | Sticky full-height drawing left + label (ID, record no., organisation, rarity); content column right | Three panes: unit list · side-by-side editor · context; module tabs in the header | Margin menu left, big serif title with portrait, two-page spread |
| Phone | Drawing becomes a 46 vh banner, content below | Unit list becomes a horizontal chip strip, CN above VI | Margin menu becomes a sticky tab strip, pages stack |
| Save | Bottom bar under the content column | Bottom bar across the app with Ctrl S hint | Floating pill bottom-right |
| Best at | Identity, pleasure of working with the art; weakest for long sessions | Speed and overview when translating many units; densest | Reading and polishing long reports; calmest |
| Motion intent | Slow image zoom on hover, hairline accent on focus | Quick 120 ms state changes, active row highlight, press scale | Accent rule grows on the editing row, page-like fade between modules |

All: reduced motion removes transitions; no horizontal scroll at 375 px (measured); CN text serif, VI Inter.
