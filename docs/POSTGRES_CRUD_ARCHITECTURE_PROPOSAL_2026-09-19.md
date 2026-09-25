# WHMX PostgreSQL Hosted CRUD Architecture Proposal

> **Entry point:** [`WHMX_CURRENT_STATE_FINAL_2026-09-26.md`](WHMX_CURRENT_STATE_FINAL_2026-09-26.md) (status, infrastructure, rules, backlog). Related: [`WHMX_APP_ARCHITECTURE.md`](WHMX_APP_ARCHITECTURE.md), [`PREVIEW_CHARACTER_ASSET_ARCHITECTURE_PROPOSAL_2026-09-19.md`](PREVIEW_CHARACTER_ASSET_ARCHITECTURE_PROPOSAL_2026-09-19.md), [`2026-09-24-lore-pipeline-design.md`](superpowers/specs/2026-09-24-lore-pipeline-design.md). Older handoffs, `WHMX_NEXT_STEPS.md` and finished plans were removed on 2026-09-26 — links to them below resolve in git history only.

**Status:** Approved architecture; D0A implementation and migration portability closure verified on the development branch.
**Date:** 2026-09-19
**Scope:** Character and Skin first; supporting Series, acquisition, asset, localization, auth, audit, import, and export foundations.

## A. Verified current architecture findings

The current public application is a Vite/vanilla-JavaScript SPA. `src/data/loader.js` fetches `/data.json` once, and the hash router renders from that in-memory public snapshot. `package.json` contains no backend, database, or authentication package. `vercel.json` currently has a catch-all SPA rewrite and static asset headers, but no server function routes.

The current generated-data path is more nuanced than a simple JSON export:

```text
NeoArtifacts/MasterData/json
  + localization/localization_master.xlsx
  + localization/generated_localization.json
  + current build rules and asset manifest
            ↓
tools/build_web_data.py
            ↓
public/data.json
            ↓
Vite public site
```

`build_web_data.py` preserves source-backed relationships and assembles nested `characters[characterId].skins[]`. It currently combines raw skin records with workbook localization and asset-manifest URLs. It must not be replaced by a blind JSON-to-table mapper.

The workbook confirms the present authority and import scope:

| Workbook sheet | Rows | Relevant role |
| --- | ---: | --- |
| `CHARACTER` | 133 | Vietnamese character display/localization authority |
| `SKIN` | 145 data rows | Vietnamese skin/localization, series, commerce, and asset metadata authority |
| `SKILL` | 2,599 | Later expansion; not first CRUD scope |
| `BUFF_STATUS` | 2,004 | Later expansion; relationship evidence remains raw-backed |
| `PROFILE` | 1,995 | Character-supporting localization, deferred |

The `SKIN` columns are exactly: `skin_id`, `character_id`, Chinese/Vietnamese name, description and obtain fields, `is_base_skin`, review metadata, `skin_type`, unlock/commerce fields, `is_high_skin`, opaque `skin_rare`, voice, drawing/card/avatar paths, Series fields, and raw commerce IDs/discount fields.

The current public snapshot contains 133 characters and 145 actual skins. All actual skins have `skin_type = 3`; ten are `is_high_skin`; and `S0174003` intentionally has no Series. Its absent Series remains a real null relationship, never a fabricated fallback. Current asset transport is R2 for card/drawing and local public assets for avatar, item icon, and Series badge.

The existing `vercel.json` immutable rule applies to `/assets/(.*)`. It is unrelated to this database milestone. The stable-named asset cache concern remains a later infrastructure task.

## B. Authority boundary and target architecture

The initial PostgreSQL database is a normalized, mutable working layer. It does **not** become the universal source of truth merely because it has CRUD.

```text
NeoArtifacts raw MasterData ── immutable source evidence
            │
localization_master.xlsx ─── current persistent localization authority
            │                         │
            └──── deterministic import ┴────> Neon PostgreSQL
                                               │
                                        admin API / controlled overrides
                                               │
                                      validate + deterministic exporter
                                               │
                                      Git-tracked public/data.json
                                               │
                                         existing Vite public site
```

Rules carried into the schema:

