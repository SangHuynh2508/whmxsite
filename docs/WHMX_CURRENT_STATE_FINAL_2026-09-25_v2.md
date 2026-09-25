# WHMX — Current state / handoff (2026-09-25, evening)

> **Superseded by `WHMX_CURRENT_STATE_FINAL_2026-09-26.md`** (P4 phase 2 done). §2 API facts here still apply.

> Newest handoff; supersedes `WHMX_CURRENT_STATE_FINAL_2026-09-25.md` for "what's next" (that file's
> infrastructure section §2 is still accurate and not repeated here). Then read `docs/WHMX_NEXT_STEPS.md`
> and the dated log in `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §7.
> Environment gotchas: `WHMX_CURRENT_STATE_FINAL_2026-09-23_v2.md` §3 (plus §4 below).

## 1. Where things stand

| Area | State |
|---|---|
| **Git** | `feat/postgres-admin-crud` = `main` = `aa2fa41` (both pushed). Repo public. |
| **P4 phase 1 — Khí Giả React** | ✅ Done and live. Plan `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md` (all tasks ticked). Design: record = B workbench with C bilingual pairs, list = C register (`docs/admin-redesign/khi-gia-direction.md`, gate `docs/admin-redesign/khi-gia/direction-approved.md`, prototype `docs/admin-redesign/khi-gia/design-demos/approved-mix.html`). Code `src/admin/characters/`. Vue removed. |
| **Login** | Signed-out visitors see `#/login` (never `#/admin…`); after sign-in they return to the page they asked for. Password show/hide toggle. Local `vercel dev` sign-in works again (session endpoint now loads `.env.local` first). |
| **P4 phase 2 — Lore module** | Not started. Needs its own plan (`superpowers:writing-plans`) from spec `docs/superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md` §4–§5 + owner follow-ups below. The owner expects Lore next ("chưa có lore"). |
| **New character (~2026-10-01)** | Unchanged: runbook N2 (pipeline plan §4) on the pre-release game update, owner yes at each DB/workbook write. |

## 2. Things learned this session (important for phase 2)

- **Override API semantics:** `updateEntity` (server/character-skin-admin-domain.mjs) clears an override only when it receives the *source value*; `null` is stored as an *empty override*. The React admin sends the source value for an emptied field (`src/admin/characters/lib/fields.mts`). The spec's "empty → null" (§4, plan Review Focus 2) was wrong for this API. Lore's own PATCH (spec §4: "empty → null back to chưa dịch") is a different endpoint and can define null properly — do it on purpose.
- **Drafts:** store only changed fields (`changedDraft`), restore over the current record; the reducer's `source` ties a draft to the record it was hydrated from. Hydrate waits for the record (no prompt over a skeleton).
- **History rows** now carry `entityId` (character and skin rows share field names like `name_vi`).
- **`GET /api/admin/skins/:id`** returns raw series/acquisition state rows; resolved names come from the character payload's `skins[]`.
- The server writes `human_edit` for clears too (history never shows "Trả về gốc").

## 3. Next steps (in order)

1. **Owner:** sign in on whmxsite.vercel.app → Khí Giả, open a character, edit + revert one field (production data; my checks were on the development branch).
2. **P4 phase 2 plan** (Lore module + terms page + one-time seeds), then execute. Owner follow-ups to include: scroll-spy (unit list follows the scroll), phone back-to-top (exists on records; keep for Lore), relic Loại/Triều đại/Bảo tàng show VI from `lore_terms` or CN + "chưa dịch" + link to the terms page.
3. **Server fix (tracked from the final review):** treat `null` as "clear override" and compare `normalizeText(source)` in `updateEntity`; the public inline edit (`src/features/characters/components/characterInlineEdit.js`) still sends `null` when a field is cleared → empty override (no public effect yet: character/skin overrides have no publish path).
4. Release day: runbook N2.
5. Deferred minors (from the review): stale draft after manual undo; Ctrl+S reaches the hidden Khí Giả editor while Preview/Accounts is open; malformed `%` in the hash crashes the admin root; save OK but reload failed shows "Không thể lưu"; collapsed dock drops the safe-area inset; 409 "show differences" not built; no unit test for the leave guard; legacy admin CSS in `src/style.css` ~L6980–7240 (mixed with public classes, separate cleanup).
6. Older open items from the previous handoff §3 still apply (Preview-URL admin check, `production-old-empty` deletion, repo public/private, uncommitted leftovers incl. `docs/admin-redesign/screens/` with an email).

## 4. Environment gotchas (new)

- `vercel dev` (CLI 59.25.4, Node 24, Windows) still crashes occasionally with `0xC0000409`; restart it (`preview_start whmxcalc-vercel-dev`). First calls take 8–15 s (cold functions).
- The embedded browser pane stops painting when the app window is hidden: View Transitions then wait for a frame and route changes look stuck. Real browsers are fine. For automated checks, set `document.startViewTransition = undefined` in the page, and stub `window.confirm` (the pane can't click native dialogs).
- `innerText` applies CSS `text-transform` (uppercase captions) — use `textContent` in checks.

## 5. Skills used this session

`superpowers:executing-plans` (native, ledger in `.superpowers/sdd/…`, removed at the end), `superpowers:test-driven-development` (every fix red → green), `ponytail:ponytail` + `ponytail:ponytail-review` (after Tasks 6 and 8), `superpowers:requesting-code-review` template for the final independent review (opus agent), `superpowers:verification-before-completion`. Design follow-ups came from the huashu step (`huashu-design`, earlier session).
