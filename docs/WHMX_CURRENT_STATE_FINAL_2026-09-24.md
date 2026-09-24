# WHMX — CURRENT STATE FINAL (2026-09-24)

This file **supersedes** `WHMX_CURRENT_STATE_FINAL_2026-09-23_v2.md` for day-to-day work. That file stays valid for its environment gotchas (§3: temp-account testing pattern, `vercel dev`, npm rules), which are not repeated here.

## 0. Read order for a fresh agent

1. `docs/WHMX_NEXT_STEPS.md`: index of plans and the old ordered items.
2. **This file.**
3. `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md`: the **active** plan. Its §0 lists every reference, §1 the owner decisions, §2 verified data flow and findings, §3 status, §4 new-character work (N1–N3), §5 pipeline phases (P0–P6), §6 **global order**, §7 log.
4. `docs/plans/WHMX_ADMIN_PLAN_2026-09-23.md`: Admin UI plan. Parts A/B/C/E done; F folded into the pipeline plan; D deferred.
5. `docs/WHMX_APP_ARCHITECTURE.md` (note §4 React TARGET and §11 publication, both updated 2026-09-24) and `docs/WHMX_ENGINEERING_PRINCIPLES.md`.
6. `docs/WHMX_CURRENT_STATE_FINAL_2026-09-23_v2.md` §3 for environment gotchas.
7. Before touching the workbook, `data.json` or translations: `.agents/skills/whmx-localization/SKILL.md` and `.agents/skills/game-translator/SKILL.md`.

## 1. Working rules (owner, still in force)

- **Git:** no commit, push, merge, reset, restore or clean unless the owner asks. Run `git status --short` in `WhmxCalc/` before editing; the tree has a large, mixed, uncommitted diff from several sessions.
- **Workbook:** never touch `localization/localization_master.xlsx`, except through the established safe tools with owner approval.
- **Neon DB:** any write or delete on the live DB needs the owner to see the exact row list and say yes first. This includes migrations, importer runs, temp accounts and new roles.
- **npm:** one command at a time, in the background, with no short timeout.
- **UI:** new UI is written in **React + TypeScript**, public or Admin, and legacy JS is migrated when touched (owner, 2026-09-24).
  - Never use the bare `hidden` class in React (write `max-md:hidden`).
  - Colours only from `src/styles/tokens.css`.
  - The app is dark-only.
- The owner writes in Vietnamese; answer in Vietnamese.

## 2. What changed this session (2026-09-23 → 24)

### 2.1 Admin Part C: direction B promoted (verified live with owner and editor temp accounts)
- `src/admin/layout/AdminApp.tsx` is the shell. Views live in `src/admin/preview/PreviewView.tsx`/`PreviewDetail.tsx` and `src/admin/users/AccountsView.tsx`; primitives in `src/admin/layout/ui.tsx`; the NAV array in `src/admin/layout/nav.ts` (shared with the global nav).
- Removed: `_design-exploration/`, the dev `?direction=` switch, `previewWorkspace.js`, `usersPanel.js`, MoltenMetal/StarBorder, `ogl` and `tw-animate-css` (npm). Also the shadcn colour theme in `globals.css`, which nothing used; colours come from tokens.
- **Plain-language fields:** editors see "Mã nhân vật trong game", "Căn cứ" (stored as `claimedRawIdEvidence.note`) and "Nguồn thông tin". Owners also get "Nâng cao" (raw JSON) and "Thông tin kỹ thuật". The round-trip logic is in `src/admin/preview/evidence.js`; check it with `node src/admin/preview/evidence.check.mjs`.
- **Server bug fixed** in `server/preview-characters/preview-character-domain.mjs`. In zod 4, `.default({}).optional()` wiped `manualMetadata`/`claimedRawIdEvidence` on any PATCH that omitted them. Patch fields now use `jsonPatchValue` (no default).
- Temp accounts and test rows were deleted. The DB holds only the owner Siro, plus the owner's own "g/h" preview.

### 2.2 Global navigation in React (Admin Part E + follow-ups)
- `src/app/layout/AppNav.tsx` is one React root holding the **desktop rail** and the **mobile bottom dock**. The static rail markup in `index.html`, `appNav.js`, the old `.top-nav` and router.js highlight/click wiring were deleted. `router.js` now exports `calculatorHash()`.
- **Rail:** one `.app-nav-indicator` slides to the active item (it is placed without a slide on first paint and slides 0.32 s afterwards).
- **Dock (≤768 px):**
  - 🔍 / ☰ / ˅; ☰ is in the middle and morphs ☰↔✕ with `morphicons/react` (installed at owner request) using lucide icon data.
  - The ☰ sheet is a native modal `<dialog>` with a fade + rise CSS animation (`@starting-style`, `allow-discrete`).
  - ˅ collapses to a ˄ tab with a slide animation; the state is kept in localStorage.
  - Icon stroke is 2.5.
  - When signed in, the sheet shows the "Quản trị" group (from `nav.ts`) plus Đăng xuất.
  - A 64 px background under the bar prevents content peeking through.
- **Admin widths:** below 768 px there is no Admin sidebar (the dock replaces it); 768–1279 px shows a 56 px icon column; 1280 px and up shows the full sidebar.
- `signOut()` in `src/app/auth/session.js` is shared. `AdminApp` listens to `whmx:session-change`, so a logout from the dock updates Admin.
- `tsconfig.json` now includes `src/**/*.tsx`.

