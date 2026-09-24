# WHMX — New-character readiness + DB-centred data pipeline (plan)

> Created 2026-09-24. **Living document: update the status table and the log at the bottom whenever anything changes.**
> A fresh agent should be able to continue from this file alone after reading the references below.

## 0. Read first (in this order)

| # | File | Why |
|---|---|---|
| 1 | `docs/WHMX_NEXT_STEPS.md` | Global task order and status of every initiative |
| 2 | `docs/WHMX_CURRENT_STATE_FINAL_2026-09-24.md` (newest), then `docs/WHMX_CURRENT_STATE_FINAL_2026-09-23_v2.md` §3 | Session state + what's next; the older file has the environment gotchas (temp-account testing pattern, `vercel dev`, npm rules) |
| 3 | **this file** | Data pipeline + new-character work |
| 4 | `docs/plans/WHMX_ADMIN_PLAN_2026-09-23.md` | Admin UI plan (Parts A–F); Part F = Khí Giả/Lore admin brainstorm |
| 5 | `docs/WHMX_APP_ARCHITECTURE.md` | Where code lives; §11 publication (Hướng B, LOCKED), §12 source-of-truth, the React TARGET (§4) |
| 6 | `docs/WHMX_ENGINEERING_PRINCIPLES.md` | Per-entity resolver rule (§2 example 1) — the exporter must follow it |
| 7 | `docs/POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md` | §B authority, §D override/conflict model, §L importer, §M DB→`public/data.json` exporter |
| 8 | `docs/PREVIEW_CHARACTER_ASSET_ARCHITECTURE_PROPOSAL_2026-09-19.md` | §5 Preview→official reconciliation, §6 managed assets, §10 export rules |
| 9 | `.agents/skills/whmx-localization/SKILL.md` + `.agents/skills/game-translator/SKILL.md` | Mandatory for any workbook/localization/data.json work |
| 10 | `docs/WHMX_MASTERDATA_ID_CONVENTIONS(5).md` | ID meaning; never infer semantics from ID shape |
| 11 | `../NeoArtifacts/RUNTIME_UPDATE_CAPTURE_RUNBOOK.md`, `../NeoArtifacts/HANDOFF_RUNTIME_ASSET_DISCOVERY_2026-09-10.md` | How game updates/assets are captured (MuMu + ADB) |

Working rules (from the owner, still in force): no commit/push/merge/reset/restore/clean unless asked; never touch `localization/localization_master.xlsx` except through the established safe-mutation tools with owner approval; any write/delete on the live Neon DB needs the owner to see the exact row list and say yes first; one npm command at a time, in the background; React for new UI (bare `hidden` class forbidden, use `max-md:hidden`); colours only from `src/styles/tokens.css`.

## 1. Owner decisions recorded (2026-09-24)

1. **Pipeline direction: Hướng 2 — DB-centred, migrated one data domain at a time.** Postgres becomes the working authority domain by domain; the workbook stays authoritative for domains not yet migrated and becomes an automatic export/backup for migrated ones. A big-bang switch (Hướng 3) was rejected on cost/risk, not only on the "no big-bang" rule.
2. **First migrated domain: character profile / lore** (`char.profile`: `record_id`, `department`, `staff_status`, `entity_status`, `eval_intro`, `reports[]`, `relic_info`). Reason: almost untranslated (see the P0 findings: 15/133 characters have legacy, unreviewed VI that the site never shows), and it forces the exporter to exist.
3. **Lore has no review step**: a save is final (Part F Q1). Lore therefore does not use the workbook's PENDING→TRANSLATED→REVIEW→APPROVED lifecycle.
4. **Build order for the lore slice: pipeline first (importer + exporter, verified by parity), then the Admin Lore module, then public UI tweaks.**
5. **The new game character due ~2026-10-01 goes through the existing (old) pipeline**, not the new one.
6. React for new UI, public and Admin, migrated gradually (already recorded in the architecture doc).

## 2. Verified current data flow (read before designing anything)

