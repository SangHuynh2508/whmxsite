# Lore pipeline (character profile) — design spec

> Date: 2026-09-24. Status: **Approved by the owner on 2026-09-24** (including the 所属 source, §12 manual steps and the 90-day backup lifecycle). Next: implementation plan via `superpowers:writing-plans`.
> Source of truth for the decisions: `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §1 (owner decisions) and §2 "P0 design — approved sections" 1–4. This spec turns those four sections into buildable detail. It does not add features. Where the approved text left a mechanism open, the choice made here is marked **[spec choice]** and listed in §11 for owner confirmation.

## 1. Goal and scope

Make Postgres the working authority for **character profile / lore text** (`char.profile`), with a pipeline that gets DB text to the public site without git commits or redeploys.

**In scope (this spec):**
- P1: schema + profile importer (`scripts/import-character-profile.mjs`).
- P2: per-entity resolver `resolveCharacterProfile` + local `data.json` overlay + two-step parity gate.
- P3: lore publish to R2 (Vercel Function + owner-only endpoint + CLI) and the frontend overlay loader.
- Backup (plan phase P6): daily private R2 snapshot written by every publish + restore command. It ships **with P3**, because the approved design makes the snapshot part of the publish job (§8).
- Archive (hiện vật) images to R2 like card/drawing (§9). Independent of P1–P3.
- The contract that P4 (Admin Lore module) must use to trigger publishing (§7.4). The P4 UI itself is out of scope.

**Out of scope:** the Admin Lore module UI (P4, Part F Q3–Q5 still open), public UI changes that display the new fields, other domains (P5), story lore (`../WHMX_Lore_*`), any workbook write, xlsx export. (The 所属 department fix **is** in scope for the v2 shape, see §5; fixing it earlier in the old pipeline is a separate owner decision, §11.)

## 2. Principles carried from the approved design

- DB is the authority for lore VI once P1 lands. CN always comes from raw MasterData via the importer; the DB never invents CN.
- Lore has **no review lifecycle**: an Admin save is final (decision 3).
- Only `vi_origin = admin` VI is published. Legacy workbook VI is imported but **never exported** until someone saves that unit in Admin (owner chose B).
- The public site never reads Postgres. Two channels: game data in git (`public/data.json`), DB text on R2 (architecture §11, LOCKED 2026-09-24).
- Per-entity resolvers (engineering principles §2 example 1): batch callers loop over `resolveCharacterProfile(id)`; no monolithic export script.
- Preview characters never carry lore.
- Evidence rule: nothing is inferred from ID shape. Where raw meaning is unverified, the raw value is kept and nothing player-facing is derived from it.

## 3. Data model (P1)

New file `db/schema/profile.mjs`, exported from `db/schema/index.mjs`. One Drizzle migration (`0005_*`), generated with `npm run db:generate`, reviewed, applied only with owner approval.

### 3.1 Enum additions
- `managed_entity_type` += `character_profile`, `lore_term`. Each profile and each term gets a `managed_entities` row, so they reuse the existing `revision`, `edit_history` FK and 409 machinery. A profile revision is **separate** from the character's revision: lore edits never 409 against name edits (approved).
- New enum `vi_origin`: `legacy_workbook` | `admin`.
- New enum `lore_text_state`: `ok` | `source_changed`.
- New enum `lore_term_kind`: `relic_type` (K) | `era` (T) | `museum` (S) | `era_range` (P) | `affinity_level` | `organisation` (所属, from `TypeJJHMap`).

### 3.2 `character_profiles` (one per imported character)
| Column | Notes |
|---|---|
| `entity_id uuid PK/FK managed_entities` | `entity_type = character_profile`, `source_key` = character ID |
| `character_entity_id uuid FK characters.entity_id` unique | only characters already in the DB |
| `record_id text` | raw `characterFiles.recordID` |
| `staff_status_cn text`, `store_status_cn text` | raw `stafflanText` / `storelanText`; VI stays in the existing code maps |
| `organisation_code text null` | raw `characterTable.<id>.typeJJh` (e.g. `2`); resolved through `lore_terms.code = ORG_<typeJJh>` |
| `relic_type_code`, `era_code`, `museum_code`, `era_range_code` `text null` | raw `relics` / `dynasty` / `museum` / `photoDynasty` (FK-less; resolved through `lore_terms.code`) |
| `legacy_relic_fields jsonb` | the exact `relicslanText` / `dynastylanText` / `museumlanText` values, plus whether a relic entry exists — needed only for the legacy-shape parity output |
| `structure jsonb` | ordered, source-backed layout: `reports: [{fileId, kind: 'basic'|'special', unlock: {type, elementId} }]`, `timeline: ['A'..'F' slots present]` |
| `source_snapshot_id FK source_snapshots`, `source_hash text`, `source_present bool`, `source_seen_at`, `created_at`, `updated_at` | same pattern as `characters` |

### 3.3 `profile_texts` (one row per translatable unit)
| Column | Notes |
|---|---|
| `id uuid PK` | |
| `profile_entity_id FK character_profiles.entity_id` | |
| `unit_key text` | stable key, unique with `profile_entity_id`: `card_intro`, `report.<fileId>.title`, `report.<fileId>.content`, `relic_intro`, `timeline.<A-F>.label`, `timeline.<A-F>.story` |
| `source_cn text not null`, `source_ref text not null`, `source_hash text not null` | `source_ref` = raw table + key + field, e.g. `characterFileTextMap:V005301.titleLanText` |
| `vi text null`, `vi_origin vi_origin null` | `vi_origin` is null exactly when `vi` is null (CHECK) |
| `state lore_text_state not null default 'ok'` | |
| `vi_updated_by_user_id FK users null`, `vi_updated_at timestamptz null` | |
| `source_present bool`, `created_at`, `updated_at` | a unit that disappears from raw is marked absent, never deleted |

History: `edit_history` rows with `entity_id` = the profile's managed entity, `field_name` = `unit_key`.

### 3.4 `lore_terms` (shared, translated once)
| Column | Notes |
|---|---|
| `entity_id uuid PK/FK managed_entities` | `entity_type = lore_term`, `source_key` = code |
| `code text unique` | `K1001`, `T2005`, `S3059`, `P8002`, `AFFINITY_<1-10>`, or `ORG_<typeJJh>` |
| `kind lore_term_kind` | |
| `name_cn`, `detail_cn` | K/T/S/P: `HistoricalTextMap.Text` / `.TextIntroduce`. Affinity: `iconDescriptionLanText` (short, e.g. 莫逆 — the form the wiki shows) / `descriptionLanText` (long, 莫逆之交). Organisation: `TypeJJHMap.NameLanText` / `.FileLanText` (the long organisation description) |
| `name_vi`, `detail_vi`, `vi_origin`, `state`, `source_hash`, `vi_updated_by_user_id`, `vi_updated_at`, `source_present` | same rules as `profile_texts` |

Only K/T/S/P codes and organisations referenced by an imported character are imported (other `HistoricalTextMap` entries, e.g. `B…`, are not referenced by any profile field today). On 2026-09-24 that is 10 of the 12 organisations: `5` 非冬谷 (its description is developer test text, 这是一段…测试) and `12` 冬谷·繁星花协会 are unused, and are picked up automatically if a future character references them. All 10 affinity levels are imported.

## 4. Profile importer (P1)

`scripts/import-character-profile.mjs`, same shape as `scripts/import-character-skin.mjs` (default MasterData root `../NeoArtifacts/MasterData/json`, `--check`, one transaction, `source_snapshots` receipt + `import_runs` row with counts).

**Sources:** `characterFiles.json`, `characterFileTextMap.json`, `historicalRelicsMap.json` (incl. `ageX` / `ageStoryX`), `HistoricalTextMap.json`, `friendshipDescription.json`, `characterTable.json` (only `typeJJh`) and `TypeJJHMap.json`. The receipt hash covers all seven files.

**Rules:**
1. Import only characters present in the `characters` table. Raw characters not in the DB (today: `W0021`, an NPC) are skipped and listed in the report.
2. Units:
   - `card_intro` ← `cardIntrolanText`.
   - For every `basicFileID` then every `specialFileID`: title and content from `characterFileTextMap`. Unlock: store the raw `{UnlockType, ElementID}`. **Only `UnlockType 2` is interpreted** (ElementID = affinity level, verified on V0053). Special reports use `UnlockType 3` with IDs like `M700011` / `DH100112` whose meaning is unverified, so they get `unlock_level = null` in the output.
   - `relic_intro` ← `introductionlanText`.
   - Timeline slot X (A–F) is included when `ageXlanText` or `ageStoryXlanText` is non-empty; label and story are separate units.
   - CN is stored after `.strip()`, exactly as `extract_char_profile` does. Empty CN units are not created.
3. Idempotent: byte-identical inputs produce no changes, no duplicate rows and no duplicate history.
4. CN change on an existing unit: update `source_cn` / `source_hash`; if `vi` is set, set `state = source_changed` and write an `edit_history` `source_import` event (old/new CN). VI is never deleted or overwritten.
5. Every write that changes a profile or term bumps its `managed_entities.revision`, and a run that changed any CN sets `lore_publish_state.last_edit_at` (§7.2) so the change shows as unpublished.
6. No AI text is filled in, ever.

**Legacy seeding (`--seed-legacy-workbook`, run once with owner approval).** Reads the PROFILE sheet read-only through a small Python reader (same pattern as `scripts/read_character_skin_sources.py`). Read-only check on 2026-09-24 of the 195 legacy `text_vi` cells (15 characters):

| Category | Cells | Action |
|---|---|---|
| `card_intro` | 15 | seed `card_intro` |
| `relic_intro` | 15 | seed `relic_intro` |
| `report_title` | 60 | seed `report.<fileId>.title` from `text_vi` (the sheet stores the CN title in `text_cn`) |
| `report_content` | 60 | seed `report.<fileId>.content` |
| `staff_status`, `entity_status` | 30 | **not seeded**: these stay in the code maps (approved) |
| `relic_name` / `relic_dynasty` / `relic_museum` | 15 | **not seeded**: the VI cell is a copy of the raw code (`K1028`, `T2018`, …), not a translation |

So **150 cells** are seeded, as `vi_origin = legacy_workbook`, only into cells where `vi` is null. Report rows are matched by character + report index (1–4 → `basicFileID[i-1]`). If the workbook `text_cn` differs from the current raw CN, the unit is seeded with `state = source_changed`. Any row that cannot be matched is reported, not guessed.

`--check` validates sources and prints counts (characters, units, terms, skipped IDs, legacy cells matched) without opening a DB connection.

## 5. Resolver (P2)

`server/profile/resolve-character-profile.mjs`:

```js
resolveCharacterProfile(characterId, ctx, { shape }) // shape: 'legacy' | 'v2'
// ctx = { db, terms }  — terms: Map(code → lore_terms row), loaded once per batch
```

Read-only. Returns `null` for a character with no profile (the caller then leaves the existing block untouched). `record_id`, `staff_status` and `entity_status` are computed exactly as `extract_char_profile` does today, ported to JS (`STAFF_STATUS_MAP`, `STORE_STATUS_MAP`). `department` differs by shape:
- `legacy`: the same rule as the build at gate-1 time (today the `DEPT_KEYWORDS` keyword search on the CN intro; if the old-pipeline fix in §11 lands first, the `typeJJh` rule below).
- `v2`: from `organisation_code` → `lore_terms ORG_<id>`. Value = published admin `name_vi` if any, else the existing VI from a `DEPARTMENT_VI` code map (the current `DEPT_KEYWORDS` VI names re-keyed by exact CN organisation name: 资料部 Bộ Tư Liệu, 商业部 Bộ Thương Mại, 技术部 Bộ Kỹ Thuật, 执行部 Bộ Hành Chính, 航海家联盟 Liên Minh Hàng Hải, 塞纳回廊 Hành Lang Seine, 不列颠学会 Học Viện Anh Quốc, 方塔联合会 Liên Minh Tháp Phương, 繁星花协会 Hiệp Hội Hoa Phồn Tinh), else the CN name. `""` when `typeJJh` is missing. The organisation description is imported and translatable but not exported until the public UI step needs it.

**`legacy` shape** = byte-for-byte what `tools/build_web_data.py` emits at gate-1 time: `record_id`, `department`, `staff_status`, `entity_status`, `eval_intro` (CN), `reports: [{id, title, content}]` (basic reports only, skipping ones with empty title and content), `relic_info: {relic_name, dynasty, museum, intro}` from `legacy_relic_fields` (or `{}` when the character had no relic entry). A unit that was not created because its CN was empty is emitted as `""`, as the build does.

**`v2` shape** (the approved new shape; CN always present, `_vi` is `null` when not publishable):
```json
{
  "record_id": "…", "department": "…", "staff_status": "…", "entity_status": "…",
  "eval_intro": "CN", "eval_intro_vi": null,
  "reports": [
    { "kind": "basic", "title": "CN", "title_vi": null, "content": "CN", "content_vi": null,
      "unlock_level": 5, "unlock_name": "鹿鸣", "unlock_name_vi": null }
  ],
  "relic_info": {
    "type":   { "cn": "玉器", "vi": null },
    "era":    { "cn": "春秋战国", "vi": null },
    "museum": { "cn": "杭州博物馆", "vi": null },
    "intro": "CN", "intro_vi": null,
    "timeline": [ { "label": "战国", "label_vi": null, "story": "CN", "story_vi": null } ]
  }
}
```
- No raw codes and no report file IDs in `v2` (public-output rule: no internal IDs). The P code (`era_range`) is imported but not exported (not shown on the wiki).
- A `_vi` value is published only when `vi_origin = admin` **and** `state = ok` **[spec choice]**. Legacy VI and VI whose CN changed after the save are withheld, so the site shows CN.
- Special reports appear with `kind: "special"` and `unlock_level: null`.

## 6. Local data.json overlay + parity (P2)

`scripts/export-profile-overlay.mjs --shape legacy|v2`: runs after `python tools/build_web_data.py`, reads `public/data.json`, replaces `characters[id].profile` with `resolveCharacterProfile(id, ctx, {shape})` for every character that has a profile, and writes back atomically (temp file in `public/` + rename). It only reads the DB. Serialization must match the Python writer (compact separators, non-ASCII unescaped, key order preserved); any mismatch is caught by gate 1.

**Gate 1 (legacy):** fresh `build_web_data.py` output → overlay `--shape legacy` → the file is **byte-identical** to its input. Run before any lore VI is published. If it fails, fix the resolver/serializer; nothing proceeds.

**Gate 2 (v2):** overlay `--shape v2`, then a check script proves the diff touches only `characters.*.profile` (parse both, drop `profile`, deep-equal the rest), no value in any `profile` matches `^[KTSP]\d{4}$`, and it prints every character whose `department` changed (expected: the 26 characters the keyword heuristic got wrong or left empty, e.g. A0167 → Liên Minh Hàng Hải, A0180 → Bộ Kỹ Thuật, A0003 no longer empty) for the owner to eyeball, then all validators pass: `validate_data.py`, `validate_public_output.py`, `validate_skin_roster.py`, `validate_skin_assets.py`, `npm run build`.

After gate 2, the overlay step (`--shape v2`) becomes part of the release-day build (N2 runbook, step 5, after `build_web_data.py`). The build machine then needs read-only DB access (`.env.local`).

## 7. Publish to R2 (P3)

### 7.1 Objects
- Public bucket (the existing `R2_BUCKET`), prefix per environment from `LORE_PUBLISH_PREFIX` (e.g. `lore/production/`, `lore/preview/`, `lore/development/`).
- Content: `lore.<sha256-12>.json` = `{ "version": 1, "publishedAt": "…", "characters": { "<id>": <v2 profile> } }`, `Cache-Control: public, max-age=31536000, immutable`. Built by looping `resolveCharacterProfile(id, ctx, {shape: 'v2'})` over official characters only.
- Pointer: `lore.pointer.json` = `{ "file": "lore.<hash>.json", "publishedAt": "…" }`, `Cache-Control: public, max-age=60`.
- A publish = upload content (if that hash is new), then overwrite the pointer (a single PUT, so the swap is atomic). Old content files are kept. **Rollback** = repoint (`scripts/publish-lore.mjs --repoint <file>`, owner-run).
- The bucket needs a CORS rule allowing `GET` from the site origins (owner, Cloudflare dashboard).

### 7.2 Publisher
`server/profile/lore-publisher.mjs` exports `publishLore({ db, storage, actor })`. It reuses the S3 client setup from `server/assets/r2-managed-assets.mjs` (`@aws-sdk/client-s3`, already installed).
- Serialized by a Postgres advisory lock (`pg_try_advisory_xact_lock`). If another publish holds it, return `{status: 'busy'}` instead of racing (prevents an older snapshot overwriting a newer pointer).
- If the built hash equals the current pointer's file, only the backup (§8) is written and it returns `{status: 'unchanged'}`.
- Records the result in a one-row table `lore_publish_state` (`published_file`, `published_hash`, `published_at`, `published_by_user_id`, `last_edit_at`), which the P4 UI reads to show "published / has unpublished changes".

### 7.3 Callers
- `POST /api/admin/lore/publish`: owner-only, same-origin + session + active-user checks like other admin routes. New `lore` case in `api/admin/[...].js` → `server/admin-api-routes/lore.mjs` (no new Vercel Function). `GET` on the same path returns `lore_publish_state`.
- `scripts/publish-lore.mjs`: CLI for the first publish and verification (`--dry-run` writes the JSON locally instead of uploading; `--repoint <file>`).

### 7.4 Trigger contract for P4
- Every lore save updates `lore_publish_state.last_edit_at` in the same transaction.
- **[spec choice]** The ~30 s debounce runs in the Admin browser: after each successful lore save the Lore module restarts a 30 s timer; when it fires, it calls `POST /api/admin/lore/publish`. The owner "Xuất bản" button calls the same endpoint. If the tab closes before the timer fires, the change stays unpublished and the Admin shows "có thay đổi chưa xuất bản" (`last_edit_at > published_at`) until the next save or button press. Alternative (not chosen): a server-side delay with `waitUntil`, which needs a new dependency (`@vercel/functions`) and bills 30 s of function time per save.

### 7.5 Frontend overlay loader
- `src/features/profile/api/loreOverlay.ts`: `loadLoreOverlay()` fetches the pointer (URL from build-time env `VITE_LORE_POINTER_URL`), then the content file, with a 5 s total timeout.
- `src/data/loader.js` starts it in parallel with `/data.json`; after both settle it replaces `char.profile` for every character present in the overlay. On any failure (timeout, network, bad JSON, `version` ≠ 1) it logs one warning and keeps the `data.json` profile, which already has the CN.
- Env missing (e.g. local dev without R2) → the overlay is skipped silently.

## 8. Backup and restore (plan P6, ships with P3)

- Every `publishLore` call (including `unchanged`) writes `backups/lore/<YYYY-MM-DD>.json.gz` (UTC date, overwritten by the day's latest state) containing all `character_profiles` structure rows, all `profile_texts` (including unpublished and legacy VI), all `lore_terms`, `lore_publish_state`, and `edit_history` rows for `character_profile` / `lore_term` entities.
- **Private** means a **separate bucket without public access** (`R2_BACKUP_BUCKET`): R2 public access is per bucket, so a prefix inside the public bucket would be readable. Lifecycle rule: delete after 90 days (owner set it up in the Cloudflare dashboard on 2026-09-24).
- `scripts/restore-lore-snapshot.mjs <date|file> --actor <owner email>`: default is a dry run that lists every unit/term whose `vi` / `vi_origin` / `state` differs. `--apply` (owner approval required, it writes the DB) restores those fields in one transaction, bumps revisions, and writes `human_edit` history rows with `metadata.restoredFrom`. It does not re-insert old history rows (they stay in the snapshot file). CN is never restored from a snapshot; run the importer first on an empty DB.

## 9. Archive (hiện vật) images (independent)

- Add `"archive": "archive"` (published folder name) to `REMOTE_CATEGORIES` in `tools/asset_publish_manifest.py`, and make `tools/publish_assets.py` pick up `Assets/characters/<ID>/archive/{<id>.png, head_<id>.png}` (268 files, 134 characters).
- `tools/build_web_data.py` emits `char.archive = { "image": …, "head": … }` using the same convention as card entries (see `src/features/assets/assetPaths.js`). This is the game-data channel; the lore overlay does not touch it.
- Do this outside the P2 parity window (it changes `data.json` outside `profile`), with its own validator run. No DB, no managed-asset role (that is P5, only if Admin ever needs to replace these images).

## 10. Error handling and verification summary

| Area | Failure | Behaviour |
|---|---|---|
| Importer | source file missing / shape wrong | abort before any write, name the file/ID |
| Importer | character in raw, not in DB | skip, list in report |
| Importer | CN changed under VI | `source_changed`, VI kept, history event |
| Overlay | gate 1 not byte-identical | stop; nothing ships |
| Publish | concurrent publish | `busy`, no write |
| Publish | R2 upload fails | pointer untouched; error returned; old version stays live |
| Frontend | overlay fails | CN from `data.json`, one console warning |

Tests (one runnable check each, no framework): resolver legacy/v2 on fixture rows; importer `--check` on real data and on a scratch copy with a changed CN; gate 1 and gate 2 scripts; publisher `--dry-run` hash stability (same DB → same file name); loader fallback (pointer 404 → CN kept). DB-writing steps (migration, first import, legacy seed, first publish, restore `--apply`) each need the owner to see the row list/plan first.

## 11. Owner decisions

Confirmed by the owner on 2026-09-24:
1. **Legacy seeding is 150 cells, not 195** (§4): 30 status cells stay in the code maps and 15 relic-code cells are code copies, not translations.
2. Admin VI whose CN later changed (`source_changed`) is withheld from the site until re-saved (§5).
3. The 30 s auto-publish debounce runs in the Admin browser, with an "unpublished changes" hint as the safety net (§7.4).
4. **Backup needs its own private R2 bucket** (§8), plus two owner-side Cloudflare settings: CORS on the public bucket, 90-day lifecycle on the backup bucket (steps in §12; owner changed 180 → 90 days).
5. Backup ships with P3 rather than as a later P6, because the publish job writes it.
6. The overlay step (`--shape v2`) joins the release-day build after gate 2, so that build needs read-only DB access.

Decided later the same day:
7. **所属 is fixed now in the old pipeline** (`build_web_data.py`: `typeJJh` → `TypeJJHMap` name → `DEPARTMENT_VI`, the same rule as v2). So gate 1's `legacy` shape uses the `typeJJh` rule, and the `DEPARTMENT_VI` names move from Python into `lore_terms` with this pipeline.
8. **`冬谷·航海家联盟` = "Đông Cốc · Liên Minh Hàng Hải"** (organisation 10, used only by A0156).

## 12. Manual steps for the owner

Cloudflare's dashboard wording can shift slightly; the settings themselves are what matter. None of this is needed before P3.

**A. During P1–P2 (approvals only, nothing to click):** review the migration SQL, the importer `--check` report, the legacy-seed list (150 cells) and the gate-2 department diff before each DB write.

**B. Cloudflare R2 (before P3):**
1. R2 → **Create bucket** → name e.g. `whmx-backups` → create. Leave **Public access** off (no r2.dev URL, no custom domain). This is the private backup bucket.
2. Open `whmx-backups` → **Settings** → **Object lifecycle rules** → **Add rule**: name `lore-90d`, prefix `backups/lore/`, action **delete objects 90 days after upload** → save.
3. Open the existing public bucket (the one behind `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev`) → **Settings** → **CORS policy** → add/edit and paste:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```
   `*` is safe here: the objects are public anyway and only read methods are allowed. It also covers Vercel preview URLs, which change per deploy.
4. R2 → **Manage R2 API Tokens** → find the token whose Access Key ID matches `R2_ACCESS_KEY_ID` in Vercel. If it is limited to specific buckets, edit it and add `whmx-backups` with **Object Read & Write**. If it can't be edited, create a new token with Object Read & Write on both buckets and replace `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in Vercel.

**C. Vercel (before P3):** Project → **Settings** → **Environment Variables**, add:
| Name | Production | Preview | Development |
|---|---|---|---|
| `R2_BACKUP_BUCKET` | `whmx-backups` | `whmx-backups` | `whmx-backups` |
| `LORE_PUBLISH_PREFIX` | `lore/production/` | `lore/preview/` | `lore/development/` |
| `VITE_LORE_POINTER_URL` | `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/lore/production/lore.pointer.json` | same with `lore/preview/` | same with `lore/development/` |

`VITE_*` values are baked in at build time, so they take effect on the next deploy. For local work, add the Development values (and the R2 credentials) to `.env.local` **by hand**; do not use `vercel env pull .env.local`, which overwrites the file.

**D. Organisation names:** done (§11.8). Any later rename (e.g. the pending 执行部 review) goes into `DEPARTMENT_VI` until P1, then into `lore_terms`.
