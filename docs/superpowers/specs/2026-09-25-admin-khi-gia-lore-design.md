# Admin Khí Giả (React) + Lore module — design spec

> Date: 2026-09-25. Status: sections 1–5 approved by the owner in chat on 2026-09-25; this file writes them down. Awaiting owner review of the file.
> Builds on: `docs/superpowers/specs/2026-09-24-lore-pipeline-design.md` (DB, publish, backup — live), `docs/plans/WHMX_ADMIN_PLAN_2026-09-23.md` Part F (approach 2 "module workspace"), `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` (P4).

## 1. Goal and scope

Replace the Vue "Khí Giả" admin with a React module workspace, put the Admin on the production site, and add a Lore module so editors translate the 133 characters' profile/lore text (intro, observation reports, relic info, relic timeline) and the 139 shared lore terms. A save is final (no review step) and reaches the public site through the existing R2 lore publish about 30 s later.

Two phases, each shipped on its own:
- **Phase 1 — Khí Giả React at feature parity + Admin on production.**
- **Phase 2 — Lore module + Lore terms page.**

Out of scope (separate specs later): public lore UI and inline lore editing on the public page (owner: own spec for layout of images/text), translation queue view, glossary hints while translating, skills/talents/Hoán Chương translation, uploading/replacing archive images.

## 2. Owner decisions (2026-09-25)

| # | Decision |
|---|---|
| Scope | Lore is a module inside a rebuilt Khí Giả (Part F approach 2), not a separate area; the Vue island is replaced |
| Visuals | Redesign from scratch with the `huashu-design` skill (3 directions first, owner picks), like Preview; the old UI is not ported. Code follows the `ponytail` skill |
| Motion | Designed in the huashu step, implemented after the UI: CSS transitions / View Transitions API first, GSAP only where they fall short; respect `prefers-reduced-motion` |
| Q1 layout | Two columns on desktop (CN read-only left, VI right), stacked on phones; VI auto-grows, keeps line breaks, character count, focus/fullscreen for long reports |
| Q2 saving | One Save/Discard bar per module saving all dirty fields; Ctrl+S; leave-page warning; browser draft |
| Q3 titles | One-time fill: 观察报告1–4 → "Báo cáo quan sát 1–4", 加密报告A → "Báo cáo mật A" (536 cells; list approved before writing) |
| Q4 legacy VI | The 150 workbook cells are shown pre-filled with a "bản cũ" badge; saving makes them official |
| Q5 source changed | Warning plus the previous CN; the unit stays off the site until re-saved |
| Q6 terms | Separate "Thuật ngữ lore" page; the character record links to it and says edits affect every character |
| Q7 organisations | Seed the 10 organisation names into `lore_terms` as admin VI; remove the JS `DEPARTMENT_VI` fallback (Python map stays for the legacy build/parity gate) |
| Q8 term editing | Owners and editors |
| Q9 modules | Tổng quan · Lore · Trang phục · Nguồn · Lịch sử; in-place editing, no modal |
| Q10 list | Lore progress per character + filters |
| Q11 archive images | Shown read-only in the Lore module (already on R2) |
| Q12 public inline lore edit | Moved to the public-lore-UI spec |
| Q13 public lore UI | Separate spec |
| Q14 hosting | Neon option A (below); Production and Preview both get the Admin, each on its own branch |
| Q15 mobile | Optimised equally for phones and desktop |

## 3. Structure