- Raw IDs, exact raw relations, raw skill/buff links, and raw commerce identifiers are source-backed. The regular admin API never exposes them as mutable free text.
- Human localization and presentation edits are represented as explicit overrides, never mistaken for a raw import value.
- The raw source snapshot and the workbook snapshot that produced a value remain traceable.
- The public website remains static/read-optimized. It does not connect to PostgreSQL.
- PostgreSQL stores asset metadata and bindings, not image binaries.

## C. Recommended relational schema

Use UUID internal keys where cross-domain audit/override references need a stable foreign key, while retaining source IDs as unique, public/exportable natural keys. Use lower-case PostgreSQL tables in the `public` schema for the first release. `timestamptz` columns are UTC. IDs and raw source keys are `text` to preserve leading zeros and future shapes.

### Provenance and entity registry

| Table | Important columns and constraints | Purpose |
| --- | --- | --- |
| `source_snapshots` | `id uuid PK`, `source_kind`, `source_version`, `content_hash`, `source_path`, `manifest jsonb`, `captured_at`; unique `(source_kind, source_version, content_hash)` | Immutable receipt for a raw MasterData, workbook, or normalized-build input snapshot. No raw payload copy is required. |
| `import_runs` | `id uuid PK`, `source_snapshot_id FK`, `status`, `started_at`, `finished_at`, `initiated_by_user_id nullable FK`, `counts jsonb`, `error_summary` | One deterministic importer run and its inserted/updated/unchanged/conflicted counts. |
| `managed_entities` | `id uuid PK`, `entity_type`, `source_key`, `revision bigint NOT NULL DEFAULT 1`, `created_at`, `updated_at`, `edited_by_user_id nullable FK`; unique `(entity_type, source_key)` | Provides a non-polymorphic FK target for field overrides, audit rows, and concurrency. `source_key` is the raw Character/Skin/Series ID, not editable. |

`managed_entities.revision` is incremented in the same transaction as every effective human edit, validated relation change, source baseline update, or conflict resolution. `updated_at` is retained for display and diagnostics.

### Character, Skin, and supporting tables

| Table | Keys and source-baseline columns | Controlled mutable/effective support |
| --- | --- | --- |
| `characters` | `entity_id uuid PK/FK managed_entities`, `character_id text UNIQUE NOT NULL`, source snapshot FK, raw Chinese identity/name/fullname, raw rarity/job/attack type, raw unlock date, source display/localization baseline fields | `sort_order`, source display metadata JSON only where preserving a current normalized field is necessary. Raw class, skill, and rarity relationships remain source-backed. |
| `series` | `entity_id uuid PK/FK`, `series_id smallint UNIQUE`, source name CN/VI baseline, source badge asset FK, source snapshot FK | constrained `sort_order`; an actual skin can have no Series. The initial valid actual-skin catalog is 202–220; type-2 Series 102 is retained as source/reference, not a gallery filter. |
| `skins` | `entity_id uuid PK/FK`, `skin_id text UNIQUE`, `character_entity_id FK characters`, source snapshot FK, Chinese name/description/obtain, `skin_type`, `is_base_skin`, unlock date, price, currency, opaque `skin_rare_raw jsonb`, `cv_name`, raw `item_id`, `goods_id`, discount fields, raw/source `series_id nullable FK` | Source baseline only. `skin_type`, raw relation IDs, raw commerce IDs, and `skin_rare_raw` are read-only. The database must preserve `skin_rare_raw` verbatim and never map it to stars. |
| `acquisition_categories` | `id text PK`, `label_vi`, `label_cn nullable`, `sort_order`, `is_active` | Controlled reference list for the normalized categories (`Cao Cấp`, `Du Lịch`, `Sự Kiện`, `Cửa Hàng`, `Tập Huấn`, `Cốt Truyện`, `Miễn Phí`). |
| `skin_acquisition_state` | `skin_entity_id PK/FK`, `source_category_id nullable FK`, source snapshot/hash | `override_category_id nullable FK`, base source value/hash, override state. Owner-only validated edits; no arbitrary labels. |
| `asset_objects` | `id uuid PK`, `storage_provider`, `object_key`, `public_url`, `content_hash`, `mime_type`, source snapshot FK; unique `(storage_provider, object_key)` | Metadata only. `storage_provider` initially allows `r2` and `public`. |
| `skin_asset_mappings` | `skin_entity_id FK`, `asset_role` (`drawing`, `card`, `avatar`), `source_asset_id FK`, source hash; PK `(skin_entity_id, asset_role)` | `override_asset_id nullable FK`, base source asset/hash, state. Owner-only constrained selection from approved `asset_objects`. |

