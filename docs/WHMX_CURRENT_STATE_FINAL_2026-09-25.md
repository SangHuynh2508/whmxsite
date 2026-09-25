# WHMX — Current state / handoff (2026-09-25)

> **Superseded for next steps by `WHMX_CURRENT_STATE_FINAL_2026-09-25_v2.md`** (P4 phase 1 done); §2 infrastructure here is still current. Originally: Newest handoff. Read this, then `docs/WHMX_NEXT_STEPS.md` (order), then the active plan
> `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md`. The data-pipeline plan
> `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` has the full dated log of 2026-09-24/25.
> Environment gotchas from `WHMX_CURRENT_STATE_FINAL_2026-09-23_v2.md` §3 still apply.

## 1. Where things stand

| Area | State |
|---|---|
| **Git** | Work on `feat/postgres-admin-crud`; `main` fast-forwards to it (last pushed to main: `1b3df49`; branch is a few docs commits ahead). Repo on GitHub is **public**. |
| **Production site** | whmxsite.vercel.app = `main`. Lore from R2 (`lore/production/`), department fix, V0053 buff fix, deterministic data.json, skin avatars, XSS-escaped profile fields, Admin Direction B login + Preview + Tài khoản + Vue Khí Giả, **Admin login works** (Vercel env vars set 2026-09-25). |
| **Lore pipeline (P1–P3)** | ✅ Live. DB tables `character_profiles`/`profile_texts`/`lore_terms`/`lore_publish_state`; importer `scripts/import-character-profile.mjs`; overlay `export-profile-overlay.mjs \| apply_profile_overlay.py`; publisher `scripts/publish-lore.mjs` (+ `--repoint` rollback) and `POST /api/admin/lore/publish`; restore `scripts/restore-lore-snapshot.mjs`; backups in private R2 bucket `whmx-backups` (90-day lifecycle). 150 legacy VI cells stored, never published. |
| **P4 Admin Khí Giả + Lore** | Spec approved. Phase-1 plan approved (native execution, ponytail). **Task 1 ✅** (infra, below). **Task 2 in progress: 3 design directions shown (A Gallery / B Workbench / C Catalogue), waiting for the owner's pick** — `docs/admin-redesign/khi-gia/direction-review.md`, screens in `docs/admin-redesign/khi-gia/screens/`, prototypes `design-demos/*.html` (open with `#record` / `#list`). After the pick: write `docs/admin-redesign/khi-gia-direction.md` (plan Task 2 step 3) and `direction-approved.md`, then Tasks 3–9. Phase 2 (Lore module) gets its own plan after the pick. |
| **New character (~2026-10-01)** | Runbook N2 (pipeline plan §4) rehearsed read-only 2026-09-25 and fixed (DB import before overlay; sync stamps version from the newest provenance). The owner updates the game **one day before launch** — run the runbook then. |
| **Data** | MasterData refreshed 2026-09-24 to cfc `38b3d399…` / lang 5521 / r1897 (MuMu build r3026). `public/data.json` rebuilt with it. |

## 2. Infrastructure (changed this session — important)

- **Neon (project `empty-smoke-82458354`)**: `production` = the real data (default branch, endpoint `ep-rapid-dust-azdtb39r`), `development` = copy made 2026-09-25 (endpoint `ep-blue-dust-azcwulyc`), `backup-2026-09-25` (no compute), `production-old-empty` (old unused branch; delete later — ask the owner).
- **Local env**: `.env.local` → `development` (safe to experiment). **`.env.production.local`** → `production`; every command that must touch real data runs with `--env-file=.env.production.local` (release-day import, production lore publish, production migration). R2 credentials live in `.env`. Verified server-side which endpoint each file reaches.
- **Vercel**: Production and Preview each have 10 Secret vars (DB, `BETTER_AUTH_SECRET` new per env, `BETTER_AUTH_ALLOWED_HOSTS`, R2, `R2_MANAGED_ASSET_PREFIX` = `admin-prod` / `admin-dev`) plus the 9 lore Config vars. Preview allows login only on the branch alias `whmxsite-git-feat-postgres-admin-crud-siro-da-bao.vercel.app` (behind Vercel SSO). `vercel.json` gives `api/admin/*.js` `maxDuration: 30` (lore publish measured 7–9 s). Functions: 4 of 12 (never put tests under `api/`).
- **R2**: public bucket `whmx-assets` (images + `lore/{production,preview,development}/`), private `whmx-backups` (never enable its public URL).

