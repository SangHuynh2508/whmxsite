---
name: WHMX
description: Vietnamese wiki and calculator for 物华弥新 — dark archive, antique gold, the game's own sprites.
colors:
  night-ink: "#111315"
  archive-slate: "#17191C"
  lifted-slate: "#1C2024"
  hover-slate: "#22262B"
  hairline: "#2B2F34"
  strong-hairline: "#3D434A"
  input-hairline: "#34383D"
  bone-text: "#E3E5E8"
  ash-text: "#9097A0"
  antique-gold: "#D4B763"
  gold-wash: "#24221A"
  gold-hairline: "rgba(212, 183, 99, 0.30)"
  gold-divider: "rgba(212, 183, 99, 0.16)"
  scrim: "rgba(0, 0, 0, 0.6)"
  rarity-ssr: "#b93232"
  rarity-sr: "#c4a265"
  rarity-r: "#4e7091"
  rarity-ssr-text: "#F0A08F"
  rarity-ssr-on-fill: "#FFD6CC"
  rarity-sr-text: "#E7C96D"
  rarity-r-text: "#AFCDF1"
  rarity-ssr-vivid: "#F0564B"
  rarity-sr-vivid: "#F2C14E"
  rarity-r-vivid: "#4FA3F7"
  on-vivid: "#111315"
  tag-sky: "#8DB8F2"
  tag-coral: "#F2937F"
  tag-amber: "#F2B35E"
  tag-violet: "#C6A6F5"
  tag-steel: "#A9BCD0"
  tag-lime: "#B8D86B"
  tag-green: "#7FD39B"
  tag-pink: "#F29BB8"
  tag-magenta: "#E58AD0"
  tag-indigo: "#9FA8F5"
  tag-teal: "#7FD4CF"
  tag-neutral: "#C9CDD2"
typography:
  display:
    fontFamily: "Literata, 'Noto Serif SC', serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Literata, 'Noto Serif SC', serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.5
  title:
    fontFamily: "Literata, 'Noto Serif SC', serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  section:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  prose:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  serial:
    fontFamily: "Literata, 'Noto Serif SC', serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
    fontFeature: "tnum"
  chinese:
    fontFamily: "'Noto Serif SC', serif"
    fontWeight: 500
rounded:
  none: "0"
  sm: "6px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.antique-gold}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.archive-slate}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-slate}"
  button-ghost:
    textColor: "{colors.ash-text}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  input:
    backgroundColor: "{colors.lifted-slate}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  tab-page:
    textColor: "{colors.ash-text}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  tab-page-active:
    textColor: "{colors.bone-text}"
  tab-content:
    textColor: "{colors.ash-text}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  tab-content-selected:
    backgroundColor: "{colors.lifted-slate}"
    textColor: "{colors.bone-text}"
  chip-variant:
    textColor: "{colors.bone-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  chip-role:
    textColor: "{colors.tag-sky}"
    rounded: "{rounded.full}"
    padding: "2px 11px"
  popover:
    backgroundColor: "{colors.lifted-slate}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.sm}"
    padding: "16px 18px"
    width: "min(440px, calc(100vw - 32px))"
  build-sheet:
    backgroundColor: "{colors.archive-slate}"
    rounded: "{rounded.sm}"
  build-cell:
    backgroundColor: "{colors.lifted-slate}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  lore-ticket:
    backgroundColor: "{colors.archive-slate}"
    rounded: "{rounded.none}"
  weapon-tile:
    size: "96px"
---

# Design System: WHMX

<!-- Recorded 2026-09-28 by /impeccable document (scan mode) from the live site and src/styles/tokens.css,
     src/features/characters/styles/{buildTab,loreTab}.css, src/admin/layout/ui.tsx. Owner decisions of the same day
     are marked "canonical"; values that differ in older CSS are listed as drift, to be cleaned up separately. -->

## Overview

**Creative North Star: "The Night Archive" (Kho lưu trữ về đêm)**

WHMX is a museum archive read after closing time: charcoal rooms, one antique-gold lamp, catalogue cards and tickets
that are clearly paper, and the game's own artefacts (rarity frames, item icons, 深造 emblems) laid on them as
exhibits. The interface is quiet so the game content carries the colour. Two kinds of visit share it: the quick
lookup on a phone mid-game (dense, scannable, predictable) and the long read of a character's archive (serif,
generous line height, a measured column).