```
GAME ──CDN──► NeoArtifacts.py masterdata  (refresh_masterdata.py wraps: backup → status → masterdata)
              → NeoArtifacts/MasterData/json (548 tables) + provenance        [no emulator needed]
     ──MuMu─► NeoArtifacts.py runtime-update check|plan|apply → immutable snapshot (data.dat + MasterData)
              NeoArtifacts.py character-sync <ID> | --all → Assets/characters/<ID>/{avatar,card,drawing,skill_icon,archive,skin_activity}/ + manifest.json
              NeoArtifacts.py huanzhang-sync → Hoán Chương assets                [emulator needed]

OLD / LIVE path to the public site:
  MasterData ─► tools/sync_masterdata_incremental.py ─► localization/localization_master.xlsx (append missing keys only; diffs reported, never overwritten)
             ─► translation batches + validators (tools/*) ─► tools/export_localization_json.py ─► localization/generated_localization.json
  Assets     ─► tools/publish_assets.py ─► R2/S3 + asset-publish-manifest.json
  MasterData + generated_localization.json + skin_translation_FINAL_CLEAN.xlsx + manifest ─► tools/build_web_data.py ─► public/data.json ─► git commit ─► Vercel

NEW / ADMIN path (dead end today):
  workbook + MasterData ─► scripts/import-character-skin.mjs ─► Postgres baseline (characters, skins; overrides flagged `source_changed` on conflict)
  Admin + public inline edit ─► field_overrides ─► ✗ nothing reads it for the public site
  Preview (social-media leaks) ─► preview_characters ─► reconciliation (propose/confirm) ─► ✗ no exporter yet
```

Facts that shaped this plan:
- `NeoArtifacts.py` fetches **data** (`masterdata`), not only images.
- `tools/build_web_data.py` (~2300 lines, Python) has zero Postgres awareness. It is the only producer of `public/data.json`.
- Workbook folders `../WHMX_Lore_*` are **story** lore (main story/events), a different thing from character profile lore.
- Hard-coded roster counts (133 characters / 145 skins / 10 high skins, plus commerce 117/28/52/93) sit in `scripts/import-character-skin.mjs` and `tools/validate_skin_roster.py`, so a new character breaks them. Fixed in Part N, Phase N1.
- Skin Series names are a closed list (`SERIES_NAMES` in the importer, `SERIES_MAP_CN/VI` in the validator; IDs 202–220). A skin in a **new** Series fails both until its CN name (raw) and VI name (translation authority) are added. This is intentional: add them with evidence, never guessed.

### P0 findings — profile/lore source data (2026-09-24, read-only)
- **Raw tables:**
  - `characterFiles.json` (134): `recordID`, staff/store status (CN), `cardIntrolanText`, `basicFileID` (always 4 reports), `specialFileID` (only S0174/V0112/W0051 + 1 more have one), `AVGFileID` (always empty).
  - `characterFileTextMap.json` (810): report `titleLanText`/`textLanText`.
  - `historicalRelicsMap.json` (134): codes `relics` (K…), `dynasty` (T…), `museum` (S…), `photoDynasty` (P…), `introductionlanText`, and a **relic timeline** `ageA..F` + `ageStoryA..F` (461 story entries, about 3.4 per relic) that the current build ignores.
  - `HistoricalTextMap.json` (208) resolves K/T/S/P codes to `Text` + `TextIntroduce` (e.g. K1027 = 民俗文化, T2011 = 辽金元, S3001 = 黑龙江省博物馆, P8005 = 宋元). These entries are **shared across characters**.
- **Neon facts (read-only, 2026-09-24):** project `Whmxsite` (`empty-smoke-82458354`, aws ap-southeast-1, PG 18). Point-in-time history is only **6 h** (`history_retention_seconds` 21600) and the branch size limit is 512 MB, consistent with the free plan. **Once the DB is the lore authority, it needs its own backup.**
- **Archive (hiện vật) images:** NeoArtifacts has 268 PNGs (`Assets/characters/<ID>/archive/{<id>.png, head_<id>.png}`, 2 per character, 134 characters). `tools/asset_publish_manifest.py` `REMOTE_CATEGORIES` covers only `card`/`drawing`, so archive is not published yet.
- **Repo facts for CI:** `public/data.json`, `localization/localization_master.xlsx`, `localization/generated_localization.json` and `asset-publish-manifest.json` are git-tracked. `../NeoArtifacts` (MasterData, raw assets) is **not in the repo**, so CI cannot rerun `build_web_data.py`. There are no `.github/workflows` yet. The current branch is `feat/postgres-admin-crud` (diverged from `main`; see the 09-22 state doc §7.4).
- **Current build** (`extract_char_profile` in `tools/build_web_data.py`): outputs CN only; it never reads the workbook VI (`profile_loc` is loaded but unused). It emits the raw codes as `relic_info.relic_name/dynasty/museum` (e.g. `K1027`), so the public output leaks internal IDs. Department/staff/store VI come from hard-coded Python maps (`DEPT_KEYWORDS`, `STAFF_STATUS_MAP`, `STORE_STATUS_MAP`).
- **Code meanings, confirmed 2026-09-24.** The owner sent wiki screenshots of V0053 水晶杯 and each one was matched field-by-field to the raw data:
  - `relics` K = **类型 (type)**, e.g. K1001 玉器;
  - `dynasty` T = **年代 (era)**, e.g. T2005 春秋战国;
  - `museum` S = **现藏地 (current collection)**, e.g. S3059 杭州博物馆;
  - `photoDynasty` P = an era range (P8002 夏商周), not shown on the wiki.

  The build's name `relic_name` for K is wrong: it is the relic *type*.