Important indexes:

```text
characters(character_id)
skins(skin_id)
skins(character_entity_id)
skins(source_series_id)
series(series_id)
managed_entities(entity_type, source_key)
source_snapshots(source_kind, captured_at DESC)
import_runs(status, started_at DESC)
asset_objects(storage_provider, object_key)
```

The first migration should add FK constraints with deliberately named `ON DELETE RESTRICT` behavior for source/entity tables. Imported source omissions must mark a record as absent/inactive in an import report; they must never cascade-delete a live record.

### Future expansion path

Add `skills`, `buffs`, `weapons`, `localization_records`, `character_skills`, `skill_buffs`, and `character_weapons` only after their raw evidence/importer tests exist. Their source relationship tables must reference the exact raw relationship evidence, not inferred ID suffixes. This leaves room for an expansion without prematurely modeling uncertain gameplay semantics.

## D. Source value versus human override design

### Recommendation: typed baseline tables plus one field-level override ledger

Do not duplicate every nullable field as `source_x`, `import_x`, and `override_x` on every domain table. That creates ambiguous precedence, makes import logic brittle, and does not scale to Skill/Buff content. Also do not put validated foreign keys exclusively in an untyped JSON blob.

Use a hybrid model:

1. Typed domain tables above retain the current normalized **source baseline** and its source snapshot.
2. `field_overrides` holds only human changes to editable text/presentation fields, one row per entity and field.
3. Typed relation state tables (`skin_acquisition_state`, `skin_asset_mappings`, and a corresponding `skin_series_state`) hold validated relationship overrides with real foreign keys.
4. Export/read services compute an effective value: active override, otherwise source baseline. The public exporter receives only effective public fields.

`field_overrides` proposed shape:

```sql
field_overrides (
  id uuid primary key,
  entity_id uuid not null references managed_entities(id) on delete restrict,
  field_name text not null,
  override_value jsonb not null,
  base_source_value jsonb not null,
  base_source_hash text not null,
  base_source_snapshot_id uuid not null references source_snapshots(id),
  state text not null check (state in ('active','source_changed','resolved','cleared')),
  created_by_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null,
  updated_by_user_id uuid not null references users(id) on delete restrict,
  updated_at timestamptz not null,
  unique (entity_id, field_name)
)
```

The server owns an allowlist of `(entity_type, field_name, value schema, permission class)`. It accepts only the approved Character/Skin editable fields in milestone D, for example `name_vi`, `fullname_vi`, `nickname_vi`, `tags`, lore/description/obtain Vietnamese text, presentation metadata, notes, and sort order. JSONB preserves exact structured values and null intentionally; the API schema, not the browser, validates types and permitted fields.

Validated relationships remain typed rather than field-ledger JSON. For `skin_series_state`, use `source_series_id nullable FK series`, `override_mode` (`inherit`, `set`, `clear`), `override_series_id nullable FK series`, base source hash/snapshot, and `state`. A `CHECK` enforces `set` only with an override ID and `inherit` only without one. `clear` is an explicit reviewed decision, never a missing string. The same pattern applies to `is_high_skin` with a nullable boolean override and acquisition category with its FK.

### Import and conflict behavior

For every imported field, calculate a canonical content hash from the normalized field value and source receipt.

- No active override: update the source baseline, source snapshot/hash, and effective output.
- Active override with identical baseline hash: update source provenance only if appropriate; leave effective value unchanged.
- Active override with a changed baseline hash: update the source baseline, retain the override, set `state = source_changed`, write an import event, and count it as `conflicted`.
- A reviewer chooses **keep override**, **adopt source**, or **replace with an edited merged value**. The choice is an audited, optimistic-locked write. Nothing silently replaces the override.

This separates raw-import versus human-override review from human-versus-human concurrency. It also supports future fields without moving immutable raw evidence into mutable columns.

### Workbook-authority safeguard

