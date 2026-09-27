# Character Build — implementation plan

> Date: 2026-09-27. Spec: [`../specs/2026-09-26-character-build-design.md`](../specs/2026-09-26-character-build-design.md) (approved).
> Branch `claude/build-tab` (from `origin/main` ccc6cb6). Status: **approved 2026-09-27** (Q1–Q5: as recommended). PR 1 (A1–A4, B6, C8, E10–E11) done on the branch; PR 2 next.
> Split per state file §10: tasks marked ☁ run in a cloud session (pure code, `npm test`, `tsc`, `npm run build`,
> `npm run db:generate`); tasks marked 🖥 need the owner's machine (DB, R2, NeoArtifacts, signed-in admin).
> Every ☁ task: failing `node:test` first, then the least code that passes, then `npm test` + `tsc` + `npm run build`.
> Every PR stays shippable without the 🖥 steps: no build data → today's empty Build tab.

## Questions for the owner (each with my recommendation)

| # | Question | Recommendation |
|---|---|---|
| Q1 | A weapon skill has **6 levels** in `equipmentSkills` (e.g. `EA1011` Lv 1–6, same template, different numbers; true for all 114 groups in the fixtures). How to show the description? | Same as character skills in `build_web_data.py`: one line with every level's value, `10/12/14/16/18/20%` (template identical across levels, which holds for the fixtures); if a template ever differs, fall back to one line per level (`Lv.1: …`). |
| Q2 | 4 weapons carry **2** skills (`equipSkill` length 2). | Show both, in `equipSkill` order. |
| Q3 | Talents (`talentBankMap`, 445) as translatable terms: all, or only the 428 a column uses (60 columns × 7 points; some points list more than one talent)? | Only the 428 referenced by a column (kind `style_talent`), so the Thuật ngữ page lists nothing unused. |
| Q4 | Where the public Build data comes from before the first publish with builds. | The lore overlay only; no build → today's empty state (no fallback to `data.json`). |
| Q5 | Admin: who may edit builds? | Same as lore: owner + editor; publish is the existing ~30 s auto-publish / "Xuất bản ngay". |

## Tasks

### A. Reference data (importer)

1. ☁ **Normaliser** `scripts/lib/game-ref-source.mjs` — pure, MasterData (the 10 fixture files) → `{ refs: [{kind, code, data, sourceHash}], terms: [{code, kind, nameCn, detailCn, sourceHash}] }`.
   - `weapon`: `equipments` rows whose id is an `itemMap` row with `type: 9` (fixture `weaponItems`); `data = {job, rare, series, skillIds, iconKey|null}` (`iconKey` only when the id is in `weaponIconsPresent`). Term `weapon:<id>` (name).
   - `weapon_skill`: one term per `equipSkill` group (name + **resolved** description, task 2).
   - `weapon_affix`: `additionalAttrs` → `data = {addAttr, percent (attrDisplayType), jobs, rareValues}`; term = name.
   - `job_style`: `jobStyleMap` → `data = {job (from the character rows that list it), styleTalent, sectorIds, icon}`; term = name.
   - `style_sector`: `sectorMap` → `data = {talentIds (7 points, a point may list several), icon}`; term = name. `style_talent`: referenced `talentBankMap` rows → term = text.
   - `character_style`: `characterStyles` → `data = {job, styleIds[3], recommendedStyleId}` where the recommended style is the `jobStyleMap` row whose `styleTalent` contains `TalentRecommend[0][0]` (evidence by relation, never by id shape; no match → `null` — true for 9 of the 143 rows, e.g. `ES013`, `SCJ201`, which have no `TalentRecommend`).
   - Tests: weapon count 110 and job split 22×5, a weapon whose id is not type 9 is skipped, ED2031 link, D0017 → recommended 固防, a style → 4 sectors → 7 talents, `sourceHash` stable across key order.