- **Wiki section ↔ raw mapping (V0053):**
  - 人员评估 = `cardIntrolanText`;
  - 所属 = department;
  - 本体情况 = `storelanText`;
  - 档案编号 = `recordID`;
  - 科普信息 = K/T/S;
  - 本源介绍 = `introductionlanText`;
  - 历史轨迹 = timeline `ageX` label + `ageStoryX` (V0053: 战国 / 1990年 / 现今);
  - 评估报告 = 4 reports.
- **Report unlock conditions:** `basicFileUnlock[i]` = `{UnlockType: 2, ElementID: <affinity level>}`. V0053 reports 1–2 unlock at level 1, report 3 at 5, report 4 at 9. Level names come from `friendshipDescription.json` (10 levels; short `iconDescriptionLanText` 鹿鸣/莫逆, long `descriptionLanText` 鹿鸣/莫逆之交); the wiki shows 【5级鹿鸣】/【9级莫逆】. Include the unlock level per report in the model, and the 10 level names in `lore_terms`.
- **Department (所属) source resolved (2026-09-24):**
  - The real source is raw `characterTable.<id>.typeJJh` → `TypeJJHMap.json` (12 organisations: 资料部, 商业部, 技术部, 执行部, 非冬谷, 航海家联盟, 塞纳回廊, 不列颠学会, 方塔联合会, 冬谷·航海家联盟, 繁星花协会, 冬谷·繁星花协会). Each has `NameLanText` plus a long `FileLanText` description, which is also wiki content.
  - V0053 typeJJh 2 = 商业部, matching the wiki.
  - The build's keyword heuristic (`DEPT_KEYWORDS` in `extract_char_profile`) is **wrong or empty for 26 characters**. For example: A0167 shows 塞纳回廊 but raw says 航海家联盟; A0180 shows 资料部 but raw says 技术部; A0003/A0024/A0025/A0070/A0156/D0026 show nothing.
  - **This is a live bug on the public site today.** It is fixable in the old pipeline too: map `typeJJh` → `TypeJJHMap` name → VI. The VI names for the new organisations need owner/translation authority.
  - Add the 12 organisations (name + description) to `lore_terms`, and let the exporter use `typeJJh` instead of the heuristic.
  - **Old-pipeline fix (owner-approved 2026-09-24), code done, `public/data.json` not yet regenerated:** `tools/build_web_data.py` `extract_char_profile` now reads `characterTable.typeJJh` → `TypeJJHMap.NameLanText` → the `DEPARTMENT_VI` dict (CN name as fallback). **The VI department names are hard-coded in Python (`DEPARTMENT_VI`) and move to `lore_terms` when the lore pipeline is built (spec §5).** Owner chose `冬谷·航海家联盟` = "Đông Cốc · Liên Minh Hàng Hải". Verified: with the same hash seed, only 26 `department` values change; no character has an empty department any more.