Density is medium-high on lookup surfaces (Build sheet, Thông Tin, Admin) and relaxed on reading surfaces (Hồ Sơ Lưu
Trữ). Depth comes from stepping the surface tone, not from shadows. Gold is rare and means something: a selected
state, a heading rule, a serial number, a focus ring.

The interface is **dark only** and must not scroll horizontally at 390 px (PRODUCT.md, binding). Untranslated text is
shown in Chinese with a small dot, never guessed.

**Key Characteristics:**
- Charcoal tonal layers (night-ink → archive-slate → lifted-slate); hairline dividers, no drop shadows.
- One accent: antique gold, used sparingly.
- IBM Plex Sans for interface, Literata for Vietnamese headings and reading, Noto Serif SC for Chinese (typography B,
  2026-09-28).
- One corner radius (6 px) with three deliberate exceptions.
- Game sprites are shown as the game draws them; the UI frames them, never redraws them.
- Motion explains a change: a selection ink that stretches to the new choice, text that arrives in reading order (see Components → Motion).

## Colors

A near-neutral charcoal ramp with a faint cool cast, one antique gold, and the game's rarity colours.

### Primary
- **Antique Gold** (`antique-gold`): the only accent. Selected tab underline, module heading rule under the Build
  band (2 px), tier headings in the affix cells, serials, the 7-pip bars, focus rings (2 px outline), the primary
  button fill. Text on a gold fill is night-ink, never white.
- **Gold Wash** (`gold-wash`): the gold tinted surface for notices ("chưa dịch" notice, Admin warnings).
- **Gold Hairline / Gold Divider** (`gold-hairline`, `gold-divider`): borders of archival objects (lore ticket,
  perforations, lore popover) and the lore timeline rule.

### Rarity (game colours, data-driven)
- **Crimson SSR / Antique SR / Slate-blue R** (`rarity-ssr`, `rarity-sr`, `rarity-r`): rarity marks and frames.
  Their `-text` variants are for text on the translucent rarity chips; the `-vivid` set is only for the catalogue
  filter chips (coloured text at rest, solid fill with `on-vivid` text when selected).

- **Buff keyword orange** (`#ff6724`, `.mechanic-keyword.status-keyword` in `style.css`): the colour the game's own
  skill text gives a buff/status name. Like the rarity colours it is game data, not a second UI accent (owner
  2026-09-28); keep it, and make it a token when that CSS is next touched.

### Neutral
- **Night Ink** (`night-ink`): page background.
- **Archive Slate** (`archive-slate`): cards, the Build sheet, the lore ticket, the nav rail, Admin headers.
- **Lifted Slate** (`lifted-slate`): things that sit on a card — affix cells, selected in-content tabs, popovers,
  inputs.
- **Hover Slate** (`hover-slate`): hover fill of rows and ghost buttons.
- **Hairline / Strong Hairline** (`hairline`, `strong-hairline`): dividers and resting borders / emphasised borders
  (sheet outline, popover outline, chips). `input-hairline` is the resting border of form fields.
- **Bone** (`bone-text`): primary text.
- **Ash** (`ash-text`): all secondary text — labels, captions, hints, notes. `--text-subtle` in code is the same role
  and will be merged into `--text-muted` (owner 2026-09-28); do not introduce a third grey.
- **Scrim** (`scrim`, token `--scrim`): the backdrop behind every popover (Build and Lore since 2026-09-28; the Admin dialog still mixes its own).

### Named Rules
**The One Lamp Rule.** Antique gold is the only accent. It marks state, structure or a number worth reading; it is
never a background wash on large areas and never decoration for its own sake.

**The Token Rule.** Colours come from `src/styles/tokens.css` only. A new colour is a new token, not a hex in a
feature file.

**Drift (legacy CSS, clean up later):** a second gold `#c7a86b` (15 uses) and the character-tab underline
`#c4a265` (= `rarity-sr`) instead of `antique-gold`; ~30 literal `rgba(212,183,99,x)` instead of the gold tokens;
`#fff`/`#ffffff` (47 uses) and white-alpha tab borders; teal `#23867f` (10 uses); `--text-secondary` used 5 times but
never defined; three scrims (60 %, 35 %, 70 % night-ink). The light-theme block in `tokens.css` is dead (the theme is
forced dark) and is not part of the system.

## Typography

**Display / heading font:** Literata (with Noto Serif SC, serif) — `--font-serif`
**Interface font:** IBM Plex Sans (with system-ui, sans-serif) — `--font-sans`
**Chinese:** Noto Serif SC — reached through `--font-serif`'s fallback (Literata has no CJK), so a Vietnamese name
and a Chinese one in the same run each get the right face