2. ☁ **Weapon-skill description** `scripts/lib/weapon-skill-text.mjs` — port of `parse_attr` + `get_param_val` + the multi-level replacer (Q1). Tests with real rows: `ED2031` (`[Effect1Para,1]%` → `10%` at one level), `EA1011` (6 levels → `a/b/…%`), a template with a missing parameter (kept as the raw token, like the Python), `<color>` tags kept for the renderer to style.
3. ☁ **Planner** `scripts/lib/game-ref-import-plan.mjs` — pure, like `profile-import-plan.mjs`: refs insert/update/unchanged/absent (`source_present=false`, never delete); terms insert, CN change → update + `state=source_changed` when a VI exists, never touches VI. Tests for each branch.
4. ☁ **Importer** `scripts/import-game-references.mjs` — reads `../NeoArtifacts/MasterData/json` (same file list as the fixture exporter), plan by default, `--apply` in one transaction with a `source_snapshots` receipt + `import_runs` row (copy of the profile importer's frame). Not runnable in the cloud; covered by the pure tests above.
5. 🖥 Run it: `node --env-file=.env.local scripts/import-game-references.mjs` (plan) → `--apply` on development → production later (owner yes).

### B. Database

6. ☁ **Schema + migration**: `lore_term_kind` += `weapon, weapon_skill, weapon_affix, job_style, style_sector, style_talent`; `managed_entity_type` += `character_build`; table `game_references (kind, code, data jsonb, source_hash, source_present, source_seen_at, timestamps; unique (kind, code))`; table `character_builds (entity_id → managed_entities, character_entity_id → characters, position, doc jsonb, timestamps; unique (character_entity_id, position))`. `npm run db:generate` → `db/migrations/0007_*.sql` (reviewed by hand: additive only). `scripts/db-schema-test.mjs` expectations updated if it lists tables.
7. 🖥 `npm run db:migrate -- --target=development`; production `node --env-file=.env.production.local scripts/db-migrate.mjs --target=production` (owner yes).

### C. Build rules

8. ☁ **Validator** `server/builds/build-validate.mjs` — pure `validateBuild(doc, ctx)` → list of `{path, code}` (empty = valid), `ctx` = the character (job, 3 style ids, skill ids) + ref lookups. Rules (spec §4/§5): ≤ 4 weapons; weapon exists and job = character job; affix exists and allows the job; style ∈ the character's 3 styles; 4 points, integers 0–7, sum ≤ 11; rotation skill ids belong to the character; team member ids exist; text fields trimmed and length-capped; unknown top-level keys rejected. Tests: one per rule + a full valid build (the reference card).

### D. Saving builds (admin API)

9. ☁ **Domain** `server/builds/build-admin.mjs` + pure planner: list/get builds of a character (with revision), save one build (`expectedRevision`, 409 on stale, 422 with the validator's paths), add/remove/reorder builds, one `edit_history` row per save; triggers the same publish scheduling as lore (`lore_publish_state.last_edit_at`). Routes in `server/admin-api-routes/builds.mjs`, wired through the existing `api/admin/[...].js` (**no new file under `api/`**). Pure planner tests; the DB code itself is checked in 🖥 step 16.

### E. Publishing

10. ☁ **Document shape**: `buildLoreDocument(profiles, { builds, refs })` → `{version: 1, characters, builds: {characterId: Build[]}, refs: {weapons, weaponSkills, affixes, styles, sectors, talents}}` with CN + publishable VI only (`publishableVi`); refs trimmed to what the public tab needs. Tests: shape, VI withheld unless `viOrigin=admin` + `state=ok`, a document without builds is byte-identical to today's (so the next publish without builds doesn't change the file hash).
11. ☁ Publisher/repository read builds + refs (fake-repo test like `lore-publisher.test.mjs`); public loader keeps `builds`/`refs` from the overlay (`mergeLoreOverlay` test).

### F. UI (function first; visual design later with huashu + taste on the owner's machine)

12. ☁ **Admin module "Build"** (`MODULE_IDS` += `build`): React + TS, tokens only. Build tabs (add/rename/remove/reorder), weapon picker (job-filtered grid, icon + rarity frame when present, label input, max 4), affix groups + "Không cần tẩy luyện", style cards (prefilled from `recommendedStyleId`) + 4 steppers 0–7 with live total ≤ 11 and the column's talents on hover, rotations (label + skill chips in order), tips, team blocks ("Thêm đội hình", avatar picker, note), "Khác", rating/summary. Save with `expectedRevision`; browser draft + leave guard via the existing editor helpers. Pure editor helpers tested; the rest checked on sample data.
13. ☁ **Thuật ngữ page**: the new term kinds appear as filter groups (existing page, data-driven).
14. ☁ **Public Build tab**: React island replacing `views/detail/buildView.js`'s empty state when the overlay has builds: tabs, weapon tiles → popup (icon in `itemRare{rare}` frame, name, resolved skill text), affix groups, 深造 panel (style + 4 columns, hover → talents), rotations as skill icons, tips, team blocks (avatars link to characters), rating + summary. No build → exactly today's empty state. Pure view-model tests; browser check on a stubbed overlay built from the fixtures (375 px + desktop).
15. ☁ **Icons**: weapon icons + frames as a new R2 asset category in `tools/publish_assets.py` + URL helper in `src/features/assets/assetPaths.js` (missing icon → empty frame). Code + Python test only.

### G. Local steps (owner's machine, in this order)

16. 🖥 Development: migrate (7) → importer plan → `--apply` (5) → upload icons/frames `python tools/publish_assets.py …` (15) → sign in on `localhost:3003`, write a build in Admin → wait for the auto-publish (or `node --env-file=.env --env-file=.env.local scripts/publish-lore.mjs`) → public tab check (popup, hover, team links, 375 px + desktop).
17. 🖥 Visual design round: `huashu-design` (3 directions) + taste pack, owner picks, then restyle admin module + public tab (separate PR).
18. 🖥 Production (owner yes at each): migrate → importer `--apply` → icons to R2 → publish lore (`LORE_PUBLISH_PREFIX=lore/production/ …`).
19. Runbook N2 (pipeline plan §4) gains a step: run `scripts/import-game-references.mjs` after a game update.

## Order and PRs

- PR 1 (this branch): A1–A4, B6, C8, E10–E11 — data + rules + publish shape, all tested, no UI change.
- PR 2: D9, F12–F15 — admin module, public tab on sample data, icon category.
- Each PR: state file §2/§8/§11 updated in the same PR; the PR description lists the 🖥 commands that remain and which need the owner's yes.
