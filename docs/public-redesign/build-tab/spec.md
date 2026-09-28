# Build tab (public) — design spec for the three-direction round (2026-09-27)

Input shared by the three demos in `design-demos/`. Owner answers: public tab first (admin later); feel = **(a) a
content-creator build card** (dense, read at a glance, shareable as a screenshot — reference: the 新月 card for W0182)
**+ (c) a reference/lookup page** (easy to scan, clear sections — s1n.gg / wiki); no outside reference ("tự làm").

## What the page is
The **Build** tab of a character page on WHMX (Vietnamese wiki/calculator for 物华弥新). Visitors are players who
want to know, fast: which weapons, which affixes to roll, which 深造 (Thâm tạo) points, the skill rotation, and
who to team with. They arrive from the character page (desktop ~1 m, and phones ~40% of traffic).

## Content (real data, `w0182-data.js` = production build of W0182 Lý Tiểu Hài Hạng Liên)
1. **Build head**: build tabs (1–n builds per character; here one, "Chuẩn"), optional rating (empty here), summary
   ("Tham khảo build của 新月." — credit line).
2. **Vũ khí** (≤4): icon inside the game rarity frame `itemRare{rare}` (5 = multicolour, highest), name (CN until
   translated → small dot), free label ("Tốc độ | Sát thương", "Lục Trí, đơn mục tiêu"). Click → popup with the weapon
   skill (name + 6-level text).
3. **Dòng thuộc tính**: groups (tiers T0 / T2 / T3) of affix names, `%` shown for percent affixes; optional
   "Không cần tẩy luyện vũ khí".
4. **Thâm tạo**: 1–3 suggestions, each = label + style + 4 columns × points (0–7, total 11) + 7 talents per column
   (the reached ones matter). Here: "Chuẩn · 储能 7/2/0/2" and "Lục Trí · 威慑 7/2/2/0". Column/talent names are VI.
5. **Xoay vòng**: labelled sequences of the character's skill icons (job skill → ultimate → job skill → basic).
6. **Mẹo**: 4 short lines (the last one = affix targets).
7. **Đội hình**: 10 labelled blocks of avatars (22 characters) + optional note; avatars link to those characters.

## Constraints
- Dark only; colours only from `src/styles/tokens.css` (dark set; rarity tokens `--rarity-ssr/sr/r-*`).
  Fonts: Inter (body) + Noto Serif SC (display/CN), already loaded by the site.
- Weapon icon **smaller than the game** (owner): ~88% of the frame, nudged down a little, never touching the border
  (largest icon art is 107/128 px).
- 390 px mobile without horizontal page scroll; readable (body ≥14 px, labels ≥12 px, contrast ≥4.5).
- Untranslated game names: CN + small dot (same convention as the lore tab).
- Must stay implementable as React + TS where **each block is its own component with a slot for an edit action**
  (owner: later "Sửa build" / "Tạo build" buttons on the public page) — no layout that fuses blocks into one image.
- No decorative icons, no gradients-for-the-sake-of-it, no coloured side bars (huashu §6.2); one load animation max.

## Visual motif (content-born)
The game itself: rarity frames around items, the 深造 "ticket" pair (储能 7202 / 威慑 7220 printed like serial
numbers on the creator card), and the museum ticket already used by the lore tab.

## Output
One HTML per direction, 1440×900 desktop + 390×844 mobile screenshots, all with the same W0182 data.