**Character:** IBM Plex Sans is an engineered, catalogue-like grotesque: crisp at 12–14 px, even tabular numerals for
build numbers, full Vietnamese. Literata, drawn for long reading, gives Vietnamese headings and the archive the
weight of a printed catalogue. Chinese sits in Noto Serif SC so an untranslated name reads as an original, not as UI.
Chosen by the owner from three options on real content (`docs/public-redesign/typography/`).

### Hierarchy
- **Display** (700, 26 px, 1.25, serif): the Hồ Sơ Lưu Trữ tab heading.
- **Headline** (700, 21 px, 1.5, serif): the character name in the detail header.
- **Title** (600, 20 px, 1.3, serif): the build name in the Build band; popover titles use 600 17 px serif.
- **Section** (600, 16 px, 1.3, sans): module headings ("Vũ khí", "Dòng thuộc tính"…), sentence case, no numbers.
  Lore section titles are 700 17 px serif over a 1 px full-width rule ("book" headings).
- **Body** (400, 15 px, 1.65, sans): lookup text. Lists and cells use 14 px; notes 13 px.
- **Prose** (400, 15–16 px, 1.75–1.85, sans): lore reading, max 66 ch, `text-wrap: pretty`.
- **Label** (500–600, 12–13 px, sans): tags, chips, captions, tab labels (13 px). **12 px is the floor for UI text**, except small secondary labels — rarity / LIMITED badges, acquisition chips, counters — which stay at 9.6–11 px on purpose (owner 2026-09-28: chữ phụ; not a finding).
- **Serial** (700, 30 px, serif, 0.14 em tracking, tabular numerals): the 深造 serial (7202); 22 px on phones. The
  lore "Mã hồ sơ" serial is monospace 600 14 px in gold — a record number, not a build code.

### Named Rules
**The Two Voices Rule.** Serif (`--font-serif`, Literata) speaks for the archive (names, headings, reading, serials);
IBM Plex Sans (`--font-sans`) speaks for the tool (labels, controls, data). Never name a font family in feature CSS —
use the two tokens.

**The Original Name Rule.** Untranslated text stays Chinese, set in Noto Serif SC, followed by a small ash dot
(one size for the whole site, 4–5 px today) and "(chưa dịch)" for screen readers. Never a guessed translation.

**Drift:** 30+ font sizes in legacy CSS (10–11.5 px, 12.5 px, 13.5 px, rem and px mixed; 128 undersized-text
findings from the detector); the Chinese name under the character title renders in the sans.

## Layout

- **App shell:** a left nav rail on desktop (renders 60 px; the `--app-nav-collapsed-width` token says 72 px —
  reconcile). Phones (≤ 768 px): no dock — a floating ☰ bottom-left (report badge above it) opens a full-screen menu
  with a global search (characters + skins) on top; mobile-nav direction A, 2026-09-28. Content max width ~1360 px on
  character pages.
- **Character page:** header (avatar, serif name, Chinese name, role chips, class icon + rarity badge) → page tabs → tab body. ≤ 768 px the "Danh Sách Khí Giả" button is dropped (system Back and the dock menu cover it) and the class icon + rarity sit small beside the Chinese name. Page tabs replace the history entry: Back leaves the character page.
- **Build sheet:** one bordered sheet: a band (name, rating, credit) over a 12-column grid whose 1 px gaps show the
  hairline colour — the gaps are the dividers, so they stay right whatever order the modules take. Paired modules
  are staggered by content (Vũ khí 4 | Dòng thuộc tính 8, Xoay vòng 6 | Thâm tạo 6) so the vertical rules never line
  up; long content takes the full width. ≤ 980 px every module is full width and Thâm tạo follows Vũ khí; ≤ 640 px
  padding drops to 16 px and popovers become bottom sheets.
- **Lore tab:** two columns — a 360 px sticky aside (image plate + ticket) and the reading column; one column below a
  760 px container width.
- **Admin:** Linear-like shell: 48 px view header, list + record; a record's side properties become a sticky right
  column only ≥ 1536 px and a collapsible block below 1280 px. A panel hidden at some width must appear somewhere
  else at that width.
- **Spacing scale (canonical):** 4 · 8 · 12 · 16 · 24 px. New work picks from these five. Existing 6/10/14/18/22 px
  values are drift and are left alone until that area is touched.

### Named Rules
**The 390 Rule.** Nothing scrolls horizontally at 390 px; if it does not fit, it wraps, stacks or becomes a sheet.

## Elevation & Depth

