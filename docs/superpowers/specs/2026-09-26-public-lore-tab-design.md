# Public lore tab ("Hồ Sơ Lưu Trữ") — design

> Date: 2026-09-26. Status: **draft, waiting for owner review.** Owner answers to Q1–Q7 given in chat on 2026-09-26 (below).
> Visual design is **not** decided here: after this spec is approved, the look goes through `huashu-design` (3 directions, owner picks)
> **and** the owner's `taste-skill` pack (`.agents/skills/design-taste-frontend`, `high-end-visual-design`, `redesign-existing-projects`, …:
> reference-quality patterns), with huashu as the rule book. Folding/expanding of reports is part of that UI step, not of this spec.

## 1. Goal

Players can read each character's lore on the public site in Vietnamese, with the Chinese original wherever it is not translated yet.
Today the lore overlay (DB → R2 → `mergeLoreOverlay` into `char.profile`) is loaded on every visit, but the public pages only show
`record_id`, `department`, `staff_status`, `entity_status`; the intro, 536 reports, relic info and timeline are never shown.

Success: every one of the 133 characters has a tab that shows all of its lore text (VI or CN + "Chưa dịch"), its archive image when one
exists, and nothing breaks when the overlay or an image fails to load.

## 2. Owner decisions (2026-09-26)

| # | Question | Decision |
|---|---|---|
| Q1 | Where | New tab **"Hồ Sơ Lưu Trữ"** next to Tổng Quan / Thông Tin / Thiên Phú / Build / Thư Viện |
| Q2 | Untranslated text | Show the CN with a small **"Chưa dịch"** label |
| Q3 | Archive images | Already on R2 (`characters/<id>/archives/<id>.webp` + `head_<id>.webp`, 268 files / 134 characters in `asset-publish-manifest.json`) → only wire them into `data.json` |
| Q4 | Reports | Show **all** of them; how they fold/expand is decided in the UI design step |
| Q5 | Editing on the public page | Not now. Signed-in owner/editor sees a **"Sửa trong Admin"** link to `#/admin/characters/<ID>/lore`. Inline lore edit comes later, after the public inline edit is fixed (P5) |
| Q6 | Text reveal effect | Use the existing skin effect (`src/ui/loreReveal.js`) **only** on the tab heading / short intro, never on long reports; off under `prefers-reduced-motion`. Must be removable in one place if the owner dislikes it after testing |
| Q7 | Lore-term tooltips in text | Later |

## 3. What the tab shows (content, not layout)

From `char.profile` (v2 overlay shape, `server/profile/shape-character-profile.mjs`), in this order:

1. **Archive image** (`char.archive.image`, and `head` as the small/secondary image) — only when `char.archive` exists.
2. **Relic facts**: `relic_info.type`, `era`, `museum` — each `{cn, vi}`.
3. **Evaluation intro**: `eval_intro_vi` ?? `eval_intro`.
4. **Reports** (`reports[]`, all kinds — basic "Báo cáo quan sát 1–4" and secret "Báo cáo mật A"): `title_vi ?? title`, `content_vi ?? content`,
   plus the unlock condition when present (`unlock_name_vi ?? unlock_name`, `unlock_level`).
5. **Relic intro**: `relic_info.intro_vi ?? intro`.
6. **Timeline**: `relic_info.timeline[]` — `label_vi ?? label`, `story_vi ?? story`.

Rules:
- One rule for every text unit: VI if non-empty, else CN + "Chưa dịch". A unit with neither is not rendered; a section with no units is not rendered.
- `relic_info` may be `{}` (no relic entry) — the relic sections simply don't render.
- Text is rendered as plain text (escape everything; keep `\n` line breaks). No HTML from data.
- If the overlay failed, `char.profile` still holds the CN from `data.json` (legacy shape: no `_vi` keys, `relic_info` has `relic_name/dynasty/museum/intro`) —
  the tab must render that shape too (CN + "Chưa dịch"), not crash.

## 4. Architecture

- **Data, game channel:** `tools/build_web_data.py` emits `char.archive = {image, head}` from the R2 manifest — the prepared patch
  `D:\BaiTapCode\WHMX\_claude_scratch\archive_build_change.patch` as-is (its category `archive` already maps to the R2 folder `archives` in
  `tools/asset_publish_manifest.py` `REMOTE_CATEGORIES`, and `require_asset_url` fails loudly on a missing manifest entry). `public/data.json` is rebuilt; the **whole diff is shown to the owner before commit** (§6 rule). Only `archive` keys may change.
- **Data, lore channel:** unchanged. No new API, no DB change, no R2 change.
- **Tab wiring:** `characterDetail.js` gets a sixth tab link `#/characters/<slug>/lore` and a `case 'lore'` in `renderTabContent`;
  `router.js` accepts the new tab name (same as the existing ones).
- **Tab content:** a React + TypeScript island (precedent: `src/app/layout/AppNav.tsx` mounts with `createRoot`), e.g.
  `src/features/characters/lore/LoreTab.tsx` + a pure `lib/loreView.mts` that turns `char` into the list of sections/units (VI/CN/“Chưa dịch”,
  v2 + legacy shape). The island is unmounted when the tab changes (no leaked roots).
- **Editor link:** `getSession()` + `isAuthorizedEditor()` (already used by the old inline edit) → link to `recordHref(id, 'lore')` from
  `src/admin/characters/lib/route.mts`.
- **Reveal effect (Q6):** one constant `LORE_TAB_REVEAL = true` and one call site in `LoreTab.tsx`; removing the effect = delete that call.
- Colours only from `src/styles/tokens.css`, dark theme, no bare `hidden` class, CSS / View Transitions for motion (GSAP only with owner OK).

## 5. Errors and edge cases

- Overlay missing → CN from `data.json` (legacy shape) with "Chưa dịch" everywhere.
- Archive image 404/slow → image area collapses or shows a neutral placeholder; text unaffected.
- Character without `profile` → tab shows one short line ("Chưa có hồ sơ lưu trữ"), not an empty page.
- Direct link `#/characters/<slug>/lore` for a character works on first load (same as other tabs).

## 6. Testing

- `lib/loreView.test.mts` (node:test, TDD): VI/CN choice per unit, "Chưa dịch" flag, empty units/sections dropped, `relic_info: {}`,
  legacy shape, secret report kind, timeline order.
- Python: build test that `archive` is emitted only when both files are in the manifest (`npm run test:tools`).
- Browser (built-in pane or Playwright), on local **and** the deployed site: a translated and an untranslated character, a character without
  relic info, direct link, tab switching back and forth, 375 px and desktop widths, reduced motion, no console errors.

## 7. Out of scope

Inline lore editing on the public page (Q5, later), lore-term tooltips (Q7), story lore (`WHMX_Lore_*`), any translation work, admin changes.
