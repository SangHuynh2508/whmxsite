# Tea room (Phòng Trà) — approved direction: D2

Gate file (huashu-design). Spec: [`../../superpowers/specs/2026-10-03-tea-room-design.md`](../../superpowers/specs/2026-10-03-tea-room-design.md);
brief: [`design-brief.md`](design-brief.md). Demos: `design-demos/` (serve the repo root with `python -m http.server 8765`).

## What was shown (2026-10-03)

| Version | File | Logic | Shots |
|---|---|---|---|
| A · Biên bản | `direction-a-bien-ban.html` | roulette `date +%S` = 18 → web #19 Swiss Monochrome in the Night Archive: grid transcript, sticky stage rail, 契合 as a two-column split | `shots/a-1440.png`, `a-390.png` |
| B · Cửa trăng | `direction-b-cua-trang.html` | real reference: the game's 品茗 screen: drawing in a moon window (sticky), tea shelf, stage stepper, option slips vs paper dialogue boxes with a name plaque | `shots/b-1440.png`, `b-1440-top.png`, `b-390.png` |
| C · Cuộn trà | `direction-c-cuon-tra.html` | best designer: Kenya Hara: one narrow hand-scroll column, calligraphy as the only ornament | `shots/c-1440.png`, `c-390.png` |
| D · Trộn | `direction-d-mix.html` | owner mix (below) | `shots/d-1440.png`, `d-390-top.png`, `d-1440-top.png` |
| **D2** | **`direction-d2.html`** | D + tea descriptions + a three-column tea band | `shots/d2-1440-top.png`, `d2-390.png`, `d2-390-top.png` |

## Owner's words

- On A/B/C: "icon của hướng B rất ấn tượng, rất đẹp, nhưng bố cục thì t thích A hơn vì nó chiếm được nhiều không gian hơn
  và ít phải kéo hơn, nhưng cách thiết kế hội thoại của B (từng khung, vị trí đối nghịch nhau) làm t cảm giác như đang thật
  sự nói chuyện với nhân vật hơn, nhưng cũng vì nó nằm trên 1 hàng nên phải kéo dài hơn mấy cái khác, ngoài ra thì nó còn
  bị khuyết 1 bên do ảnh phía trên" → D.
- "cơ mà icon trà không đúng ấy" → teas use the item icons `itemicon_<id>` (the `ui_pm_tea` sprites are silhouette cards).
- "thêm thông tin của từng loại trà như m nói, và thiết kế sao để tận dụng khoản trống bên phải hiện tại" → D2.
- **"chốt D2, viết plan đi"** (2026-10-03).

## D2 in one paragraph

Top band in three columns: the character's drawing in B's moon window (hairline gold circle) | the 3 favourite teas as a
vertical tab list (item icon, VI + CN) | the chosen tea: large icon, name, the tea's description, the character's comment
in a paper box with a name plaque. Below, A's layout: a sticky stage rail on the left (the game's calligraphy 缘起 / 相知 /
契合 + VI name + one line on the game rule) and B's dialogue: the player's option as a slip on the right (VI + CN), the
character's reply in a paper box (archive-slate + gold hairline + grain, name plaque) with the reaction sprite (hearts /
tangled thread on a paper chip) at its corner; two exchanges per row (one column ≤ 1100 px). 契合: the two branches side by
side, each opener followed by its two follow-ups indented on a gold hairline. Ending: a paper box with success / failure
lines and the result poem. Phones: moon 220 px centred, teas in one row, detail under them; no horizontal scroll at 390 px.

## Notes for implementation

- The reaction chip colour `#d8cfbd` becomes a token (e.g. `--paper-chip`); stage-direction replies use a dashed hairline
  box, ash italic text.
- impeccable `detect` on A/B/C: advisory only (13/14 px sizes, the new chip colour); D/D2: no findings.
- The mock tab bar's scrollbar at 390 px is a demo artefact (the real character tabs already exist).