Flat by default. Depth is tonal: night-ink page, archive-slate objects, lifted-slate things on objects. Separation is
a 1 px hairline or a 1 px grid gap. Floating layers (popovers, dialogs) sit in the browser's top layer over the
scrim with a strong-hairline border and no shadow. Archival objects add a very faint SVG paper grain (lore ticket,
image plate, lore popover) — texture, not elevation.

### Named Rules
**The No-Shadow Rule.** Surfaces do not cast shadows. Legacy CSS has ~25 different `box-shadow` values; none is part
of the system, and new work does not add one.

## Shapes

One corner: **6 px** (`rounded.sm`) for sheets, cells, buttons, inputs, tabs, chips and popovers (Admin's Tailwind
`rounded-md` is the same 6 px). Three deliberate exceptions (owner 2026-09-28):
- **The lore ticket is square** (`rounded.none`) with concave corners and two tear-line notches — its silhouette is
  the point.
- **Avatars are circles.**
- **Role chips are pills** (`rounded.full`): Viễn Chiến, Sát Thương, Buff.

Everything else converges on 6 px when touched — today the character tabs are 3 px, the rarity badge 2 px, rarity
chips 4 px, the lore popover / quote / switch 8 px and the lore report tabs pills. Borders are 1 px; gold borders
belong to archival objects, hairlines to everything else. The image plate carries two gold corner brackets.

## Components

### Buttons
Tactile and quiet.
- **Shape:** 6 px corners, 32 px tall, 12 px side padding, 500 14 px sans.
- **Primary:** antique-gold fill, night-ink text, 600 weight. At most one per view.
- **Secondary (default):** archive-slate fill, strong-hairline border, bone text; hover-slate on hover.
- **Ghost:** ash text, no border; bone text on hover-slate on hover.
- **States:** press = scale .97–.98; focus = 2 px antique-gold outline, 2 px offset; disabled = 45 % opacity. Motion
  uses `--motion-fast` (120 ms) with `--ease-standard`; no press scale under reduced motion.

### Tabs
- **Page tabs** (character sub-nav: Tổng Quan … Thư Viện): framed tabs in one scrolling row; active = bone text,
  brighter frame and a 2 px antique-gold underline. Layout stays as it is.
- **In-content tabs** (build variants, lore report tabs, lore switch): 6 px, ash text; selected = bone text over a
  lifted-slate "ink" with a hairline border that slides between the buttons (see Motion).

### Chips
- **Variant chip** (build variants, 深造 labels): 1 px strong-hairline outline, 600 12 px bone text, 6 px. Weapon labels ("Đề cử", "Đi ải nhanh"…) are never chips: always the 12 px ash caption above the name (owner 2026-09-29).
- **Role chip:** outlined pill — the tag's own `--tag-*` colour on text and border (60 %), no fill (owner 2026-09-28, option C). Mapping in `src/ui/utils/tagColors.mts`; a test over `public/data.json` guarantees no two tags of one character share a colour; rare tags share `tag-neutral`.
- **Rarity chip / badge:** translucent rarity background with its `-text` colour; on the solid SSR badge fill the text is `rarity-ssr-on-fill` (6.1:1; `rarity-ssr-text` was 3.9:1).

### Inputs / Fields
- **Style:** lifted-slate fill, input-hairline border, 6 px, 36 px tall, 14 px text, ash placeholder.
- **Focus:** border turns antique-gold plus a 2 px gold-hairline ring. Disabled 55 % opacity.
- **Field label:** 500 13 px ash above; hint 12 px ash below.

### Popovers
The small window that opens from a weapon tile, a 深造 unit, a skill cue or a lore term.
- **Canonical (Build):** lifted-slate, strong-hairline border, 6 px, max 440 px, 16/18 px padding, 14 px/1.7 text,
  serif 17 px title with the game icon beside it, an "Đóng" button, scrim behind. ≤ 640 px it becomes a bottom sheet
  (full width, max 85 dvh, top corners rounded).
- **Archive variant (Lore):** same shape and behaviour (6 px, `--scrim`, "Đóng", phone bottom sheet) plus the
  gold-hairline border and paper grain.
- **Thâm tạo popover:** 560 px wide, its four columns (points + talents) in a 2 × 2 grid so it stays compact; on phones
  the pips drop under each column name (owner 2026-09-28).