Routes (hash router, inside the existing "Khí Giả" nav entry):
```
#/admin/characters                 list
#/admin/characters/terms           Lore terms page
#/admin/characters/:id             record, default module
#/admin/characters/:id/:module     record, module = overview | lore | skins | source | history
```
- The record has a module rail (left on desktop, horizontal scroll tabs on phones). Modules are React components registered in one array; a new module is one entry.
- Shared primitives, written once:
  - `OverridableField` — source value vs override, "revert to source" (today's `field_overrides` model).
  - `BilingualText` — CN read-only | VI editable, status badge (chưa dịch / bản cũ / tiếng Trung đã đổi), auto-grow, character count, fullscreen.
  - `SaveBar` + 409 handling, `HistoryList`, browser-draft helper.
- Code: `src/admin/characters/` (replaces `src/admin/character-skin/`). When parity is confirmed, the Vue workspace and the `vue` dependency are deleted.
- Server: `/api/admin/characters` and `/api/admin/skins` are reused as they are. New lore routes go through the existing `api/admin/[...].js` dispatcher — **no new Vercel function** (Hobby limit 12; 4 used).

## 4. Data and API

No new tables: `character_profiles`, `profile_texts`, `lore_terms`, `managed_entities.revision`, `edit_history`, `lore_publish_state` already exist.

| Route | Behaviour |
|---|---|
| `GET /api/admin/lore/characters/:id` | Units (unitKey, sourceCn, vi, viOrigin, state, previous CN from the import audit when `source_changed`), referenced terms, structure (reports + affinity unlock, timeline slots), archive image URLs, history, profile revision |
| `PATCH /api/admin/lore/characters/:id` | `{expectedRevision, texts: {unitKey: string \| null}}`. Unknown unitKey for this character → 422. Stale revision → 409. Each saved unit: `vi` trimmed, empty → null (back to "chưa dịch"); `viOrigin = admin`, `state = ok`, `vi_updated_by/at`; one `edit_history` row per unit; profile revision +1; `lore_publish_state.last_edit_at = now` |
| `GET /api/admin/lore/terms` | All terms with usage count (characters referencing each code) |
| `PATCH /api/admin/lore/terms/:code` | `{expectedRevision, nameVi, detailVi}`; same rules (409, audit, revision, last_edit_at) |
| `GET /api/admin/lore/progress` | Per character: total units, translated (admin + ok), legacy, source_changed — one grouped query |
| `GET/POST /api/admin/lore/publish` | Already exists. After a successful lore save the client debounces 30 s then POSTs; the "Xuất bản ngay" button is owner-only in the UI |

Rules:
- Legacy VI is pre-filled; "Dùng bản này" marks the field dirty so Save makes it official.
- Permissions: any active admin (owner or editor) reads/writes lore and terms.
- Rendering: VI text is shown with React (escaped); no `innerHTML`.

One-time data steps (each: exact row list shown, owner yes, then write; run against production via `.env.production.local`):
1. Report titles: 536 `profile_texts` rows `report.*.title` with `source_cn` 观察报告1–4 / 加密报告A → the approved VI, `viOrigin = admin`, actor = owner.
2. Organisation names: 10 `lore_terms` `ORG_*` → the current `DEPARTMENT_VI` names, `viOrigin = admin`. Then delete the JS `DEPARTMENT_VI` map in `server/profile/profile-code-maps.mjs` (v2 department = admin VI, else CN).

## 5. UI behaviour (visuals come from the huashu step)

- **List:** search by name/ID; lore filter (all / not finished / has legacy / CN changed); each row: avatar, name, ID, lore progress (e.g. 12/20). Entry to the terms page at the top.
- **Record:** header (image, name, ID) + module rail; module in the URL (Back works, links shareable).
  - Tổng quan: name, full name, nickname, tags via `OverridableField`.
  - Trang phục: skin list; selecting a skin opens its editor in place (name, description, obtain).
  - Nguồn: source values (read-only) and snapshot info. Lịch sử: all edits across modules.
  - Lore: groups Giới thiệu → Báo cáo 1–4 (+ báo cáo mật) with affinity unlock ("Mở khoá: Lộc Minh") → Hiện vật (images, type, era, museum, intro) → Dòng thời gian. Terms show their name and link to the terms page.
- **Saving:** SaveBar shows the dirty count; Ctrl+S; leave-page prompt on module/character change and tab close; browser draft with "restore?" on reopen. 409 keeps what the user typed and offers "load the new version (yours stays in the draft)" or "show differences". After a lore save: "Sẽ xuất bản sau 30 giây…" → "Đã lên site"; errors shown with a "chưa xuất bản" hint.
- **Terms page:** grouped by kind; name + long description bilingual; "đang dùng bởi N nhân vật" (click for the list); in-place save with revision/409.
- Accessibility: labelled fields, keyboard-usable, visible focus, reduced motion respected.

## 6. Infrastructure (Phase 1, each step owner-approved; secrets pasted by the owner)

Neon (project `empty-smoke-82458354`) today: `production` (primary, unused since 2026-09-19) and `development` (child, holds all real data; endpoint `ep-rapid-dust-azdtb39r`).
1. Create `backup-2026-09-25` from `development`.
2. Rename `production` → `production-old-empty` (deletion later, owner asks).
3. Rename `development` → `production`, set it as the default branch (endpoint and connection string unchanged).
4. Create a new `development` from `production` for local work and Vercel Preview.

Environment:

| Where | DB branch | Variables |
|---|---|---|
| Vercel Production | `production` | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` (new), `BETTER_AUTH_ALLOWED_HOSTS` (whmxsite.vercel.app + its aliases), `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, `R2_MANAGED_ASSET_PREFIX`, `DB_HEALTHCHECK_SECRET` (Secret type) |
| Vercel Preview | `development` | same set, own `BETTER_AUTH_SECRET`, host pattern for preview URLs (verify the wildcard form during implementation) |
| Local `.env.local` | `development` | owner updates `DATABASE_URL*` |
| Local `.env.production.local` (new, git-ignored) | `production` | used only for deliberate production work: release-day import, production lore publish, production migrations (`--env-file=.env.production.local`). Runbook N2 and the migrate instructions are updated accordingly |

Go-live check on `whmxsite.vercel.app`: owner login, Khí Giả list, Preview list, a save + revert; on a Preview URL: login works and a save does not touch production data; measure `POST /api/admin/lore/publish` duration (raise the function `maxDuration` in `vercel.json` if close to the limit). Before going live, the temporary `design-review-…` owner account is removed or disabled (owner asked first).

## 7. Testing

- Pure logic with TDD (`npm test`): lore PATCH validation and write plan, progress counting, term PATCH, 409 decisions, dirty-field tracking and browser-draft helpers (`.mts` modules).
- API integration against the `development` branch only.
- Playwright on desktop and phone viewports: login; edit/save/revert; two tabs → 409; draft restore; leave-page prompt; long report in fullscreen; lore save → auto-publish → file on R2 `lore/development/`.
- Parity checklist Vue → React before deleting the Vue workspace.
- Final independent whole-branch review at the end of each phase.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Losing typed translations | browser draft, leave-page prompt, 409 keeps the typed text |
| Two editors overwrite each other | revision + 409 |
| Wrong Neon branch operation | backup branch first |
| Publishing copy-branch data to production | `.env.production.local` separation, runbook update |
| XSS through translations | React escaping in Admin; public overview already escaped |
| Publish function timeout (~1.1 MB document) | measured at go-live; `maxDuration` in `vercel.json` if needed |
| Test owner account on a public site | removed/disabled before go-live |

## 9. Order of work

Phase 1: (1) infrastructure §6 → (2) huashu: 3 directions for list, record, bilingual field + motion intent; owner picks → (3) shared primitives → (4) list + record with Tổng quan, Trang phục, Nguồn, Lịch sử → (5) parity check, delete Vue + dependency → (6) motion → (7) review, deploy.

Phase 2: (8) lore/terms/progress API → (9) Lore module → (10) terms page → (11) one-time data steps §4 → (12) auto-publish + owner button + unpublished hint → (13) review, deploy.
