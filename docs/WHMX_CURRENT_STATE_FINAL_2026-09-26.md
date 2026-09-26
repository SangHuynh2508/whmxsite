# WHMX — Current state (single entry point, 2026-09-26)

> **Start here.** This file replaces every older `WHMX_CURRENT_STATE_*`, `WHMX_NEXT_STEPS.md` and the finished plans
> (removed 2026-09-26; they remain in git history). Read this file fully, then open only the references a task needs.
> Keep it current: when something changes, edit the relevant section here (don't create a new dated copy unless the owner asks
> for a session-end handoff).

## 0. Map of the documentation (every kept file)

| File | What it is for |
|---|---|
| **this file** | Status, infrastructure, rules, gotchas, backlog |
| [`WHMX_APP_ARCHITECTURE.md`](./WHMX_APP_ARCHITECTURE.md) | Where code lives; §11 publication model (Hướng B: static `data.json` + DB text overlay on R2); §12 source-of-truth boundaries |
| [`WHMX_ENGINEERING_PRINCIPLES.md`](./WHMX_ENGINEERING_PRINCIPLES.md) | How to write code here (per-entity resolvers, bounded changes) |
| [`WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20_v2.md`](./WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20_v2.md) | Deep background (still valid): runtime update pipeline, AssetBundle decrypt, R2/CDN, skin/series/acquisition invariants, localization workflow, NeoArtifacts history, closed paths. Its status/next-step sections (§11–§25) are superseded by this file |
| [`WHMX_MASTERDATA_ID_CONVENTIONS(5).md`](./WHMX_MASTERDATA_ID_CONVENTIONS(5).md) | Meaning of raw MasterData IDs — never infer semantics from ID shape |
| [`POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md`](./POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md) | DB design: §B authority, §D override/conflict model, §L importer, §M exporter |
| [`PREVIEW_CHARACTER_ASSET_ARCHITECTURE_PROPOSAL_2026-09-19.md`](./PREVIEW_CHARACTER_ASSET_ARCHITECTURE_PROPOSAL_2026-09-19.md) | Preview characters, managed assets, §5 Preview → official reconciliation |
| [`D0B_R2_MANAGED_ASSET_IMPLEMENTATION_2026-09-19.md`](./D0B_R2_MANAGED_ASSET_IMPLEMENTATION_2026-09-19.md) | R2 managed-upload pipeline (env vars, prefixes, flow) |
| [`ADMIN_AUTH_OPERATIONS.md`](./ADMIN_AUTH_OPERATIONS.md) | Admin accounts/auth operations |
| [`MASTERDATA_LORE_CANDIDATES_2026-09-07.md`](./MASTERDATA_LORE_CANDIDATES_2026-09-07.md) | Raw tables that hold lore/narrative (input for the future story-lore work) |
| [`plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md`](./plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md) | **Release-day runbook N2** (§4), P5 next domains, dated log of 24–26/9 |
| [`superpowers/specs/2026-09-24-lore-pipeline-design.md`](./superpowers/specs/2026-09-24-lore-pipeline-design.md) | Lore data model, importer, parity gates, R2 publish/backup design |
| [`superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md`](./superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md) | Admin Khí Giả + Lore spec (owner decisions Q1–Q15) |
| [`admin-redesign/direction-approved.md`](./admin-redesign/direction-approved.md) | Admin shell look (Direction B, 2026-09-23) |
| [`admin-redesign/khi-gia-direction.md`](./admin-redesign/khi-gia-direction.md) + [`khi-gia/direction-approved.md`](./admin-redesign/khi-gia/direction-approved.md) + [`khi-gia/design-demos/approved-mix.html`](./admin-redesign/khi-gia/design-demos/approved-mix.html) | Khí Giả/Lore visual spec (B workbench + C pairs, C list) — reuse for any new admin module |
| `../localization/reviews/WHMX_CHECKPOINT_2026-09-13_AFTER_BATCH2.md`, `../localization/PHASE3_WORKFLOW.md` | Localization batch workflow + open quality backlog (§8) |
| `../WHMX_COMMAND_CHEATSHEET.md` (untracked, owner's) | Copy-paste commands (NeoArtifacts, MuMu/ADB, validators, assets) — dates from 2026-09-15; prefer §5 below when they differ |
| `../.agents/skills/whmx-localization/SKILL.md`, `../.agents/skills/game-translator/SKILL.md` | Mandatory for any workbook / localization / `data.json` / translation work |
| `D:\BaiTapCode\WHMX\NeoArtifacts\RUNTIME_UPDATE_CAPTURE_RUNBOOK.md`, `…\HANDOFF_RUNTIME_ASSET_DISCOVERY_2026-09-10.md` | How game updates/assets are captured (MuMu + ADB) — used by runbook N2 |

## 1. What WHMX is

- Vietnamese wiki + calculator for the game 物华弥新 ("Vật Hoa Di Tân"). Public site **https://whmxsite.vercel.app** (Vercel project `siro-da-bao/whmxsite`).
- Repo `D:\BaiTapCode\WHMX\WhmxCalc` (GitHub, **public**): Vite + vanilla JS public site (migrated piecemeal), React 19 + TypeScript + Tailwind v4 Admin (`src/admin/`), serverless API under `api/` (4 of 12 Hobby functions), Neon PostgreSQL via drizzle (`db/`), Cloudflare R2 for images and lore JSON.
- Sibling folders: `D:\BaiTapCode\WHMX\NeoArtifacts` (game data extraction: MasterData JSON, assets, runtime updates), `WHMX_Lore_*` (story lore source text, not yet used).
- **Gameplay text flow:** NeoArtifacts `MasterData` → workbook `localization/localization_master.xlsx` (human translations; source of truth for gameplay text) → `tools/build_web_data.py` → `public/data.json` (committed) → site.
- **Lore flow:** character profiles, reports, relic info, timeline and lore terms live in the DB → published as versioned JSON on R2 (`lore/<env>/lore.<hash>.json` + pointer) → the site overlays it on `data.json` (CN fallback).
- **Admin** (`#/admin…`; signed-out visitors see `#/login`): Khí Giả (per character: Tổng quan / **Lore** / Trang phục / Nguồn / Lịch sử), Thuật ngữ lore, Preview (unreleased characters), Tài khoản (owner only).

## 2. Status (2026-09-26)

| Area | State |
|---|---|
| Git | Work on `feat/postgres-admin-crud`; `origin/main` = the same commit. Deploy with `git push origin HEAD:main` (Production) then `git push origin feat/postgres-admin-crud` (Preview). The **local `main` branch is stale (e140ade) and unused** — never check it out or merge into it; `origin/main` is what matters |
| Working tree (not mine to commit) | Many untracked/modified owner files (workbook, `localization/*`, root scratch files, `.agents/`, `.codex*/`). **`package-lock.json` is modified by an agent** (2026-09-26 00:43, side effect of a local `npx vercel build`): only `devOptional` → `dev` flags, no version changes — harmless; discard it with the owner's OK (`git checkout -- package-lock.json` counts as a restore) or leave it. Don't run `vercel build` locally again without cleaning up |
| Lore pipeline (DB → R2 → site) | ✅ Live. Importer `scripts/import-character-profile.mjs`; overlay `scripts/export-profile-overlay.mjs \| tools/apply_profile_overlay.py`; publisher `scripts/publish-lore.mjs` (+ `--repoint` rollback) and `POST /api/admin/lore/publish`; daily private backup in R2 bucket `whmx-backups`; restore `scripts/restore-lore-snapshot.mjs` |
| Admin Khí Giả (React) + Lore module + terms page | ✅ Live 2026-09-26. Code `src/admin/characters/` (list, record, modules, `useEditor`, pure libs `lib/*.mts` with tests); lore API `server/profile/lore-admin.mjs` + planners `lore-edit.mjs`, routes `server/admin-api-routes/lore.mjs` via `api/admin/[...].js`. Saves auto-publish lore ~30 s later; owners also have "Xuất bản ngay" |
| Lore data | 536 report titles ("Báo cáo quan sát 1–4", "Báo cáo mật A") + 10 organisation names seeded as admin VI (development + production); 15 characters still have legacy "bản cũ" units to confirm |
| Performance | Functions run in **sin1** (Neon is ap-southeast-1). Warm API 0.3–0.7 s; first call after idle ~3 s (cold start) |
| Tests | `npm test` (100, node:test, <2 s), `npm run test:tools` (Python tools), typecheck `node_modules/.bin/tsc -p tsconfig.json --noEmit`, `npm run build`. Validators: `python tools/validate_{data,public_output,skin_roster,skin_assets}.py` |
| New character (~2026-10-01) | Owner updates the game ~1 day before; then run **runbook N2** ([pipeline plan §4](./plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md), 8 steps, owner yes at each DB/workbook write) and N3 |

## 3. Infrastructure

- **Neon** project `empty-smoke-82458354`, region ap-southeast-1: branch `production` = real data (default; endpoint `ep-rapid-dust-azdtb39r`), `development` = copy for local work and Vercel Preview (`ep-blue-dust-azcwulyc`), `backup-2026-09-25` (no compute), `production-old-empty` (unused; delete later — ask the owner).
- **Env files** (git-ignored; secrets are the owner's, never printed): `.env` (R2 credentials), `.env.local` → **development** DB (safe to experiment; `server/load-local-env.mjs` fills it in when `vercel dev` doesn't), `.env.production.local` → **production** DB. Anything touching real data runs with `--env-file=.env.production.local`.
- **Vercel**: Production and Preview each have 10 vars — **as of 2026-09-26 the 4 secret ones (`BETTER_AUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `R2_SECRET_ACCESS_KEY`) are type Config with a "Needs Attention" badge**; owner to switch them to Secret (Vercel replaced the Sensitive toggle with Config/Secret on 2026-08-24; old Sensitive → Secret automatically) (DB, `BETTER_AUTH_SECRET`, `BETTER_AUTH_ALLOWED_HOSTS`, R2, `R2_MANAGED_ASSET_PREFIX` = `admin-prod` / `admin-dev`) + 9 lore config vars. Preview login works only on the branch alias `whmxsite-git-feat-postgres-admin-crud-siro-da-bao.vercel.app` (behind Vercel SSO). `vercel.json`: `regions: ["sin1"]`, `api/admin/*.js` `maxDuration: 30`. Cache headers (fixed 2026-09-26, test `server/vercel-cache-headers.test.mjs`): only Vite's hashed output at `/assets/<file>` is immutable for a year; stable-name files in `/assets/<dir>/…` (≈4 000 images copied from `public/assets`) get `max-age=3600, stale-while-revalidate=604800` (owner chose 1 h), so a corrected or newly uploaded image — or a 404 seen before upload — reaches returning visitors within about an hour. **Never add files under `api/`** (each counts as a function). `.vercelignore` must not exclude anything the server imports (`server/vercelignore.test.mjs`).
- **Deployments**: owner keeps only the **5 newest** Vercel deployments (80 removed 2026-09-26; storage was 7.9/10 GB, ≈95 MB per deploy because ~4 000 images in `public/assets` ship with every build). Prune after a batch of pushes: `npx vercel ls whmxsite --format=json` (paginate `--next`), check the Production alias is kept, `npx vercel remove <url> --yes`.
- **R2**: public bucket `whmx-assets` (images; `lore/{production,preview,development}/`), private `whmx-backups` (90-day lifecycle; never enable a public URL). Public base `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev`; asset keys listed in `asset-publish-manifest.json`.
- **Logs**: `npx vercel logs https://whmxsite.vercel.app --json` (CLI signed in as the owner). Unexpected admin errors are logged by `sendAdminError` (`server/admin-api.mjs`).

## 4. Admin / API facts an agent must know

- **Character/skin overrides** (`server/character-skin-admin-domain.mjs` `updateEntity`): `null`/empty or the (trimmed) source value clears the override — decision in the pure `planFieldChange` (tests `server/character-skin-admin-domain.test.mjs`; fixed 2026-09-26, before that `null` was stored as an *empty override*; none existed in dev/prod when checked). The React admin sends the source value for an emptied field (`src/admin/characters/lib/fields.mts`); the public inline edit (`src/features/characters/components/characterInlineEdit.js`, switched off until P5 — see §8) sends `null`.
- **Lore saves** (`PATCH /api/admin/lore/characters/:id`, `{expectedRevision, texts: {unitKey: string|null}}`): empty → `vi = null, viOrigin = null` ("chưa dịch"); text → `viOrigin = admin, state = ok` (also makes legacy / CN-changed units official); stale revision → 409; unknown unit → 422; one `edit_history` row per unit; `lore_publish_state.last_edit_at` updated. Terms: `PATCH /api/admin/lore/terms/:code`. Progress: `GET /api/admin/lore/progress`. Record: `GET /api/admin/lore/characters/:id`.
- Only `viOrigin = admin` + `state = ok` text is published (`publishableVi` in `server/profile/shape-character-profile.mjs`); `legacy_workbook` VI and `source_changed` units are withheld until re-saved.
- **Editor** (`src/admin/characters/useEditor.ts` + `lib/editorState.mts`): drafts in localStorage keep only changed fields and restore over the current record; 409 → "Xem khác biệt" / "Tải bản mới"; the leave-page guard is one capture-phase listener in `src/admin/layout/AdminApp.tsx` (`lib/leaveGuard.mts`); Ctrl+S works only while Khí Giả is visible.
- History rows carry `entityId` (character and skin rows share field names). `GET /api/admin/skins/:id` returns raw series/acquisition state rows; resolved names are in the character payload's `skins[]`.
- v2 public `department` = admin VI of the `ORG_*` lore term, else CN (the JS `DEPARTMENT_VI` map is used only by the legacy shape / parity gate).

## 5. Common commands

- DB migrations: `npm run db:migrate -- --target=development`; production `node --env-file=.env.production.local scripts/db-migrate.mjs --target=production` (owner yes).
- Publish lore: development `node --env-file=.env --env-file=.env.local scripts/publish-lore.mjs`; production `LORE_PUBLISH_PREFIX=lore/production/ node --env-file=.env --env-file=.env.production.local scripts/publish-lore.mjs` (owner yes).
- Profile importer sources (2026-09-26): characterFiles, characterFileTextMap, historicalRelicsMap (+ `tag1..tag4`), HistoricalTextMap, friendshipDescription, characterTable, TypeJJHMap, **characterSkins** (base skin = `bIsBaseSkin`), **characterLines** (`dropLineLanText` → unit `quote`). Migration 0006 (`lore_term_kind` + `relic_tag`) applied on development and production 2026-09-26.
- Importers (plan first; `--apply` needs owner yes): `scripts/import-character-skin.mjs --check`, `scripts/import-character-profile.mjs`.
- One-time seeds (applied everywhere; a re-run prints 0 writes): `scripts/seed-lore-admin-vi.mjs --part=titles|orgs [--apply]`.
- Local full stack: `preview_start whmxcalc-vercel-dev` (port 3003, development DB; config `.claude/launch.json`). `vercel dev` crashed twice on 2026-09-26 (connection reset) — for public-page-only checks use `preview_start whmxcalc-dev` (Vite, port 5173, reads `.env.local` → development lore pointer). Design demos: `preview_start design-demos` (port 8765, `docs/public-redesign/lore-tab/design-demos`; configs live in `D:\BaiTapCode\WHMX\.claude\launch.json`, the parent folder, which is what the app reads).

## 6. Owner rules (also in the agent memory `whmx-working-rules`)

- Reply in Vietnamese, "tôi/bạn". Short progress notes; spend tokens carefully: no subagents unless asked; review with `ponytail:ponytail-review`.
- Code with the `ponytail` skill; TDD (failing test first); evidence before "done". Anything that crashes, loses/changes data, saves the wrong thing or misleads the user is a **bug**, never a deferred "minor".
- Commit own files when verified; push `main` when the merged result is error-free. Never reset/restore/clean; never stage the workbook or other people's files (the tree has many untracked owner files: `localization/*`, root scratch files, `.agents/`, `.codex*/`).
- Production DB writes, Vercel config/env changes, account changes, deletions outside the project: show the exact action, wait for yes. The auto-mode classifier may block agent DB writes — then give the owner the exact command.
- Workbook only through `tools/safe_workbook_mutation.py`. `public/data.json` rebuilds: diff the whole file and show the owner.
- New UI: React + TypeScript, colours only from `src/styles/tokens.css`, dark-only, never the bare `hidden` class; new visual areas go through `huashu-design` (3 directions, owner picks) **together with** the taste-skill pack in `.agents/skills/` (`design-taste-frontend`, `high-end-visual-design`, `minimalist-ui`, `redesign-existing-projects`, …; owner 2026-09-26: huashu = the rule book of what not to do, taste = references from big sites). The taste skills also control reveal effects: anything the owner may dislike after testing must be removable in one place. Motion: CSS / View Transitions first, GSAP only with the owner's OK.
- Scratch on drive D (`D:\BaiTapCode\WHMX\_claude_scratch\`); nothing left on C; delete `%LOCALAPPDATA%\Temp\claude\bash-edit-diff` at the end of each work block.
- Repo is public: never commit screenshots with emails or anything secret.
- Evidence rule: nothing inferred from ID shape; MasterData must match the live launch version before importing.
- **When the owner asks for a state/handoff file, write it complete**: every change you made and left uncommitted (incl. side effects of tools, e.g. lockfiles), local vs remote branch state, pending questions, decisions taken, what was verified and what was not. The next agent must not have to ask about anything you already knew (owner, 2026-09-26).

## 7. Environment gotchas

- `vercel dev` (CLI 59.25, Node 24, Windows) sometimes crashes with `0xC0000409` → restart. First API calls take 8–15 s (cold). Check port 3000 isn't the owner's own `vercel dev`.
- `vercel build` / `vercel dev` locally ignore `.vercelignore` — an ignored import only fails after upload. Verify important changes on the real deploy.
- The built-in browser pane can stop responding; **Playwright MCP** works: open `localhost:3003`, the owner signs in once in that window, drive it with `browser_run_code_unsafe`. When its window isn't in front, Chrome paints few frames (smooth scroll finishes late). Neither can click native `confirm()` — stub `window.confirm`. `innerText` applies CSS uppercase — use `textContent`.
- npm: one command at a time, in the background, no short timeout (a killed install once left a half-installed package).
- Authenticated tests without the owner: temp account via a one-off `scripts/_tmp-*.mjs` (`provisioningAuth.api.signUpEmail`, random password, set the role in the DB), then delete in FK order `character_publication_states` → `edit_history` → `preview_characters` → `managed_entities` → `admin_account_audits` → `users`; owner approval first (DB write). The `scripts/db-*` proof/test scripts use random passwords and report failed cleanup via `scripts/lib/cleanup.mjs` `cleanupFailed` (logs `[cleanup failed]`, exit code 1) — never `.catch(() => undefined)` on a DB cleanup step (2026-09-26; both DBs had no leftover test users then). Run on development 2026-09-26: `db-admin-auth-test`, `db-admin-password-reset-proof`, `db-d2-character-skin-proof`, `db-preview-admin-test`, `db-preview-admin-api-test` PASS (the last one needed a retry: Neon cold-start `CONNECT_TIMEOUT`); `db-owner-bootstrap-proof` needs a DB with **no owner** — by design it can't run on development/production; the server/browser proofs (`db-d2-browser`, `db-d2-local-vercel`, `db-local-vercel-auth`) were not run.
- ocr (`open-code-review`) is installed but has no LLM key (owner declined paid keys).

## 8. Backlog (everything unfinished, collected from all old docs)

> ## ⚠️⚠️ OWNER WILL FIX LATER — DO NOT FORGET: skill ↔ buff POPUPS and ORPHAN SKILL TRANSLATIONS ⚠️⚠️
> The owner has seen **many** broken popup cases on the site (more than the validator lists). Not fixed yet, on purpose — the owner will do it in a later session. Evidence (`python tools/validate_data.py`, 2026-09-26: 30 warnings, data still "passes"):
> - **Popups:** skill text names a buff but the popup can't be resolved by the exact BUFF_STATUS VI name (e.g. A007005 / A007003ex `Buff_SpecialDamgeP_Lan`, A007302 `Buff_Bleed`), or a coloured buff has no popup target (A006106 `Buff_Disarm`).
> - **Translations like the buffs:** localized skills with no public record (S0155061, W0134061, D018305ex_2/3, W002104ex) — check whether they belong to a record under another ID before deleting anything.
> - Also listed there: 3 missing item icons (`itemicon_10140/20140/9183002.png`).
> Start with a read-only triage of every warning + the owner's own cases; workbook edits only via `tools/safe_workbook_mutation.py` with the localization skills.

| Item | State / next action |
|---|---|
| Owner: translate lore in Admin; confirm the 15 characters' legacy units ("Dùng bản này") | Ongoing |
| Release day (~2026-10-01): runbook N2 → N3 (DB import of the new character; Preview reconciliation if one exists, see the Preview proposal §5) | Waiting for the game update |
| Public inline edit ("Sửa" on a character's Tổng quan tab, `src/features/characters/components/characterInlineEdit.js`) | **Switched off 2026-09-26** (owner choice): the call in `views/characterDetail.js` is removed because admin overrides are not public until P5 and after emptying a field the page showed blank while the server kept the source. Re-enable with P5, and fix L142 then (show the source after an emptied save) |
| Publish path for character/skin **names/descriptions** (Admin overrides are invisible publicly) — needs the **workbook reconciliation gate** decision (hosted edit = working override; export blocks unreconciled overrides) | Not started (P5) |
| P5 next domains: Hoán Chương, archive-image asset role, skills (translation frame) | Not started |
| Public lore tab "Hồ Sơ Lưu Trữ" | **Live 2026-09-26** (plan `superpowers/plans/2026-09-26-public-lore-tab.md`; design `public-redesign/lore-tab/direction-approved.md` = B4 museum ticket + book headings). Tab order: … Build · **Hồ Sơ Lưu Trữ** · Thư Viện (gallery always last). Code `src/features/characters/lore/` (`loreView.mts` pure + tests, `LoreTab.tsx` island), CSS `features/characters/styles/loreTab.css`. Shows: untranslated notice, intro, relic origin/timeline, reports; ticket = relic name, Loại / Niên đại / Nơi lưu giữ / Kỹ thuật (tag1) / Nơi khai quật (tag2) / Nơi sản xuất (tag3) / Khác (tag4 = 其他, confirmed via wiki), laid out 3 per row with the last row filled evenly (`factSpans`), each opening a description popup (hover brightens the text, footnote under the ticket), stub + serial. **No text-reveal effect** (owner: only on skins). The **recruit-line quote** (unit `quote`) is shown on **Tổng Quan** (bottom of the Hồ Sơ Khí Giả block, “ ” marks) via `mountLoreQuote` in `LoreTab.tsx`; it does not count for the lore tab's untranslated notice. Production lore published `lore.d32aa1ac0d31.json` |
| **Localization → PostgreSQL authority transfer**: owner decision 2026-09-26 — yes, but only after the DB has every feature it needs; not now | Deferred by decision |
| Localization quality (2026-09-13 checkpoint: Han leaks, 42-cell rich-text repair, suspicious VI) | **Re-checked clean 2026-09-26** (read-only): `validate_no_han_characters` 0/8 907 populated VI, `validate_placeholders` 0/8 800, `check_suspicious_vi` 0 (scope phase3_batch1), `validate_public_output` 0. These only look at *populated* cells — untranslated (empty VI) coverage is a separate question. Batch #3 not started |
| **Analytics** | Vercel Web Analytics records every hash route (`src/app/analytics/pageRoute.mts` → `pageview({route, path})` on hashchange, `inject({disableAutoTrack:true})` in `boot.js`). **Google Analytics: not used** (owner 2026-09-26 — it needs cookies/consent). Analytics does not affect SEO |
| **Character Build tab** | Spec written, waiting for owner review: [`superpowers/specs/2026-09-26-character-build-design.md`](./superpowers/specs/2026-09-26-character-build-design.md) (DB-first reference import + builds in DB → R2). Then design (huashu + taste), plan. **Next after it: Tier list** (s1n.gg-style curated lists: tiers with a description line, variant badge, tile → build). **Info/database section** (Vũ khí, Item tabs) later reuses the weapon popup |
| **SEO** (owner asked 2026-09-26) | Not started. Hash URLs (`#/characters/…`) are one page to search engines: only `/` is indexed and every share shows the same title/preview. Real gains need path URLs (history routing + Vercel rewrite to `index.html`), a per-page `<title>`/description/Open Graph, `sitemap.xml` + `robots.txt`, and ideally prerendered character pages. Needs a design/decision round |
| **Voice lines (通讯记录)** — owner 2026-09-26: later, on a **separate route** (not the lore tab). Only the base skin's recruit line (`dropLineLanText`) is imported now, as unit `quote`. Source: MasterData `characterLines.json` (142) + `CharacterLinesLanMap.json` (23 variants); not imported anywhere yet | Not started (later) |
| Story lore (`WHMX_Lore_*`, candidates in `MASTERDATA_LORE_CANDIDATES_2026-09-07.md`) | Not planned |
| Future admin areas: Skill/Buff DB + translation, Guide, Tier List, admin audit/operations | Not started |
| Logged-in admin check at 768–1279 px (icon column) | Not verified (375 px verified) |
| Preview-URL admin check (sign in on the Preview alias; a save must not touch production) | Owner, needs Vercel SSO |
| Shared S3 client; lore restore by date | Deferred review items |
| Legacy admin CSS in `src/style.css` ~L6980–7240 (mixed with public classes) | Cleanup |
| "Layered ticket asset" rarity visual | Idea |
| Owner decisions: delete Neon `production-old-empty`; repo public vs private; untracked leftovers (`localization/*` data, root scratch files) | Pending |

**Known limits (by design):** a cancelled "Rời trang?" still adds one browser-history entry; "Dùng bản này" is a click and is not kept in the browser draft.

**Deferred on purpose (don't start without the owner):** runtime HTTP transport reverse, Packet61 card reconstruction, parked buff-closure auto-apply, mass JS → TS rewrite, big-bang reorganisation (reasons in the 09-20 handoff §22/§29).

## 9. Skills the owner expects

`superpowers:brainstorming` → spec → `superpowers:writing-plans` → `superpowers:executing-plans` (native) for features (the owner likes all questions at once, each with a recommendation); `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion` for every change; `ponytail:ponytail` for coding and `ponytail:ponytail-review` for review; `huashu-design` for new visuals; `.agents/skills/whmx-localization` + `game-translator` for translation work.