For fields whose persistent authority remains `localization_master.xlsx`, an admin edit is a **tracked working override**, not proof that workbook authority moved. Each such override must be exportable in a deterministic workbook-patch/review report keyed by workbook row/column and source hash. The existing safe workbook workflow remains the only mechanism that changes the workbook.

Recommended initial publishing policy: a production exporter refuses an unreconciled workbook-owned localization override unless an owner explicitly approves that override's controlled publish state. This prevents accidental silent authority transfer while still allowing the owner to stage and review real hosted CRUD. The owner should confirm this publish gate before the first production release.

## E. Editability matrix for the first scope

| Domain/field class | Examples | API policy |
| --- | --- | --- |
| Editable | `name_vi`, `desc_vi`, `obtain_vi`, display labels/metadata, tags, notes, sort order | Owner and editor, allowlisted schema, override ledger, audit row |
| Validated editable | Series assignment, acquisition category, asset mapping, `is_high_skin`, explicit display flags | Owner only; typed reference picker/FK validation, audit row |
| Read-only/source-backed | Character/Skin raw IDs, `character_id` relation, `skin_type`, `skin_rare`, raw goods/item/discount IDs, exact raw Skill/Buff relations, raw provenance | No normal CRUD endpoint for any role. Source-maintenance is a separate future workflow. |

The UI may display source values and provenance beside an editable field but must distinguish baseline, active override, and `source_changed` conflict state. It must never derive semantics from ID shape.

## F. Users, roles, sessions, and recommended authentication

### Recommendation: Better Auth with the Drizzle PostgreSQL adapter