- **`build_web_data.py` is not deterministic (found 2026-09-24):** two back-to-back builds differ in about 6,300 JSON paths (list order inside `skills`, `zhizhi`, `brilliant_skills` of 26 characters). The content is identical when list order is ignored, and runs with `PYTHONHASHSEED=0` are byte-identical, so the cause is Python `set` iteration order (hash randomisation). Every rebuild therefore produces a large order-only git diff. **Code fixed 2026-09-24** (owner asked to do it in this session): four set iterations now use `sorted(...)` (`expected_gids` in the skill loop; in `attach_popup_terms`: `highlighted_names | exact_plain_names`, `active_keys`, `parent_names`). Builds with seeds 1, 2 and 987654 are byte-identical, and the content equals the current `public/data.json` when list order is ignored. The CN↔VI coloured-term pairing (by position in each sentence) is list-based and unchanged. `public/data.json` was rebuilt with it on 2026-09-24 (owner approved): only `mechanics` lists changed order (76 in skills, 49 in alternate_forms, 17 in zhizhi, 11 in brilliant_skills; 33 characters), content identical. The UI never lists `mechanics` in order (it is a lookup scope for popups, sorted by name length in `infoView.js`); the rendered Thông Tin tab HTML of all 33 characters was byte-identical between the old and new file (Playwright, `/data.json` served from each file).
- **Wiki parity check (V0053, owner's screenshots):** every section on the wiki maps to raw data, including the archive image `Assets/characters/V0053/archive/v0053.png`, which visually matches the wiki's crystal cup.
- **Workbook PROFILE sheet:** 1994 rows, 9 categories (`card_intro`, `staff_status`, `entity_status`, `relic_name`/`dynasty`/`museum`/`intro`, `report_title`/`report_content` ×4). It has 195 `text_vi` and 40 `title_vi` for **15 characters**, all "Migrated from names_vi.xlsx", status PENDING (118) / TRANSLATED (77), none reviewed.
- **`W0021` (鸳鸯炉) is an NPC, not a playable character** (owner, 2026-09-24: it never got any art despite being out for a long time). It is in raw `characterTable`/`characterFiles` but correctly absent from the workbook. The profile importer only imports characters that already exist in the DB, which excludes it.
- **Public site today renders only** `profile.record_id`, `department`, `staff_status`, `entity_status` (`overviewView.js`, `characterCatalogView.js`). `eval_intro`, `reports`, `relic_info` are exported but **not displayed anywhere**, so their shape can change freely.

### P0 design — approved sections
1. **Data model + importer (approved 2026-09-24)**
   - `character_profiles` (one per character, its own revision, so lore edits never 409 against name edits).
   - `profile_texts` (one row per translatable unit: `card_intro`, report title/content ×4 + special reports, `relic_intro`, and the **relic timeline `ageA..F` label + story**, included per owner). Columns: `source_cn`, `source_ref`, `source_hash`, `vi` (DB is authority), `vi_origin` (`legacy_workbook` | `admin`), `state` (`ok` | `source_changed`), actor/time; history in `edit_history`.
   - `lore_terms` (shared K/T/S/P entries from `HistoricalTextMap`: name + intro, translated once).
   - Status/department terms stay in the existing small code maps for now.
   - Importer `scripts/import-character-profile.mjs` (same shape as the character/skin importer, with `--check`): only characters already in the DB; idempotent; a CN change marks existing VI `source_changed` and never deletes it. The 195 legacy workbook VI cells are seeded once as `legacy_workbook`, and only into empty DB cells. No AI text is auto-filled.
  - Added after the wiki check: per-report unlock level (from `basicFileUnlock`), and the 10 affinity level names in `lore_terms`.
2. **Exporter (approved 2026-09-24)**
   - Overlay design: `tools/build_web_data.py` runs unchanged, then a JS step replaces each character's `profile` block with `resolveCharacterProfile(id)` from the DB and writes `public/data.json` atomically (temp file + rename). Each future domain adds one overlay.
   - The 4 fields the site renders keep their shape. New shape for the rest: `eval_intro(_vi)`; `reports[]` {title, content, title_vi, content_vi, unlock level}; `relic_info` with K/T/S resolved to `{cn, vi}` (no raw codes), `intro(_vi)` and `timeline[]` {label, story + `_vi`}. CN always stays as the fallback.
   - Two-step parity: (1) the overlay emits the legacy shape and must be byte-identical to the legacy build; (2) switch to the new shape, where the diff may touch only `profile`, then run all validators.
   - The exporter only reads the DB.
   - **Legacy VI (owner chose B):** the 195 `legacy_workbook` rows are **not exported**; the site shows CN until someone opens and saves that unit in Admin, which flips it to `vi_origin = admin`. Only `admin` VI is published.
3. **Publish (approved 2026-09-24, revised from the git/GitHub Actions proposal)**
   - **Two channels.** Game data stays in git-tracked `public/data.json` (local build when the game updates). DB-owned text (lore first) is published as **versioned JSON on R2** (`…/lore.<hash>.json` immutable + a small pointer file with about 60 s cache; atomic pointer swap; rollback = repoint). Separate R2 prefix per environment. Recorded in `WHMX_APP_ARCHITECTURE.md` §11 (LOCKED 2026-09-24).
   - **Trigger:** automatic about 30 s after an Admin save (debounced), plus an owner "Xuất bản" button. It runs in a Vercel Function (small job, per-entity resolvers). No commits, no redeploy, no GitHub Actions.
   - **Frontend:** load `data.json`, then the lore overlay, and merge `profile`. If the overlay fails, show the CN already in `data.json`. The lore overlay can later be lazy-loaded when a profile tab opens.
   - **Why (owner asked for a wiki-admin view):**
     - edits appear in seconds (git path: 2–4 min + build queue);
     - useful history is per-unit `edit_history` in the DB (git can't diff a 14.6 MB single-line file);
     - repo growth: each git publish would store another 14.6 MB version (`data.json` is one line, 1.8 MB gzipped; profile is only 6.2 %);
     - failure fallback to CN;
     - SEO is equal either way (hash-routed SPA).
   - Branch merge (`feat` → `main`) is still needed once to ship the code, but no longer gates publishing. Earlier facts kept for reference: the repo is public, its default branch is `main`, and GitHub Actions is free for public repos.
4. **Backup, archive images, Preview (approved 2026-09-24)**
   - **Backup replaces "auto-export to workbook".** Writing `localization_master.xlsx` automatically is unsafe (Excel locks; the workbook may only change through the safe tools with owner approval), and the real gap is Neon's 6 h history. Each publish also writes a **full lore snapshot** to a **private** R2 prefix. A "snapshot" here means a data dump, not an image: the JSON of `profile_texts` (all VI including unpublished), `lore_terms` and the lore `edit_history`, gzipped, stored as `backups/lore/<YYYY-MM-DD>.json.gz`. There is one file per day, overwritten by the day's latest state, with an R2 lifecycle rule to delete after 90 days (owner changed from 180, 2026-09-24). A restore command writes a snapshot back to the DB and runs only with owner approval. The workbook PROFILE sheet stays as reference (documented as migrated). An xlsx export to a separate file comes later, only if asked.
   - **Archive (hiện vật) images go to R2 exactly like card/drawing** (owner, 2026-09-24): add `archive` to `REMOTE_CATEGORIES` in `tools/asset_publish_manifest.py` / `publish_assets.py` (2 images per character: `<id>.png`, `head_<id>.png`). The URLs land in the manifest and `data.json` (game-data channel).
   - **Preview never carries lore.** The exporter publishes lore only for official characters. Release flow: character import (N3) → run the profile importer → CN lore exists → translate in Admin → published on save. Preview↔official reconciliation stays the existing mechanism, independent of lore. Add the profile-importer run to the N2/N3 runbook.

## 3. Status

| Part | What | Status |
|---|---|---|
| N1 | Remove hard-coded roster counts (importer + skin validator), keep every per-record raw check | ✅ Done 2026-09-24 (see N1 result) |
| N2 | Release-day runbook for the new character (old pipeline) | Written below; run on release day |
| N3 | After release: DB import of the new character (+ Preview reconciliation if a preview exists) | After N2 |
| P0 | Pipeline brainstorm → written spec → implementation plan (superpowers flow) | ✅ Spec approved 2026-09-24. ✅ Implementation plan written: `docs/superpowers/plans/2026-09-24-lore-pipeline.md` (12 tasks: P1 Tasks 1–5, P2 Tasks 6–7, P3 Tasks 8–11 incl. backup/restore, archive images Task 12). **Next: owner reviews the plan and picks the execution method** |
| P1–P6 | Pipeline implementation (lore slice first) | Not started; needs P0 spec + plan approval |

## 4. Part N — new character readiness (specific order)

### N1. Roster counts derived from source (code, now)
- `scripts/import-character-skin.mjs`:
  - `loadSourceBundle`: replace the `133/145` checks with "workbook SKIN ids == raw actual (`skinType === 3`) skin ids", with missing and extra IDs named in the error. The existing per-row checks (every workbook character/skin has its raw record; relation, Series, high-skin flag match) stay.
  - The "10 High Skins" check becomes "every raw high skin (`CharacterHighSkinMap` / `highskin === 1`) that is an actual skin is flagged, and none extra". The `S0174003` null-Series exception stays.
  - `runImport`: the fixed-count guard is replaced by a non-empty sanity check; source validation lives in `loadSourceBundle`.
- `tools/validate_skin_roster.py`:
  - 145 → the size of the raw actual-skin set, plus set equality between the SKIN sheet and raw.
  - Gallery count → the same number.
  - Commerce totals (117/28/52/93/52…) become partition checks: matched + blank == total rows. The per-row equality with raw above them already verifies each value.
- Verification: both still pass on today's data with the same numbers printed (133/145/10); a synthetic "+1 character/+1 skin" case passes; importer **dry run only, no DB write**.

### N1 result (2026-09-24)
- `tools/validate_skin_roster.py`: expected counts are derived from raw `characterSkins.json` (actual skins `skinType == 3`). Step 1 checks set equality between the sheet and raw, naming missing/extra IDs. Steps 5/9/10 use raw-derived totals (skins, `skinLOGO == 0` count). Step 12 commerce totals became bucket partitions (matched + blank == rows; price/window/currency == discount-matched); all per-row raw comparisons unchanged. On today's data it prints the same numbers as before (145, 144/1, 117/28, 52/93, 52/52/52) and passes 12/12.
- `scripts/import-character-skin.mjs`:
  - The 133/145 checks became SKIN-sheet ↔ raw actual-skin set equality, naming missing/extra IDs.
  - "10 High Skins" became set equality with raw high skins (`CharacterHighSkinMap` or `highskin === 1`).
  - `runImport` only refuses an empty bundle.
  - New **`--check`** flag: loads and validates sources, prints counts, never opens a DB connection (`getDb()` is only called for a real import).
- Verified without touching the DB:
  - real data → `{"characters":133,"skins":145,"highSkins":10}`;
  - scratch copies simulating +1 character (Z9999) and +1 skin (Z9999003) → `134/146/10`, pass;
  - raw has the new skin but the workbook doesn't → `SKIN sheet does not match raw actual skins (missing: Z9999003; extra: -)`;
  - a new skin without its public avatar fails with `missing public asset`, as intended: run the asset steps first.
- `tools/validate_skin_assets.py` also had a fixed 145 (found in a follow-up sweep of the release-day validators). It now compares the gallery skin IDs with the raw actual-skin set and passes on today's data (145/145). The sweep found no other fixed 133/144/145 counts in `tools/validate_*.py`, `build_web_data.py`, `publish_assets.py` or `export_localization_json.py`.
- Not changed on purpose: the Series name lists (a new Series must be added with evidence) and the `S0174003` null-Series exception.

### N2. Release-day runbook (old pipeline, owner-driven)
1. `cd NeoArtifacts && python refresh_masterdata.py` (backs up MasterData, fetches new CFC/lang).
2. On MuMu after the in-game update: `python NeoArtifacts.py runtime-update check` → `plan` → `apply`, then `character-sync <NEW_ID>` (and `huanzhang-sync` if it has Hoán Chương).
3. `python tools/sync_masterdata_incremental.py` for the new character (appends rows; review its diff report).
4. Translate the new rows through the normal batch flow (whmx-localization skill §6). Put a new Series VI name in only with owner approval.
5. `python tools/export_localization_json.py` → `python tools/publish_assets.py` → `python tools/build_web_data.py` → validators (`validate_data.py`, `validate_skin_roster.py`, `validate_skin_assets.py`, `validate_public_output.py`) → `node scripts/import-character-skin.mjs --check` (source check for the DB importer, no DB access) → `npm run build`.
6. Owner reviews, then commits/deploys.

Translate the new character **in the workbook** this week. Admin edits cannot reach the public site until P2/P3 exist.

### N3. After release (DB side)
- Run `node --env-file=.env --env-file=.env.local scripts/import-character-skin.mjs` against Neon, **with owner approval** (it writes). The new character then appears in Admin.
- If a Preview exists for the character (claimed ID = new raw ID), propose reconciliation. The owner confirms in Admin (Preview → retired/hidden; chosen metadata/assets become overrides on the official character). Previews never enter `data.json`, so the public site is never duplicated.

## 5. Part P — DB-centred pipeline (Hướng 2), lore first (specific order)

P0 must finish (sectioned design → spec in `docs/superpowers/specs/` → owner review → `writing-plans`) before any P-code. The phase list below is the agreed shape, not yet the approved spec.

| Phase | Deliverable | Notes |
|---|---|---|
| P0 | Spec + implementation plan | Design approved (sections 1–4 above). Write the spec from those sections, get owner review, then `writing-plans` |
| P1 | Profile importer | Schema (`character_profiles`, `profile_texts`, `lore_terms`) + `scripts/import-character-profile.mjs` (`--check`). Sources: `characterFiles`, `characterFileTextMap`, `historicalRelicsMap` (incl. timeline), `HistoricalTextMap`, `friendshipDescription`; seed the 195 legacy VI cells once as `legacy_workbook`. Only characters already in the DB. Migration + first import need owner approval (DB writes) 🟡 **Status 2026-09-24:** code done (Tasks 1–5); waiting for owner approval of migration 0005 + first import + legacy seed. |
| P2 | Resolvers + parity | JS per-entity resolvers (`resolveCharacterProfile(id)`). **Parity gate:** for every character, the resolver's legacy-shape output equals the legacy build's `profile` byte-for-byte before any DB edit; then the new shape (VI, resolved K/T/S, timeline, unlock level) 🟡 **Status 2026-09-24:** code done (Tasks 6–7); parity gates 1–2 run once P1 data exists. |
| P3 | Publish to R2 | A Vercel Function builds the lore JSON with per-entity resolvers → versioned object on R2 + pointer swap. Triggered about 30 s after an Admin save (debounced) and by an owner button. Frontend overlay loader with CN fallback. No commits/CI (architecture §11, 2026-09-24) 🟡 **Status 2026-09-24:** code done (Tasks 8–11 incl. backup/restore); waiting for env vars + first publish (owner). |
| P4 | Admin Lore module | Part F approach 2 (module workspace; `BilingualText` CN ↔ VI; no review states; revision/409 + history). React |
| P5 | Next domains | Character/skin names (they already have overrides), then Hoán Chương, archive images (reuse managed assets + a new `artifact_archive` role), and later skills (Part D) |
| P6 | Backup/restore | Daily private R2 snapshot written by the publish job + restore command (replaces the earlier "workbook auto-export" idea, see section 4) |

## 6. Global order (all initiatives)

1. ~~**N1**~~ ✅ done 2026-09-24.
2. **P0**: design + spec approved (2026-09-24) → implementation plan (`superpowers:writing-plans`).
3. **N2** on release day (~2026-10-01), then **N3**.
4. **Admin Part E leftover:** logged-in check at mobile/tablet widths (needs owner approval for a temp account); see the admin plan.
5. **P1 → P2 → P3** (lore slice pipeline, parity-verified).
6. **P4** Admin Lore module (the Part F brainstorm continues: Q2 authority is now answered by decision 1 for lore; Q3 granularity, Q4 archive images, Q5 keep public inline edit).
7. **P5/P6** further domains; Part D skill translation frame after lore.
8. Open gaps, unscheduled:
   - D2.4.1 save/discard/409 flow in the Vue Khí Giả CMS not exercised end-to-end.
   - `scripts/db-*-proof/test.mjs` create users with fixed passwords and swallow cleanup errors; they need hardening.
   - The public page shows an inline edit only for the session that made it; the value disappears on reload until P3 exists.
   - Story lore (`../WHMX_Lore_*`) is not part of any plan yet.

## 7. Log

- 2026-09-24: Plan created. Owner chose Hướng 2, lore first, pipeline before UI, and the old pipeline for the upcoming character. N1 started.
- 2026-09-24: N1 done (validator + importer counts derived from raw; `--check` flag added). Next: P0 sectioned design (brainstorm), then N2 on release day.
- 2026-09-24: P0 sections 1 (model + importer), 2 (exporter + parity, legacy VI hidden until re-saved) and 3 (publish: text on R2, auto after save; game data stays in git) approved. Architecture §11 updated.
- 2026-09-24: Section 4 approved (daily private R2 lore snapshot instead of workbook export; archive images to R2 like card/drawing; Preview never carries lore). Session ended for context; handoff in `docs/WHMX_CURRENT_STATE_FINAL_2026-09-24.md`. Next: write the spec.
- 2026-09-24: Spec written from sections 1–4 and self-reviewed (not committed). Read-only checks while writing: only 150 of the 195 legacy PROFILE VI cells are real text (30 status cells stay in code maps, 15 relic cells are copies of raw codes); special reports unlock via `UnlockType 3` (meaning unverified → no level shown); a "private prefix" in the public R2 bucket would be readable, so backups need a separate bucket. Open choices for the owner are in spec §11. Next: owner review → `writing-plans`.
- 2026-09-24: Owner approved spec §11 points 1–6. Spec revised: v2 `department` comes from `characterTable.typeJJh` → `lore_terms ORG_<id>` (from `TypeJJHMap`; only referenced organisations, so `5` 非冬谷 with developer test text and unused `12` are skipped), VI = admin VI → existing VI code map re-keyed by exact CN name → CN; legacy shape keeps the build's rule for gate 1; gate 2 lists changed departments. Only organisation 10 冬谷·航海家联盟 (A0156) lacks a VI name. Added spec §12 (owner's manual Cloudflare/Vercel steps). Open: §11.7 fix 所属 in the old pipeline now or wait; §11.8 VI name for 冬谷·航海家联盟.
- 2026-09-24: Owner approved fixing 所属 in the old pipeline now (condition: full before/after diff of `public/data.json`, only `department` may change, stop and ask otherwise; no commit/deploy without a yes) and chose "Đông Cốc · Liên Minh Hàng Hải" for 冬谷·航海家联盟. Code changed in `build_web_data.py`; builds were redirected to `D:\BaiTapCode\WHMX\_claude_scratch\dept\` (the repo's `public/data.json` and `generated_localization.json` are untouched). Found the build is non-deterministic (set order), so a plain rebuild also reorders lists; waiting for the owner to choose how to write `data.json`. Owner also asked for a review of 执行部 = "Bộ Hành Chính" (proposal only, not changed).
- 2026-09-24: Owner chose option 1 for 所属: only the 26 `department` values were written into `public/data.json` (values taken from a real build; the JSON diff shows only those 26 paths). Validators passed (`validate_data`, `validate_public_output`, `validate_skin_roster` 12/12, `validate_skin_assets`), `npm run build` passed. Not committed. Backup lifecycle changed 180 → 90 days (owner set it up in Cloudflare; the API token was edited to cover `whmx-backups`). Build determinism fixed in code (see §2 finding); the data.json rebuild with it awaits owner approval. Scratch files live on D: (`D:\BaiTapCode\WHMX\_claude_scratch\`).
- 2026-09-24: Owner approved the deterministic rebuild after confirming UI order is unaffected. `public/data.json` = deterministic build (26 new departments + stable list order). Validators passed, `npm run build` passed, rendered HTML of the 33 affected characters unchanged, no console errors. Not committed. Pending: owner approval of the revised spec → `writing-plans`; owner decision on 执行部 (proposal: Bộ Chấp Hành).
- 2026-09-24: Owner approved the spec. Owner also allowed commits whenever a step is safe/verified or a phase is done (only my own files). Org-name review started: the names in `DEPARTMENT_VI` mirror the workbook GLOSSARY (`DEPT_01..09`, all APPROVED), so a rename (e.g. 执行部 → Bộ Chấp Hành, which the owner accepted) must also change the GLOSSARY through the safe tools; asked the owner before touching the workbook.
- 2026-09-24: Implementation plan written and self-reviewed (`docs/superpowers/plans/2026-09-24-lore-pipeline.md`). While planning: Node reorders integer-like JSON keys (`items`), so the data.json overlay is written by `tools/apply_profile_overlay.py`; `.mts` (not `.ts`) is needed for Node tests under the CommonJS package. Spec adjusted accordingly (5 points, listed at the end of the plan). Org-name review found that `DEPARTMENT_VI` mirrors the workbook GLOSSARY (`DEPT_01..09`, APPROVED); renaming needs a GLOSSARY change through the safe tools — asked the owner.
- 2026-09-24: Owner keeps the current department VI names (no rename, no GLOSSARY change). Owner chose **Native** execution of `docs/superpowers/plans/2026-09-24-lore-pipeline.md`; progress ledger in `.superpowers/sdd/2026-09-24-lore-pipeline/progress.md` (git-ignored), status also mirrored here per task.
- 2026-09-24: **Code for all 12 plan tasks committed** (`8c1a929`..`6634780`): normalizer, legacy matcher + read-only reader, import planner, schema + migration `0005_next_justin_hammer.sql` (**not applied**), importer CLI, profile shaper, DB resolver + overlay export/apply + gate checker, R2 publisher + backup, admin publish endpoint + CLI, public overlay loader (CN fallback verified in browser), restore CLI, archive asset category. All unit tests pass (`node --test scripts/lib/ server/profile/ src/features/profile/`, `python tools/test_apply_profile_overlay.py`); `npm run build` passes. Importer `--check`: 133 characters, 2,260 text units, 139 terms (10 organisations, 10 affinity levels, 119 K/T/S/P codes), 150 legacy VI seeds, W0021 skipped. **Waiting on owner gates:** (1) apply migration 0005; (2) first import `--apply`; (3) legacy seed `--apply`; (4) env vars `R2_BACKUP_BUCKET`, `LORE_PUBLISH_PREFIX`, `VITE_LORE_POINTER_URL` (Vercel + `.env.local`); (5) first lore publish to R2; (6) archive image upload (`tools/publish_assets.py`, untracked file, 268 images). Parity gates 1–2 run after (3).
- 2026-09-24: Owner approved gate 1: **migration 0005 applied** (`npm run db:migrate -- --target=development` → `MIGRATION_CHAIN_OK`). Added the 3 non-secret lore env vars to `.env.local` (owner asked; development prefix). Gate 2 read-only plan: 2,532 inserts = 133 `character_profiles` + 2,260 `profile_texts` (card_intro 133, report title/content 536+536, relic_intro 133, timeline label/story 461+461) + 139 `lore_terms` (10 ORG, 10 AFFINITY, 28 K, 27 T, 58 S, 6 P); 0 updates; W0021 skipped. Waiting for owner yes to `--apply`.