### Motion
One vocabulary for the character-page islands (`src/features/characters/motion.ts`, GSAP, owner 2026-09-28: "ấn tượng
chút, đừng làm quá"):
- **Selection ink** (`useSlider`): the leading edge runs to the new choice (0.3 s, expo-out) and the trailing edge
  follows a beat later (0.55 s), so the ink stretches across and settles. No bounce.
- **Arrival** (`useReveal`): blocks and paragraphs come in reading order — 6 px rise (or 16 px from the side of the
  control pressed), 2 px blur → sharp (owner: "bớt mờ"), opacity 0 → 1, 0.6 s expo-out, the group starting within 0.3 s.
  Text uses this one arrival only — no split-letter or scramble effects (owner 2026-09-28: not a GSAP showcase).
- **Popover open:** 97 % → 100 % scale with a 6 px rise and fade (0.3 s); on phones the sheet slides up (0.42 s); the
  scrim fades in; closing is instant.
- **Expand** (`useHeightTween`): "Đọc tiếp / Thu gọn" and "Xem thêm" ease the box to its new height (0.45 s).
- **Reduced motion:** the ink jumps; arrival is a 0.15 s fade. Text is forced visible after 1.5 s if the page gets
  no animation frames.
- Tab bodies still cross-fade through `characterDetail.js` (GSAP, ~0.1 s out / 0.16 s in); the islands render
  synchronously so that fade measures the real height.

### Build sheet (signature)
- **Band:** name in serif title, rating as a gold block with night-ink text, credit line ("Tham khảo build của 新月")
  in 13 px ash; 2 px antique-gold rule underneath.
- **Modules:** 18/22 px padding on archive-slate, section heading + optional action slot (future "Sửa build").
- **Weapon tile:** the game's `itemRare{2..5,K}` frame as background (96 px), the item icon inset; label and name
  under it; hover lifts the icon 2 px.
- **Affix cell:** lifted-slate, 6 px, gold tier heading, list of affixes; compact rows on phones.
- **Rotation:** 46 px skill icons in fixed 64 px steps joined by "›", a short tag under each (ATK / SKILL / ULT /
  P1–P3) and an optional gold step note; a key line explains the tags.
- **深造 unit:** the game's `Speciality_<styleId>` emblem (60 px) with the style name under it and the serif serial
  beside it; the whole unit is one button that opens the Thâm tạo popover.
- **Teams:** 44 px circular avatars with a 2 px strong-hairline ring, packed on a grid of ~72 px tracks.

### Lore ticket (signature)
A museum admission ticket: square archive-slate card with gold-hairline border and grain; relic full name (500 15 px
serif) → facts (Loại / Niên đại / Nơi lưu giữ) separated by dashed gold perforations, each a button that opens a term
popover → a dashed tear line with two notches → stub (Trực thuộc | Bản thể) → "Mã hồ sơ" serial in gold monospace.
Clickable facts brighten from 80 % to 100 % opacity; no underline, no colour change. Beside it: the image plate with
two gold corner brackets. One load animation (plate and ticket rise 6 px), off under reduced motion.

### Admin shell
Linear-like and plain: 48 px view header (600 14 px title, 13 px ash meta, actions right), serif section titles over a
1 px rule, record pages with a sticky properties column on wide screens, notices in danger / warn washes mixed from
the rarity colours. Same tokens, 6 px corners and focus ring as the public site; thin 6 px scrollbars that show on
hover.

## Do's and Don'ts

### Do:
- **Do** keep the interface dark only and test every surface at 390 px for horizontal scroll.
- **Do** take every colour from `src/styles/tokens.css`; add a token before adding a colour.
- **Do** use 6 px corners, except the square lore ticket, circular avatars and pill role chips.
- **Do** pick spacing from 4 · 8 · 12 · 16 · 24 px in new work.
- **Do** show the game's own sprites (rarity frames, item and skill icons, `Speciality_*` emblems) as they are, copied
  from NeoArtifacts into `public/assets/`.
- **Do** show untranslated names in Chinese (Noto Serif SC) with the small ash dot and a screen-reader "(chưa dịch)".
- **Do** use one 2 px antique-gold focus outline everywhere.
- **Do** credit a borrowed build or guide on the sheet itself.

### Don't:
- **Don't** add drop shadows, glows or gradients; depth is tonal.
- **Don't** add a second accent colour or another grey for secondary text.
- **Don't** put coloured side bars before headings, "01"-style module numbers or uppercase tracked eyebrows.
- **Don't** set UI text below 12 px (small secondary labels excepted, see Typography).
- **Don't** redraw or restyle game assets, or guess a translation for an untranslated name.
- **Don't** hide a panel at some width without showing it somewhere else at that width.
- **Don't** use the light-theme tokens; they are not part of the system.