Use **Better Auth** configured for email/password accounts, database sessions, and its Drizzle PostgreSQL adapter. It is framework-agnostic, provides a vanilla-JavaScript client, mounts under a normal `/api/auth/*` handler, and supports a Drizzle/PostgreSQL schema. This fits the existing Vite SPA plus Vercel Functions without a Next.js conversion. Its current documentation specifically describes a vanilla client, a framework-neutral Request/Response auth handler, PostgreSQL via the Drizzle adapter, and a host allowlist suitable for Vercel preview URLs ([installation](https://better-auth.com/docs/installation), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [dynamic base URL](https://better-auth.com/docs/guides/dynamic-base-url)).

Use Better Auth as an in-app library, not a shared credential or a browser-owned token scheme. Pin a reviewed compatible version in the lockfile when implementation starts. Generate its Drizzle schema once, review it, merge it into the application schema, then have **drizzle-kit alone** generate/apply committed migrations. Do not use an auth CLI command that directly mutates a deployed database outside the reviewed migration path.

Proposed logical tables (exact vendor-required columns must be generated from the pinned Better Auth version before the first migration):

| Table | Required design |
| --- | --- |
| `users` | UUID primary key; unique normalized email; display name; `role` enum `owner`/`editor`; `status` enum `active`/`disabled`; Better Auth email-verification fields; `created_at`, `updated_at`, `last_login_at`, `disabled_at`, `disabled_by_user_id`. No plaintext password. |
| `accounts` | Better Auth account/provider record, `user_id FK`, provider/account identifiers, and the library-managed credential password hash/secret when local email/password is enabled. Do not hand-roll password hashing or expose it in APIs. |
| `sessions` | Better Auth server-side session record, `user_id FK`, opaque token/secret representation, expiry, IP/user-agent metadata as supported by the pinned library, created/updated timestamps, and revocation/expiry behavior. |
| `verifications` | Library-managed, expiring verification/reset records if email verification or password recovery is enabled. |

`users.status = disabled` is the normal offboarding action. Every authenticated request checks both a valid server session and active user status. Revoking/invalidating that user's sessions is part of the same owner-only disable operation. Retain users referenced by audit rows; use `RESTRICT` rather than deleting them.

Role claims are not trusted just because a client displays them. Each write handler loads/validates the server session and current `users.role` from the database. Editors receive `403 FIELD_FORBIDDEN` for validated or source-backed fields; owners receive the same response for source-backed fields.

Cookie and API safeguards:

- Same-origin, `HttpOnly`, `Secure` in production, `SameSite=Lax` session cookies; no `VITE_*` secret.
- Explicit `allowedHosts`/trusted origins for local Vite, the production custom/Vercel domain, and the expected `*.vercel.app` preview hosts. Reject unknown hosts rather than using request inference.
- Verify `Origin` for every JSON mutation in addition to session validation; use `credentials: 'same-origin'` in the vanilla client.
- Rate-limit login/reset routes, return generic authentication failures, and never log passwords, cookies, `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `CRON_SECRET`.
- Start with owner-created/invited users; do not expose public self-signup until an explicit product decision enables it.

## G. Required edit history and retention

Use field-level deltas, not only entity snapshots. Deltas answer who/when/from/to directly and make a later selective revert practical. A `change_group_id` ties all changes made in one request or future bulk action together.

```sql
edit_history (
  id uuid primary key,
  change_group_id uuid not null,
  entity_id uuid not null references managed_entities(id) on delete restrict,
  entity_type text not null,
  field_name text not null,
  event_type text not null check (event_type in
    ('human_edit','validated_relation_edit','override_resolution','source_import')),
  old_value jsonb,
  new_value jsonb,
  actor_user_id uuid references users(id) on delete restrict,
  import_run_id uuid references import_runs(id) on delete restrict,
  request_id uuid not null,
  edited_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
)
```

Constraints and indexes:

```text
CHECK exactly one actor path is appropriate: human events have actor_user_id;
import events have import_run_id (a system import may also retain initiating user).
INDEX edit_history(edited_at)                          -- retention deletion
INDEX edit_history(entity_id, edited_at DESC)          -- entity history
INDEX edit_history(change_group_id, edited_at)         -- request/bulk review
INDEX edit_history(actor_user_id, edited_at DESC)      -- actor history
```

The mutable entity row separately keeps current `edited_by_user_id` and `edited_at`; retention never touches those columns.

### Six-month hard-delete cleanup

Use a Vercel Cron production-only function, for example `/api/internal/cron/prune-edit-history`, scheduled once daily. It validates `Authorization: Bearer ${CRON_SECRET}`, executes only:

```sql
DELETE FROM edit_history
WHERE edited_at < now() - interval '6 months';
```

and logs/returns a structured deleted-row count and cutoff timestamp. The delete is naturally idempotent and cannot touch live entity tables. Vercel Cron invokes production Functions and supports `CRON_SECRET` authorization; its schedule/timezone/plan restrictions must be checked at implementation time ([Vercel Cron docs](https://vercel.com/docs/cron-jobs), [secure cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). No archive table, export, or secondary retention store is created.

## H. Optimistic locking: human editor versus human editor

Use numeric revision as the authoritative lock, with `updated_at` as diagnostic metadata. A numeric revision avoids timestamp precision/serialization ambiguity and increments deterministically whenever an entity's effective editable state changes.

```text
GET entity -> { entity, revision: 42, updatedAt: "..." }
PATCH entity -> { expectedRevision: 42, changes: { ... } }
```

Within one transaction, the write path locks/checks the entity row, validates role and fields, writes the baseline/override/relation changes and audit deltas, then advances revision to 43. It succeeds only where `revision = expectedRevision`.

On mismatch, return:

```http
409 Conflict
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This record changed after it was loaded.",
    "expectedRevision": 42,
    "currentRevision": 43,
    "currentUpdatedAt": "2026-09-19T...Z"
  }
}
```

The UI preserves the unsaved draft, presents current versus submitted fields, and offers reload/copy-draft/intentional manual merge. It must not retry automatically or silently apply last-write-wins. An importer changing a baseline also advances revision, so an editor working from stale data is safely asked to review it.

## I. Drizzle and migration structure

Proposed implementation layout:

```text
db/
  client.ts                 # lazy, server-only Neon/Drizzle client
  schema/
    auth.ts                 # generated then reviewed Better Auth mapping
    core.ts                 # snapshots, entities, import/export runs
    character.ts
    skin.ts
    assets.ts
    overrides.ts
    audit.ts
  schema.ts                 # explicit exports for drizzle-kit
  migrations/
    0000_...sql
    meta/...
drizzle.config.ts
server/
  auth.ts
  authorization.ts
  validation/
  services/
scripts/
  import-character-skin.ts
  export-public-data.ts
  validate-db-parity.ts