## 3. Open items / next steps (in order)

1. **Owner picks design A/B/C** (P4 Task 2) → continue the phase-1 plan with `superpowers:executing-plans` (native), coding with `ponytail`, `ponytail:ponytail-review` after Tasks 6 and 8, final whole-branch review in Task 9.
2. Preview-URL admin check (owner, in a browser signed in to Vercel): sign in on the Preview alias, edit+revert a field, confirm production is untouched.
3. Release day (~2026-09-30/10-01): runbook N2 (8 steps) with owner approval at each DB/workbook write.
4. P4 phase 2 (Lore module, terms page, one-time seeds: 536 report titles incl. "Báo cáo mật A", 10 organisation names) — plan after step 1.
5. Separate spec later: public lore UI (layout of images/text; includes inline lore edit for editors) and `char.archive` in data.json (patch kept at `D:\BaiTapCode\WHMX\_claude_scratch\archive_build_change.patch`).
6. Deferred review items: #7 import plan outside the transaction, #9 REPEATABLE READ publish (both with P4), #11 shared S3 client, #14 restore by date.
7. Owner decisions pending: uncommitted leftovers (workbook, `localization/*` data, root scratch files, `.agents/`, `docs/admin-redesign/screens/` which contain an email), repo public vs private, `_npx`/`.cache` on drive C, deleting `production-old-empty`.

## 4. Owner rules (also in memory `whmx-working-rules`)

- Reply in Vietnamese, "tôi/bạn". No push/merge/reset/restore/clean unless asked; commit own files when verified; push `main` when the merged result is error-free. Never stage the workbook.
- DB writes on production, Vercel env changes, account changes, deletions outside the project: show the exact action, wait for yes. Secrets are handled by the owner (or composed into local files without printing, then deleted).
- Workbook only through `tools/safe_workbook_mutation.py` (fixed 2026-09-25 to compare last data rows; it used to reject every edit).
- Never operate outside `WhmxCalc` without permission; inside it, delete only files made useless (e.g. replaced JS). Scratch on drive D (`D:\BaiTapCode\WHMX\_claude_scratch\`). Delete `%LOCALAPPDATA%\Temp\claude\bash-edit-diff` (regrows on every bash call) at the end of each work block — drive C is small.
- New UI: React + TypeScript, redesigned with huashu (3 directions, owner picks), Tailwind tokens only, never the bare `hidden` class.
- Evidence rule: nothing inferred from ID shape; MasterData must be the live version before importing (`MasterData/provenance/launch_*.json` vs the launch endpoint; the owner tracks MuMu build numbers like r3026).

## 5. Skills the owner uses (use them the same way)

| Skill | When |
|---|---|
| `superpowers:brainstorming` → spec → `superpowers:writing-plans` → `superpowers:executing-plans` (native) | Any feature: questions (the owner likes **all questions listed at once** with a recommendation each), sectioned design, spec, plan, then native execution with a ledger and a final independent review |
| `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:systematic-debugging` | Every code change: failing test first, evidence before claims |
| `ponytail:ponytail` (full) | All coding: reuse first, no speculative abstractions, shortest correct diff |
| `ponytail:ponytail-review` / `ponytail:ponytail-audit` | After large chunks of code (plan Tasks 6, 8) and whole-module checks |
| `WhmxCalc:huashu-design` | Any new visual design: 3 real directions (roulette / reference product / best designer), owner picks, `direction-approved.md` |
| `.agents/skills/whmx-localization`, `.agents/skills/game-translator` | Any workbook / localization / data.json / translation work (Hán-Việt naming policy) |
| `superpowers:requesting-code-review` (fresh reviewer, most capable model) | End of each phase |
| `gsap-skills:*` | Only if CSS/View Transitions cannot do a motion the owner asked for (plan Task 8) |

## 6. Where to look

- Spec/plans: `docs/superpowers/specs/2026-09-24-lore-pipeline-design.md`, `docs/superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md`, `docs/superpowers/plans/2026-09-24-lore-pipeline.md` (done), `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md` (active).
- Runbook for game updates: `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §4 N2.
- Tests: `npm test` (lore, session, escape: 34), `npm run test:tools` (tools unittest, 41/41). Validators: `python tools/validate_{data,public_output,skin_roster,skin_assets}.py`.
