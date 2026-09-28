# Public Build tab (direction C) + rotation notes — design

> Date: 2026-09-28. Status: **approved** (design "duyệt", spec reviewed → "tiếp đi"), extended with the critique decisions C1–C4; **implemented and live 2026-09-28** (`b970d83`, verified on production).
> Extends [`2026-09-26-character-build-design.md`](./2026-09-26-character-build-design.md) (data, admin, publish) — only
> the parts below change. Visual direction: [`public-redesign/build-tab/direction-approved.md`](../../public-redesign/build-tab/direction-approved.md)
> (C · Tấm thẻ build, with B's affix cells, taste + impeccable passes); the approved demo is
> `docs/public-redesign/build-tab/design-demos/direction-c-sheet.html` (`?stress` = limits, `?rot` = V0055 rotations).

## 1. Goal

Replace today's function-first Build tab (`BuildTab.tsx`, unstyled list) with the approved build sheet, and let a build
carry the rotation notes seen on creator cards (新月's V0055 card: named phases, a note on a rotation, a note on one
step). Success: W0182's production build renders as the approved demo at 1440 px and 390 px (no horizontal scroll), an
editor can enter a V0055-style rotation in Admin, and every block is its own component ready for a later public
"Sửa build" / "Tạo build" action.

## 2. Owner decisions (2026-09-28)

| # | Question | Decision |
|---|---|---|
| R1 | Rotation note data | `rotations: [{ label, note, steps: [{ skillId, note }] }]`; old `skillIds` converted on read/save/publish (like `withDeepens`) |
| R2 | Admin scope now | Minimal: reads/writes the new shape, one note input per rotation and per step; no admin redesign |
| R3 | 深造 style emblems | Game sprites `Speciality_<styleId>` (MasterData `styleIcon`, already published as `refs.job_style.<id>.icon`) copied to `public/assets/styles/` |
| R4 | Public edit actions | Slot only: each block takes an optional `action`; the sheet band has a slot for "Sửa/Tạo build"; nothing rendered yet, no session call |
| C1 | Layout after `/impeccable critique` (22/40, 2026-09-28) | Staggered **by content**: Vũ khí 4 \| Dòng thuộc tính 8, then Xoay vòng 6 \| Thâm tạo 6; on ≤ 980 px Thâm tạo comes right after Vũ khí |
| C2 | Chuẩn / Lục Trí variants | **Shared variant chip**: each 深造 label is a variant; a weapon whose label starts with a variant name shows that chip (rest of the label beside it). No data change |
| C3 | Critique fixes in scope | Phone (P0 clipped 4th weapon, compact affix rows, two 深造 side by side, teams beyond the 4th group behind "Xem thêm"), popovers (cue, close button, darker backdrop, bottom sheet on phones), labels + a11y (tag key under Xoay vòng, serial aria-label "7-2-0-2", CN names keep `lang="zh"`, no orphan dot) |
| C4 | Band | Build name demoted (tabs already name it); the 深造 serial is the largest text |
| — | Visual | Direction C as recorded in `direction-approved.md`: staggered pairs, emblem + serial 深造, ATK/SKILL/ULT tags, tips band, packed teams, plain headings, one 6 px radius, `--text-subtle` contrast fix (done 2026-09-28) |

## 3. Data

### 3.1 Build document (only `rotations` changes)

```
rotations: [{ label,                 // ≤ 60, e.g. "Lượt đầu", "Tam Trí"
              note,                  // ≤ 500, shown above the sequence
              steps: [{ skillId,     // one of the character's skills
                        note }] }]   // ≤ 60, shown under the step's tag, e.g. "dùng lên Thố Động"
```

- `withSteps(doc)` (pure, `server/builds/build-validate.mjs`, next to `withDeepens`): a rotation holding `skillIds`
  becomes `{ label, note: '', steps: skillIds.map((skillId) => ({ skillId, note: '' })) }`; anything else is left as is.
  Used by the validator, the admin read (`build-editor.mjs`) and the game document (`game-document.mjs`), exactly where
  `withDeepens` is used today.
- Validator: `rotations.<i>.note` (`TOO_LONG` > 500), `rotations.<i>.steps.<j>.skillId` (`UNKNOWN_SKILL`),
  `rotations.<i>.steps.<j>.note` (`TOO_LONG` > 60), a step that is not an object → `BAD_SHAPE`. A rotation still holding
  `skillIds` after `withSteps` cannot happen; an unknown key inside a rotation is ignored as today.
- Production: stored documents change shape only when saved again or republished (publish converts); no DB rewrite.

### 3.2 View model (`buildView.mts`)

Additions to what the view already returns:

- weapon: `frame` = `/assets/frames/itemRare{rare}.png` (`itemRareK` when the rarity is outside 2–5; weapons use 2–5).
- deepen: `icon` = `/assets/styles/{ref.job_style.icon}.png` (empty when the ref has no icon), `serial` = points joined
  (`"7202"`).
- weapon: skills whose name and text are both empty are dropped (no orphan "•"); `variant` + `labelRest` from C2.
- deepen: `variant` = its label (C2).
- rotation: `note`; each step = `{ id, name, type, tag, icon, note }` where `tag` comes from the character skill's `slot`
  (`skill1` ATK, `skill6` SKILL, `skill2` ULT, `skill3/4/5` P1/P2/P3, other → the type name) and `type` is the skill's
  own type text (tooltip). A published rotation still holding `skillIds` is read as steps without notes. Steps whose
  skill is missing are left out, as today.

## 4. Public UI

Files in `src/features/characters/build/` (React + TS island, mounted as today by `mountBuildTab`):

| Unit | Does |
|---|---|
| `BuildTab.tsx` | Build tabs when > 1, then `<BuildSheet>` for the selected build; island mount/unmount as today |
| `BuildSheet.tsx` | Band (name, rating chip, summary, `action` slot) + the grid of blocks from `sheetLayout` |
| `Block.tsx` | `<section>` with `<h3>` title + optional `action` next to it; takes the span class from the layout |
| `blocks/WeaponsBlock.tsx` | Rarity-frame tiles (icon 88 % of the frame, nudged down), label + name under; tile opens a native popover with the weapon skills |
| `blocks/AffixesBlock.tsx` | One cell per tier (h4 + list), "Không cần tẩy luyện vũ khí." line when set |
| `blocks/RotationBlock.tsx` | Per rotation: label left, note above the sequence, fixed-width steps (icon, tag, step note), `›` between steps |
| `blocks/DeepensBlock.tsx` | One button per suggestion (emblem, style name under it, serial + label beside) opening a popover: 4 columns, 7-pip bar (empty pips outlined), talents with reached ones bright |
| `blocks/TipsBlock.tsx` | Ordered list, 2 columns on wide screens |
| `blocks/TeamsBlock.tsx` | Packed grid (track ≈ one avatar, `span` from the layout, `dense` flow), avatars link to the characters, note under a group, "Khác: …" line |
| `sheetLayout.mts` | Pure: view → ordered blocks with span classes (see below) + `teamSpan(team)` |
| `Text.tsx` | VI, or CN with the untranslated dot (moved out of today's `BuildTab.tsx`) |

`sheetLayout(view)`:

- Order: Vũ khí, Dòng thuộc tính, Xoay vòng, Thâm tạo, Mẹo, Đội hình; an empty block is not returned.
- Pair 1 = Vũ khí (4) | Dòng thuộc tính (8) while `weapons ≤ 2`, `tiers ≤ 3` and every tier ≤ 5 affixes; else both 12.
- Pair 2 = Xoay vòng (6) | Thâm tạo (6) while `deepens ≤ 3`, `rotations ≤ 2`, every rotation ≤ 5 steps and no rotation
  note; else both 12. (C1: widths follow content — at 1440 the old 5|7 / 4|8 left Thâm tạo 42 % empty.)
- A pair whose partner is empty takes 12. Mẹo and Đội hình always 12.
- `teamSpan(t) = min(6, max(2, members, ceil(label.length / 9), ceil(note.length / 30)))`.

CSS `src/features/characters/styles/buildTab.css`, rewritten: site tokens only (`src/styles/tokens.css`), 12-column grid,
≤ 980 px every block full width, ≤ 640 px affix cells and rotation rows single column and team spans capped at 4, one
6 px radius, pressed state `scale(.98)` on tiles/buttons, popovers capped to the viewport height. Dark only is a product
constraint (PRODUCT.md); the tokens already carry both themes, nothing theme-specific is added.

### 4.1 Critique fixes (C1–C4)

- Variant chips: `variantOf(label, variants)` (pure, `buildView.mts`): variants = distinct non-empty 深造 labels, longest
  first; a weapon label equal to a variant, or starting with it followed by `,` `|` `–` `-` `:` `(` or a space, gets that
  variant, the remainder (separators trimmed) stays as its text. Chip style is neutral (not gold — gold already has too
  many roles), same on weapons and 深造.
- Phone (≤ 640 px): affix tiers as compact rows (tier label left, items inline); 深造 emblem 44 px so two units fit side
  by side; teams show the first 4 groups and a "Xem thêm N nhóm" button (state in `TeamsBlock`, `matchMedia`), desktop
  shows all; ≤ 980 px `order` puts Thâm tạo right after Vũ khí (DOM order stays the desktop order).
- Weapon row wraps; the sheet does not use `overflow: hidden` (it clipped the 4th weapon at 390 px).
- Popovers: a "Xem kỹ năng ›" / "Xem thiên phú ›" cue on the tile/unit, a "Đóng" button (`popovertargetaction="hide"`)
  in the popover head, backdrop 60 %, on ≤ 640 px a bottom sheet (full width, max 85 dvh).
- Labels + a11y: under Xoay vòng a one-line key built from the steps shown ("ATK = Đánh Thường · SKILL = Kỹ Năng
  Nghề · ULT = Tuyệt Kỹ"); 深造 button `aria-label` "Thâm tạo {style}: 7-2-0-2, {label}"; the weapon tile is labelled by
  its name element (which carries `lang="zh"` when untranslated).
- Band: build name 20 px; the serial (30 px) is the largest text on the sheet.

## 5. Admin (minimal)

- `src/admin/characters/lib/buildDoc.mts`: `rotations: { label; note; steps: { skillId; note }[] }[]`, new rotation =
  `{ label: '', note: '', steps: [] }`.
- `BuildModule.tsx` rotation editor: same skill chips (now steps), a note input under each chip, a note textarea per
  rotation. No other admin change.

## 6. Assets

- `public/assets/styles/Speciality_{101,102,103,201,202,203,301,302,303,401,402,403,501,502,503}.png` from
  `NeoArtifacts/Assets/Packet61_AllSprites/cf505fca6c96071b630baedc779241f6/`.
- `public/assets/frames/itemRare{2,3,4,5,K}.png` (the same sprites the demo uses).

## 7. Testing

- `build-validate.test`: `withSteps` converts `skillIds`; notes trimmed and limited (500 / 60); unknown skill in a step;
  step not an object; legacy document round-trips.
- `game-document.test`: a build saved with `skillIds` is published with `steps`.
- `buildView.test`: slot → tag mapping, style emblem path, serial, frame path, legacy `skillIds` rotation.
- `sheetLayout.test`: W0182 pairs (4|8, 6|6), each threshold flipping a pair to 12, empty blocks dropped, `teamSpan`.
- `buildView.test`: `variantOf` (exact, prefix + separator, no match, longest wins), empty weapon skills dropped.
- Browser (dev server): W0182 at 1440 and 390 px (no horizontal scroll), a 4-weapon build at 390 px (all visible), weapon + 深造 popovers, team links, impeccable
  `detect` clean except the site font; a dev-DB build with V0055-style notes saved in Admin and shown on the tab.

## 8. Out of scope

Public edit/create buttons and their auth (slot only), admin redesign, impeccable live mode, `DESIGN.md` (next task),
the site-wide detector findings (undersized UI text, rarity chip contrast) — for a later `/impeccable audit`.