```

Use one `drizzle.config.ts` that reads server-only `DATABASE_URL` at command execution. Keep `.env.local` uncommitted; define Vercel Production, Preview, and Development variables in the hosting dashboard/CI secret store. `DATABASE_URL` never receives a `VITE_` prefix.

Migration and verification commands:

```text
npm run db:generate    -> drizzle-kit generate after reviewed schema changes
npm run db:migrate -- --target=development -> reviewed migration executor against explicitly selected DATABASE_URL
npm run db:check       -> migration status/schema/FK smoke checks
npm run db:import:character-skin
npm run db:export-public
npm run db:parity
```

Migration policy:

1. Generated SQL is committed, read in PR review, and never replaced by `drizzle-kit push` in a shared environment.
2. `scripts/db-migrate.mjs` is the single migration executor for development, Preview, and separately approved Production runs. It delegates ordering, hash verification, journal writes, and transaction behavior to Drizzle's migrator; a fresh 0000→0003 replay is covered by `db:drizzle-normal-replay-proof` on Neon PostgreSQL 18.6.
3. The target must be named explicitly (`development`, `preview`, or `production`); the executor never selects a branch or runs during a build/deploy.
4. Development migrations are manually run only against the named non-production branch.
5. A Preview database branch receives the same committed migrations through a gated CI/manual migration job before preview acceptance tests.
6. Vercel build/deploy functions never auto-run migrations.
7. Production migration is a separately protected, owner-approved job after a fresh backup/restore point, reviewed SQL, a tested preview migration, and a rollback/forward-fix note.
8. Destructive migration SQL (`DROP`, data rewrite, narrowing type, or non-null backfill risk) needs explicit owner confirmation in that release; default is an expand/backfill/dual-read/contract sequence.

## J. Vercel server/API architecture

Keep the Vite SPA. Add small Node-runtime Vercel Functions under `api/`; do not convert the project to Next.js.

```text
api/
  auth/[...path].ts                 # Better Auth Request/Response handler
  admin/session.ts
  admin/characters/index.ts
  admin/characters/[characterId].ts
  admin/skins/index.ts
  admin/skins/[skinId].ts
  admin/reference/series.ts
  admin/reference/acquisitions.ts
  internal/cron/prune-edit-history.ts
