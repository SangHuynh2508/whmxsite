# Build tab — approved direction (2026-09-28)

Shown (2026-09-27, all with the production W0182 build, screenshots in `_claude_scratch/build-shots/`, not committed):
- A · Sổ tay (`design-demos/direction-a-handbook.html`, roulette #12 Warm Editorial in dark)
- B · Tra cứu xếp hạng (`design-demos/direction-b-lookup.html`, reference prydwen.gg HSR build pages)
- C · Tấm thẻ build (`design-demos/direction-c-sheet.html`, Massimo Vignelli / Unigrid)

**Picked: C, mixed with B's affix block.** Owner, verbatim:

> t thích kiểu C vì pc nhìn rất gọn, nhưng cái thâm tạo khá khó nhìn, nên bỏ asset lót ở đó đi và tìm thử trong kho có
> asset như ảnh t gửi không, cái icon á. phần skill thì nên có thêm tên ở dưới dạng ngắn gọn như "skill" "ult" "nor"
> hoặc "atk"(có thể gợi ý thêm). cơ mà dòng thuộc tính thì t lại thích của B hơn vì dễ nhìn hơn, ko biết có thể nhét
> vào được ko nhỉ, dù sao cái phần thâm tạo bỏ đi cái asset kia giữ icon(tìm sau) thì sẽ nhỏ lại mà nhỉ
> với cả bố cục thâm tạo thì nên là icon xong bên dưới là tên, kế bên icon là 7202(ấn vào số hoặc cả cụm gồm icon
> luôn thì sẽ mở ra cái popup chỉ tiết thâm tạo)

Changes applied to C:
- 深造: no paper-ticket backing. Style emblem = the game's own `Speciality_<styleId>` sprite (MasterData
  `jobStyleMap.styleIcon`, already carried as `job_style.icon`), style name under it, the serial (7202) beside it; the
  whole unit is one button that opens a popup with the 4 columns (points + talents).
- Dòng thuộc tính: B's cells (tier heading + list), one cell per tier.
- Xoay vòng: a short tag under each skill icon, from the skill `slot` (skill1 → ATK, skill6 → SKILL, skill2 → ULT;
  full type name in the tooltip).
- Layout (after the owner asked "lỡ text ô số 4 dài / ô số 2 nhiều thuộc tính thì sao"): rows are pairs split at
  different columns so the vertical rules never line up (owner liked the staggered first version) — Vũ khí 5 | Dòng
  thuộc tính 7, Xoay vòng 4 | Thâm tạo 8 — only while both halves stay short (≤2 weapons, ≤3 tiers of ≤5
  affixes; ≤3 deepens, ≤2 rotations of ≤5 skills); past that each half takes the full width. Free text (Mẹo) is
  its own full-width module (2 columns on wide screens), then Đội hình. Empty blocks are not shown and the module
  numbers stay consecutive. Stress check: `direction-c-sheet.html?stress`.

Rotation data (owner showed the 新月 card for V0055 Thố Hình Đào Huân, 2026-09-28): a build needs several named
rotations (phases such as "Lượt đầu" / "Các lượt sau", or a condition such as "Tam Trí"), an optional note on a
rotation, and an optional note on one step ("dùng lên Thố Động"). Build doc shape to add (old `skillIds` read as
steps without notes, like `withDeepens`): `rotations: [{ label, note, steps: [{ skillId, note }] }]`. Display: label
left, rotation note above its sequence, step note under the step's ATK/SKILL/ULT tag, steps fixed width so the rows
line up. Any rotation note, >2 rotations or >5 steps → the rotation block takes the full width. Test case:
`direction-c-sheet.html?rot`.

Mẹo + Đội hình (owner's sketch 2026-09-28: small yellow box top-left, red L around it): when the tips are short
(≤5 tips, ≤500 characters) the tips box floats top-left inside one module and the team groups flow beside it, then
under it across the full width — an L-shaped team block. Long tips keep their own full-width row above the teams.
Phone: no float, tips then teams.

Taste pass (owner: "dùng taste skill thiết kế lại", after "bên team lại trống quá"; skill `design-taste-frontend`,
applied only where it fits a reference page, dials VARIANCE 6 / MOTION 2 / DENSITY 6):
- Team groups packed on a grid whose track ≈ one avatar (72px); a group spans tracks for its members, label and note,
  `grid-auto-flow: dense` backfills, so rows reach the right edge. Short tips = a box in the grid's top-left corner
  spanning N rows (the L); replaces the float + justified inline-blocks.
- Module headings plain sentence case (no "01"-style numbers, no uppercase tracked eyebrows).
- One radius (6px) for sheet, cells, buttons, popups; press feedback (scale .98) on weapon tiles and deepen units;
  7-pip bars without a filled track (empty pips are outlines).

Impeccable pass (2026-09-28; skill pbakaus/impeccable v4.4.0 copied into `.claude/skills/impeccable`, the npx installer
failed with HTTP 404; no hooks installed, no PRODUCT.md yet). Owner: "t lại thấy ko ưng cái chữ L nữa r".
- Mode Read/Operate: predictable structure and linear reading beat variation for its own sake → L dropped. Order:
  Vũ khí | Dòng thuộc tính, Xoay vòng | Thâm tạo (staggered), Mẹo (full width, 2 columns), Đội hình (packed grid).
- Detector fixes: `--text-subtle` #6B7280 is 3.6:1 on the surface (fails AA) → #858B94 (5.1:1) in the demo; the
  site token in `src/styles/tokens.css` has the same failure (needs the owner's ok, it changes every page);
  heading outline h3 → h4 (was h3 → h5); popover keeps its border and drops the 50px shadow. Inter flagged as an
  overused face: kept, it is the site's font.

`/impeccable critique` (2026-09-28, dual-agent, 22/40; snapshot `.impeccable/critique/2026-09-27T18-50-04Z__…`). Owner
choices after it: stagger **by content** (Vũ khí 4 | Dòng thuộc tính 8, Xoay vòng 6 | Thâm tạo 6; Thâm tạo right after
Vũ khí on ≤ 980 px), a **shared variant chip** (深造 labels = variants, weapon labels matched by prefix), phone fixes
(P0 clipped 4th weapon, compact affix rows, two 深造 side by side, "Xem thêm" for teams), popover cue + "Đóng" +
bottom sheet on phones, tag key + a11y labels, build name demoted. Recorded in the spec (C1–C4, §4.1) and the plan;
the demo HTML is not updated (the React build is the reference from here).

Implemented and **live 2026-09-28** (`b970d83`, verified on production W0182) in `src/features/characters/build/` (`BuildSheet.tsx`, `blocks/*`, `sheetLayout.mts`, `buildView.mts`) and `src/features/characters/styles/buildTab.css`.
