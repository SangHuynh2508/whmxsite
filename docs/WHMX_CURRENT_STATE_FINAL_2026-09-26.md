# WHMX — Current state / handoff (2026-09-26)

> Newest handoff. Then `docs/WHMX_NEXT_STEPS.md`, and the dated log in `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §7.
> Infrastructure (Neon branches, env files, Vercel vars, R2) is unchanged: see `WHMX_CURRENT_STATE_FINAL_2026-09-25.md` §2.
> API facts learned in phase 1 (override semantics, drafts, history entityId): `WHMX_CURRENT_STATE_FINAL_2026-09-25_v2.md` §2.

## 1. Where things stand

| Area | State |
|---|---|
| **Git** | `feat/postgres-admin-crud` = `main` = `ebdd0b9` (pushed). Hotfix after release: lore routes returned 500 on Vercel because `.vercelignore` excluded `asset-publish-manifest.json` (test `server/vercelignore.test.mjs` now guards imports); functions moved to **sin1** (Neon is ap-southeast-1; iad1 made every record open cost ~10 trans-Pacific queries, 3–4 s). Unexpected admin errors are now logged (`sendAdminError`). |
| **P4 Admin Khí Giả + Lore** | ✅ Phase 1 and phase 2 done and live. Lore module (`src/admin/characters/modules/LoreModule.tsx`), terms page (`LoreTermsView.tsx`), lore API (`server/profile/lore-admin.mjs` + planners `lore-edit.mjs`, routes in `server/admin-api-routes/lore.mjs`). Saves auto-publish to R2 after 30 s; owners have "Xuất bản ngay". |
| **Lore data** | Report titles (536) and organisation names (10) seeded as admin VI on development and production; lore published to both (`lore.0da4b45cac21.json`). v2 department comes from `lore_terms`. |
| **New character (~2026-10-01)** | Unchanged: runbook N2 (pipeline plan §4) on the pre-release game update, owner yes at each DB/workbook write. |

## 2. Next steps

1. **Owner:** sign in on whmxsite.vercel.app → Khí Giả → a character → Lore; translate/confirm a unit and watch "Đã lên site." (production data; my checks used development).
2. Translate lore in Admin (133 characters; 15 have legacy "bản cũ" units to confirm with "Dùng bản này"); terms page for relic types/eras/museums.
3. Separate spec: public lore UI (layout of images/text, inline lore edit for editors) and `char.archive` in data.json (patch in `D:\BaiTapCode\WHMX\_claude_scratch\archive_build_change.patch`).
4. Server fix still open from phase 1: `updateEntity` treats `null` as an empty override (public inline edit sends `null` when a field is cleared) — make `null` clear the override and compare `normalizeText(source)`.
5. Release day: runbook N2.
6. Older owner decisions: `production-old-empty` deletion, repo public/private, uncommitted leftovers (`docs/admin-redesign/screens/` has an email), Preview-URL admin check.

## 3. Known limits (by design, not bugs)

- A cancelled "Rời trang?" leaves one extra browser-history entry (the browser creates it before the guard runs); Back needs one more press.
- "Dùng bản này" / "Giữ bản dịch" is a click, not text: it is not kept in the browser draft.
- ocr (`open-code-review`) is installed but needs an LLM key; not configured (owner declined paid keys).

## 4. Environment gotchas (new)

- Vercel function logs: `npx vercel logs https://whmxsite.vercel.app --json` (CLI is signed in as the owner). `vercel build` locally does NOT apply `.vercelignore` — an ignored import only fails after upload.

- The built-in browser tools stopped working mid-session; **Playwright MCP** works: `vercel dev` via `preview_start whmxcalc-vercel-dev`, open `localhost:3003` in Playwright, the owner signs in once in that window, then drive it with `browser_run_code_unsafe`. Playwright writes snapshots/logs to `D:\BaiTapCode\WHMX\.playwright-mcp\` (outside the project).
- When the Playwright window is not in front, Chrome paints few frames: smooth scrolls finish late — measure over a few seconds before calling it broken.
- The auto-mode safety classifier blocks agent-run DB writes; the owner runs them (or grants a permission rule). Production writes always need the owner's yes anyway.

## 5. Skills used

`superpowers:writing-plans`, `superpowers:executing-plans` (native, ledger), `superpowers:test-driven-development`, `ponytail:ponytail` + `ponytail:ponytail-review` (review, per the owner), `superpowers:verification-before-completion`.