```

The current catch-all Vercel SPA rewrite must be adjusted during implementation so real `/api/*` function routes are preserved and only unknown client routes fall through to `index.html`. API functions use a module-scoped lazy Neon/Drizzle client configured by server-only `DATABASE_URL`; they do not create a browser database client.

Use the Neon serverless driver with Drizzle's transaction-capable serverless/Postgres configuration, verified in Milestone B with a transaction test that writes an entity change and its audit rows atomically. If a driver/runtime combination cannot provide an interactive transaction on Vercel, that is a concrete foundation blocker: do not implement separate non-atomic writes as a workaround.

Every mutation follows:

```text
request -> same-origin/CSRF guard -> session -> active user -> role/field allowlist
        -> payload validation -> optimistic revision check -> transaction
        -> domain/override write + entity metadata + audit rows -> structured response
```

Error envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields are invalid.",
    "fields": { "seriesId": "Unknown Series." },
    "requestId": "uuid"
  }
}
```

Use `401 UNAUTHENTICATED`, `403 FIELD_FORBIDDEN`, `404 NOT_FOUND`, `409 VERSION_CONFLICT` or `SOURCE_CHANGED_REVIEW_REQUIRED`, `422 VALIDATION_FAILED`, and `500 INTERNAL_ERROR`. Never return a database driver error, source credential, or stack trace to the client.

## K. Neon environment and branch strategy

The existing Neon project is `empty-smoke-82458354`; its `production` branch remains untouched in this milestone. Do not use that branch for implementation or initial migrations.

Recommended hierarchy once the owner authorizes setup:

```text
production                         Vercel Production only
development                        local developers; non-production data
preview/pr-<number>-<slug>         one temporary Vercel Preview / PR test branch
```

Create preview branches from `development` for the initial feature, not from production, because the admin system will contain user/account data and no production testing requires copying it. Assign each Preview deployment only the matching branch's server-side `DATABASE_URL`; production has its own protected value. Tear down or reset preview branches after PR close/merge under an approved operational procedure.

Neon branches are isolated with distinct connection strings and support branch-per-PR workflows; their official guidance also uses `preview/pr-<pull_request_number>-<git_branch_name>` naming ([Neon branching workflow](https://neon.com/docs/get-started-with-neon/workflow-primer?a=9415b291-804f-4bb4-9807-4ce1c6e15400)). Automating branch creation/deletion with GitHub Actions is a later implementation detail, not a reason to link this repository to production now.

## L. Deterministic Character/Skin import flow

The importer is a server-side CLI/CI job, not a Vercel request handler and not a web build side effect.

```text
1. Read a pinned raw MasterData receipt, workbook fingerprint, and current normalized inputs.
2. Validate source shape, exact relations, workbook headers, 145-skin invariants, and asset metadata.
3. Create/reuse source_snapshot records based on source kind/version/content hash.
4. Normalize Character/Skin/Series/acquisition/asset candidates in memory.
5. In one transaction, upsert source baselines and source relations.
6. Compare every active override to its frozen base hash; retain+flag conflicts.
7. Do not delete rows omitted by a source. Report them as absent/unseen for explicit review.
8. Commit and emit inserted/updated/unchanged/conflicted/skipped counts plus import_run ID.
```

Idempotency means re-running byte-identical inputs creates no effective changes, no duplicate rows, and no duplicate audit deltas. Any source import event must identify its `import_run_id`; it cannot impersonate a human editor.

## M. PostgreSQL to `public/data.json` export flow

The exporter must reproduce the existing frontend-compatible snapshot shape, including `characters`, nested `skins`, `items`, `expCurve`, `rankUpRules`, `buff_registry`, and asset base URL. Character/Skin data should be read from effective source-plus-override views; deferred domains can remain on the existing trusted pipeline until their DB importer/exporter parity is proven.

```text
selected DB snapshot + retained trusted inputs
  -> explicit effective-value queries
  -> stable ordering by raw IDs / documented display order
  -> deterministic JSON serialization
  -> schema + parity validators
  -> public/data.json draft
  -> reviewable Git diff and commit
```

No admin/session/audit/provenance fields, raw protected relation internals, or secrets may enter the public JSON.

Do not run this exporter inside a Vercel Function and expect it to persist a deployment file: Vercel runtime files are not the Git worktree or a publication channel. Instead, run it locally against the selected non-production branch or in a protected CI export job that produces a PR/artifact; review and commit `public/data.json`, then let the normal Vercel deploy publish it. This preserves deterministic review and the owner’s Git-tracked artifact requirement.

`git revert public/data.json` reverts only the static snapshot. Database reversal remains a separate migration/backup operation.

Required checks before accepting an export:

- byte-identical repeated export from unchanged inputs;
- public JSON schema/shape compatibility;
- Character/Skin key and count parity, including 145 actual skins, 10 high skins, and null Series for `S0174003`;
- existing `validate_public_output.py`, `validate_skin_roster.py`, `validate_skin_assets.py`, `validate_data.py`, and `npm run build`;
- field-by-field focused parity between the legacy builder and DB exporter for the first migrated scope.

## N. Migration workflow

### Development

After owner approval, create the specified feature branch only after checking the existing dirty worktree. Connect local server/tools only to `development`; generate/review migration SQL; migrate manually; seed/import a safe source receipt; run API/import/export tests.

### Preview

Create a matching non-production Neon preview branch, apply reviewed committed migrations through the gated job, and set the Preview-only server variable. Deploy the feature branch to Vercel Preview. Test login, role boundaries, Character/Skin reads and edits, validation, reload persistence, audit history, 409 conflict, source override conflict, deterministic export, and current public frontend behavior. A Preview deploy does not migrate production.

### Production

After Preview success and owner approval: take/verify a Neon restore point and logical export, review migration SQL and schema diff, run the protected production migration job, validate import/export, commit/review generated `public/data.json` as required, deploy, and smoke-test both admin and public read paths. Record migration IDs, DB branch, source snapshot, export hash, and deployment ID in the release note.

## O. Backup and rollback strategy

- Before every production migration, create and verify a named Neon restore point/branch and a logical schema/data export appropriate to the current plan.
- Test the migration first on the isolated preview branch and retain the exact reviewed SQL.
- Prefer backward-compatible expand/backfill/contract migrations. For data mistakes, use a forward corrective migration or a transactionally audited restore rather than an unreviewed down migration.
- Application rollback: redeploy the prior known-good Vercel artifact only when its schema compatibility is confirmed.
- Public JSON rollback: revert the reviewed artifact commit, then deploy; this does not roll back the database.
- Database rollback: restore/branch from the approved point in time or execute a tested forward fix. Neon branching can create an isolated point-in-time branch; retention/plan limits must be verified immediately before a real incident response ([Neon recovery overview](https://neon.com/blog/point-in-time-recovery)).

## P. Security risks and safeguards

| Risk | Safeguard |
| --- | --- |
| DB credentials in browser | Only Vercel Functions/CLI read `DATABASE_URL`; no `VITE_DATABASE_URL`; secret scan and code review. |
| Shared or weak admin credential | One account per person, Better Auth-managed hashes/sessions, owner-created invitations, disabled-user/session revocation. |
| Client-side role bypass | Server reloads session/user role and enforces per-field allowlists on every write. |
| CSRF/session abuse | HttpOnly secure same-site cookies, origin checks on mutations, host allowlist, generic login errors, rate limiting. |
| Lost concurrent edits | Numeric optimistic revision and `409`, no automatic retry/last-write-wins. |
| Import overwrites human work | Frozen base source hash/value, active override retention, explicit `source_changed` review state. |
| Raw relationship corruption | No regular mutation endpoints for raw fields/relations; typed FKs and source-only importer. |
| Partial edit/audit write | One DB transaction for entity/override/revision/audit changes. |
| Audit over-retention | Indexed, authenticated, production-only six-month hard-delete cron. |
| Preview affects production | Separate Neon branches and Vercel environment variables; migration job never targets production without approval. |
| Unreviewed static publication | Export runs outside Vercel runtime, validators plus Git diff/commit review. |
| Stable asset cache regression | Preserve existing cache note; do not alter asset headers in this milestone. |

## Q. Exact proposed implementation milestones

1. **B — Foundation:** authorized setup only; create `development` branch; add pinned Drizzle/Neon/Better Auth dependencies; server-only client; reviewed schema and first migrations; transaction proof; protected health check.
2. **C — Import:** source snapshot/fingerprint receipts; deterministic Character/Skin/Series/acquisition/asset importer; idempotency and override-conflict tests; no workbook mutation.
3. **D — Admin:** auth route/session client; owner/editor authorization; Character/Skin list/detail/edit APIs and protected UI; typed validated pickers; revision conflicts; `edit_history`; production-only retention cron.
4. **E — Export:** effective-value views; deterministic DB exporter; focused legacy parity fixtures; current validators/build; reviewable `public/data.json` workflow.
5. **F — Preview:** PR-specific Neon preview branch; reviewed migration; Vercel Preview API/UI tests; role, conflict, import-preservation, export, and public-site acceptance gate.
6. **G — Production:** owner-approved protected migration after backup/restore point; controlled import/export/deploy; smoke tests; release record and state-document refresh.
7. **Later:** Skill/Buff/Weapon raw-relation imports, asset/localization administration, workbook patch automation, richer review/revert UI, and an explicit owner decision on whether PostgreSQL becomes localization authority.

## R. Concrete blockers and owner-review decisions

No code or environment blocker was found for the locked Neon + Drizzle direction. The present codebase is compatible with a small Vercel Function layer; it does not justify a Next.js rewrite.

The following must be confirmed during owner review because they alter operational authority or release behavior, rather than merely implementation detail:

1. **Workbook reconciliation gate:** approve the proposed default that production export blocks unreconciled workbook-owned localization overrides unless an owner explicitly marks them publishable. This is necessary to preserve the locked workbook authority while still enabling hosted CRUD.
2. **Initial account provisioning:** approve owner-created/invited accounts only, with public self-signup disabled. This is the safer default for a private multi-user admin.
3. **Preview branch automation timing:** begin with manually controlled `development` and `preview/pr-*` Neon branches, then add GitHub Actions automation after the first end-to-end path is proven. This avoids putting a Neon management credential into CI before the architecture is validated.

The repository has a heavily pre-existing dirty/untracked worktree (including an untracked `docs/` directory and localization/assets/tooling artifacts). This proposal intentionally creates only this one requested file and makes no claim that those existing changes are clean, owned, or ready to commit.