### 2.3 Public inline edit (character page)
- Empty editable fields (full name, nickname) are always rendered with the global `.hidden` class and revealed in edit mode (`overviewView.js`, `characterInlineEdit.js`).
- Inputs now read `char[field]`, not the rendered text. This fixes a bug: an empty `name_vi` showed the CN name, which would then be saved as the VI name.
- The owner tested it: D0183 Huyễn Hý Đồ now has `field_overrides.nickname_vi = "cốt"` (revision 3). This is **real data**; keep it unless the owner says otherwise. It does not show on the public site after a reload because nothing publishes DB edits yet (the pipeline, below).

### 2.4 New-character readiness, N1 (done)
- Hard-coded roster counts were replaced by counts derived from raw MasterData:
  - `scripts/import-character-skin.mjs` also gained **`--check`**: validate sources only, no DB;
  - `tools/validate_skin_roster.py`;
  - `tools/validate_skin_assets.py`.
- Real data gives the same results (133/145/10); a simulated +1 character/+1 skin passes; a missing workbook row is reported by ID.
- The release-day runbook is N2 in the pipeline plan. A new character is expected around 2026-10-01 and goes through the **old** pipeline.

### 2.5 Data pipeline: design approved, not built
The owner chose **Hướng 2**: DB-centred, migrated one domain at a time, **lore first**, and the pipeline before the UI. The design has four approved sections (full detail in the pipeline plan §2 "P0 design"):
1. **Model + importer.** Tables `character_profiles`, `profile_texts` and `lore_terms`. Each unit keeps its CN source + VI; the DB is the authority. The importer:
   - reads the raw profile tables, including the relic **timeline** and report **unlock levels** (affinity names from `friendshipDescription.json`);
   - seeds the 195 legacy workbook VI cells once;
   - imports only characters already in the DB (`W0021` is an NPC and is excluded).
2. **Exporter:** per-entity resolvers with a two-step byte-parity gate. K/T/S codes are resolved to text, since the current `data.json` leaks raw codes like `K1027`. **Legacy VI is not published** until someone re-saves that unit in Admin.
3. **Publish (architecture §11 updated):** game data stays in git (`public/data.json`). DB-owned text is published as **versioned JSON on R2** (pointer swap), automatically about 30 s after an Admin save plus an owner button. No commits, no GitHub Actions.
4. **Backup, images, Preview:**
   - backup is a daily private R2 snapshot (a JSON dump, not an image) because Neon keeps only 6 h of history;
   - archive (hiện vật) images go to R2 like card/drawing;
   - Preview never carries lore.

## 3. What to do next (see the pipeline plan §6 for the full global order)

1. **Write the spec** `docs/superpowers/specs/2026-09-24-lore-pipeline-design.md` from the four approved sections, then run a self-review. Ask the owner to review it and **do not commit it** (the git rule overrides the brainstorming skill's "commit the spec"). After approval, use `superpowers:writing-plans` for the implementation plan and let the owner pick the execution method.
2. **On release day (~2026-10-01):** run N2 (runbook in the pipeline plan §4), then N3 (DB import + profile importer, with owner approval).
3. **Pending owner decisions and approvals:**
   - merge `feat/postgres-admin-crud` ↔ `main` (they diverge 36/1; `main` is the default and production branch; confirm Vercel's Production Branch);
   - a temp account to verify the logged-in Admin icon column at 768–1279 px;
   - the migration and first run of the profile importer (DB writes);
   - an R2 lifecycle rule for backups.
4. **Open gaps** (not scheduled):
   - D2.4.1 Vue CMS 409 flow unverified;
   - `scripts/db-*-proof/test.mjs` use fixed passwords and swallow cleanup errors;
   - **Department bug (live today):** 所属 is keyword-guessed and is wrong or empty for 26 characters; the real source is `characterTable.typeJJh` → `TypeJJHMap.json` (see the pipeline plan §2). Decide whether to fix it in the old pipeline now or wait for the lore exporter;
   - story lore (`../WHMX_Lore_*`) is unplanned.

## 4. Environment gotchas learned this session

- **Hidden Browser pane.** When the in-app Browser pane is hidden, `requestAnimationFrame`, CSS transitions and a `<dialog>`'s `close` event are **deferred**. Force a frame with a screenshot before concluding something is broken. Screenshots from the pane can be cropped; verify with DOM and computed styles.
- **CommonJS package.** `package.json` is `"type": "commonjs"`, so Node treats `.js`/`.ts` imported from a `.mjs` check script as CJS. `src/admin/preview/evidence.check.mjs` loads the ESM helper through a `data:` URL instead.
- **Browser automation in the Admin SPA.** Admin forms are uncontrolled: set values via `form.elements.namedItem(...)` (not `form.name`, which is the form's own attribute) and submit with `requestSubmit()`. The Preview view stays mounted but hidden in other sections, so scope DOM queries by `aria-label`.
- **Cold starts.** `vercel dev` functions cold-start slowly (10–20 s for the first sign-in, sign-out or PATCH); wait before assuming failure.
- **Git facts.** The repo `SangHuynh2508/whmxsite` is **public** and its default branch is `main`. `public/data.json` is 14.6 MB on a single line (1.8 MB gzipped), and the profile block is 6.2 % of it. `../NeoArtifacts` (MasterData, raw assets) is **not** in the repo.
- **Neon.** Project `Whmxsite` (`empty-smoke-82458354`), free-plan limits: 6 h point-in-time history, 512 MB per branch.
