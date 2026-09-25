# WHMX / WhmxCalc / NeoArtifacts — COMPLETE TECHNICAL HANDOFF

> **Status sections §11–§25 are superseded** by the entry point below; §1–§10 and §26–§29 remain valid background.
>
> **Entry point:** [`WHMX_CURRENT_STATE_FINAL_2026-09-26.md`](WHMX_CURRENT_STATE_FINAL_2026-09-26.md) (status, infrastructure, rules, backlog). Related: [`WHMX_APP_ARCHITECTURE.md`](WHMX_APP_ARCHITECTURE.md), [`WHMX_MASTERDATA_ID_CONVENTIONS(5).md`](WHMX_MASTERDATA_ID_CONVENTIONS(5).md), [`POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md`](POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md). Older handoffs, `WHMX_NEXT_STEPS.md` and finished plans were removed on 2026-09-26 — links to them below resolve in git history only.

**Checkpoint:** 2026-09-20  
**Audience:** A fresh ChatGPT/Codex/Antigravity instance with no access to the original conversation  
**Purpose:** Preserve the current working knowledge required to continue WHMX localization, raw/runtime extraction, R2 assets, public frontend, PostgreSQL/Admin CRUD, application architecture, and the upcoming architecture migration safely.

> **SUPERSEDING HANDOFF:** This document supersedes `WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-16.md` where they conflict. The older handoff remains useful historical evidence for abandoned/superseded paths.
>
> **Mandatory companions:**
>
> - `WHMX_CURRENT_STATE_FINAL_2026-09-20.md`
> - `WHMX_MASTERDATA_ID_CONVENTIONS.md`
> - `WhmxCalc/docs/WHMX_APP_ARCHITECTURE.md`
>
> ID shape is never authority. Raw exact relationships and provenance win.

---

# 0. HOW TO USE THIS HANDOFF

For a fresh continuation:

1. Read `WHMX_CURRENT_STATE_FINAL_2026-09-20.md` first for the latest compact state.
2. Read `WHMX_MASTERDATA_ID_CONVENTIONS.md` before interpreting skill/buff/skin IDs.
3. Read `WhmxCalc/docs/WHMX_APP_ARCHITECTURE.md` before substantial frontend/server organization work.
4. Read this handoff when history, implementation constraints, milestone details, or superseded paths matter.
5. Inspect live repository state before mutation; never assume the worktree is clean.
6. Do not ask the owner to re-explain history already preserved here.

Shared project docs belong at:

```text
D:\BaiTapCode\WHMX\
```

Repo-specific application docs belong inside the repo where appropriate.

---

# 1. PROJECT GOAL / REPOSITORIES

Workspace:

```text
D:\BaiTapCode\WHMX\
├─ NeoArtifacts\
└─ WhmxCalc\
```

## NeoArtifacts

Role:

- obtain/decrypt/deserialize current game data;
- maintain immutable runtime snapshots/provenance;
- diff/apply natural game updates;
- resolve exact AssetBundle identities;
- materialize character/Hoán Chương/assets from runtime;
- provide raw CN/gameplay/source evidence.

Raw downloaded/decrypted source material is evidence and must not be hand-edited to fit assumptions. Tool code may be changed only when explicitly in scope.

## WhmxCalc

Role:

- persistent Vietnamese localization workbook;
- generated public game-data snapshot;
- Vite public website;
- R2-backed asset delivery;
- hosted PostgreSQL working/Admin layer;
- Better Auth multi-user Admin;
- Character/Skin/Preview CRUD;
- future Profile/Skill/Buff/Guide/Tier List administration.

Current working branch:

```text
feat/postgres-admin-crud
```

Production site:

```text
https://whmxsite.vercel.app/
```

Git remote:

```text
https://github.com/SangHuynh2508/whmxsite.git
```

---

# 2. AUTHORITY MODEL

Current authority chain is intentionally split by concern:

```text
NeoArtifacts raw MasterData/runtime
= raw CN, raw IDs, exact relationships, gameplay semantics,
  immutable runtime evidence, asset provenance

WhmxCalc/localization/localization_master.xlsx
= current persistent Vietnamese localization authority

Neon PostgreSQL
= hosted normalized working/Admin layer for implemented domains,
  human overrides, revision state, audit, preview/managed entities

WhmxCalc/public/data.json
= current generated read-optimized public projection
```

Important distinctions:

- Imported PostgreSQL data does not automatically become stronger authority than its source.
- Human-managed DB overrides are explicit and audited; they do not authorize rewriting raw relationships.
- Public JSON is output, never source authority.
- Localization authority transfer from workbook to PostgreSQL is still OPEN and requires an explicit reconciliation/rollback decision.
- Exact raw relations beat ID/suffix/text similarity.

---

# 3. GLOBAL OPERATING RULES

Git/worktree:

- dirty worktrees are allowed;
- never `git reset --hard`, `git clean`, `git restore .`, `git checkout .`, or broad deletion;
- stage exact reviewed files only;
- inspect `git status --short --branch`, `git diff --stat`, `git diff`, `git diff --check` before Git operations;
- do not assume all untracked files are meant for Git;
- never commit `.env`, `.env.local`, credentials, tokens, private DB URLs, cookies, session material, raw PCAP/captures or generated secrets.

Production:

- Neon production is not for normal implementation;
- production R2 must not be mutated outside explicit production scope;
- build and deploy are separate operations;
- Vercel deploy must not silently run DB migrations.

Owner interaction:

- project chat uses informal Vietnamese `tao/mày`;
- plain `ok/oke` means approval of the just-presented proposal;
- omitted numbered choices are treated as accepted unless owner states otherwise.

Agent choice:

```text
Luna High = default implementation/prompt agent
Terra High = architecture/security/migration-critical/deep reverse/repo-wide refactor
```

---

# 4. RUNTIME UPDATE PIPELINE — CURRENT PRODUCTION-PROVEN STATE

Historical 2026-09-16 handoff still focused on passive capture/direct transport discovery. That path is now superseded for normal updates.

Current authoritative runtime snapshot:

```text
r3026-20260917T074908111475Z
```

Pointer:

```text
NeoArtifacts/Assets/runtime_snapshots/current_authoritative_snapshot.json
```

Normal integrated commands:

```bash
python NeoArtifacts.py runtime-update check
python NeoArtifacts.py runtime-update plan
python NeoArtifacts.py runtime-update apply
```

Proven update:

```text
r3021 -> r3026
13 content-changed bundles
0 added
0 removed
FileMD5-based delta
MasterData/lang refreshed
final consistency gate PASS
immutable snapshot created
authoritative pointer updated
post-check -> UP_TO_DATE
```

Current architecture:

```text
stable local authoritative snapshot
+ MuMu/runtime state
+ data.dat / BuildAB index diff
-> check
-> plan exact delta
-> apply exact bundle/source changes
-> immutable new snapshot
-> atomic authoritative pointer update
```

`capture_runtime_update.py` is now forensic/debug/reverse tooling, not the ordinary update path.

Direct runtime HTTP transport remains intentionally parked:

```text
PAUSED INTENTIONALLY
NOT FAILED
NOT ABANDONED
```

Do not redo passive network reverse work unless a real updater anomaly or explicit direct-transport task requires it.

---

# 5. ASSETBUNDLE / DECRYPT / CHARACTER MATERIALIZATION

WHMX `.ab` files used by the current runtime pipeline are Unity AssetBundle/UnityFS containers.

The project already contains working AssetBundle decrypt logic. Important distinction:

```text
AssetBundle / UnityFS
-> game-specific XOR/obfuscation handling

CFC / language / launch payload
-> AES-based handling in separate paths
```

Do not confuse the AES keys used by CFC/server data with UnityFS bundle decrypt.

Character materialization pipeline should be understood as:

```text
runtime snapshot
-> exact indexed logical bundle / MD5Name / FileMD5
-> verify/pull exact bundle
-> decrypt UnityFS
-> load bundle objects
-> export required character assets
-> provenance/manifest
```

This pipeline is already the right foundation for future animation/chibi research. If later searching for Spine/Live2D/chibi, extend bundle object discovery to types such as `TextAsset`, `MonoBehaviour`, `GameObject`, `Animator`, `AnimationClip`, `SpriteAtlas`, `Mesh`, `Material`, skeleton/atlas/moc data. Do not build a second asset downloader first.

Current asset category decisions:

- `archive` is useful profile/artifact imagery and stays distinct;
- characterSkins already covers base/upgraded/skin image identities;
- no redundant generic `skin` asset category is required;
- 001/002/003+ conventions are useful only as supporting structure; exact raw semantics still decide public meaning.

Runtime index identity fields:

```text
MD5Name = exact storage/lookup filename
FileMD5 = content verification checksum
```

Never substitute one for the other.

---

# 6. R2 / CDN MIGRATION — COMPLETE FOR CARD/DRAWING

Cloudflare R2 bucket:

```text
whmx-assets
```

Public dev endpoint:

```text
https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev
```

Current migrated objects:

```text
411 cards
411 drawings
822 total WebP
all lowercase keys
~234.9 MB total
source set ~1.32 GB
quality 88, method 4
822/822 validation PASS
```

Example:

```text
characters/a0001/drawings/a0001001.webp
```

Current public build:

```text
133 characters
822 remote URLs
0 mapping errors
```

R2 is object storage/CDN, not the web host. Vercel still hosts the application.

Current delivery split:

```text
R2:
- card
- drawing
- managed/preview assets

local public assets:
- avatar
- item icons
- Series badges
- other small/legacy categories
```

Case sensitivity is real on R2/Linux. Remote keys and generated URLs use normalized lowercase. Never rely on Windows case-insensitive behavior.

Stable named asset cache note remains unresolved infrastructure debt: do not use `immutable` semantics blindly for stable non-hashed URLs that may be corrected in place.

---

# 7. MANAGED ASSET / PREVIEW CHARACTER ARCHITECTURE

Preview Character is a separate managed entity concept, not a fake raw Character.

Current accepted concepts:

```text
managed_entities / preview characters
origin: manual_preview / source_backed
status/lifecycle controls
visibility controls
optional claimed raw ID
entity_asset_mappings
revision/audit
```

Claimed raw ID is non-authoritative until reconciled by exact evidence/owner confirmation.

Managed asset flow:

```text
Admin requests upload intent
-> server validates permission + target
-> server issues scoped short-lived presigned R2 URL to quarantine key
-> browser uploads bytes directly to R2
-> server verifies object/decode/hash/metadata
-> server transactionally activates canonical mapping
```

Security rules:

- no R2 credentials in browser;
- no unrestricted/unscoped object mutation;
- browser does not self-finalize/activate mapping;
- invalid/unverified object is not published.

Completed preview/asset milestones:

```text
D0 design      COMPLETE
D0A DB/domain COMPLETE
D0B R2 pipeline COMPLETE
D0C Admin UI/API COMPLETE
```

---

# 8. SKIN / SERIES / ACQUISITION / ASSET INVARIANTS

Current public/domain counts:

```text
Characters                 133
Actual skins               145
High Skins                  10
Actual-skin Series refs     19
Canonical skin mappings    435
```

Actual skins:

```text
145 unique skin IDs
all skin_type = 3
```

Intentional no-Series case:

```text
S0174003
skinLOGO = 0
```

Do not fabricate a Series.

Canonical Series IDs 202–220 remain accepted. Special:

```text
205 -> Phi Di
```

Only detail context may show:

```text
Phi Di (Di sản phi vật thể)
```

`102 -> 精研 -> Tinh Nghiên` belongs to type-2/breakthrough context, not the actual-skin Series filter set.

High Skin eligibility is semantic:

```text
is_high_skin
```

Never infer High Skin from `series_id == 220`.

Current acquisition normalization:

```text
premium   10
travel    13
event     13
shop     106
training   1
story      1
free       1
```

Total = 145.

Base appearance naming:

```text
肖形 / 造形 -> Tạo Hình
写照       -> Chân Dung
```

Accepted image convention:

```text
001 base/original
002 upgraded/base portrait
003+ skin candidates; exact raw record remains authority
```

---

# 9. LOCALIZATION WORKFLOW / TERMINOLOGY

Persistent VI authority:

```text
WhmxCalc/localization/localization_master.xlsx
```

Generated layers:

```text
localization/generated_localization.json
-> tools/build_web_data.py
-> public/data.json
```

Never author gameplay translations directly in frontend/build code as the canonical source.

Translation rules:

- owner choice overrides heuristics;
- canonical Character names must be reused in skills/lore;
- identity/private named terms strongly favor Hán-Việt when understandable;
- global/common mechanics may use natural Vietnamese when verified across usage;
- do not hybridize one identity compound;
- same CN with different IDs remains distinct internally;
- rich-text tags, markers and placeholders are preserved exactly;
- BUFF-first where skill wording depends on exact buff identity.

Important current terms:

```text
瞄准   -> Nhắm Bắn       # class/gameplay mechanic
援护   -> Hộ Vệ
眩晕   -> Choáng
沉睡   -> Ngủ Say
流失   -> Mất Máu
霜冻   -> Sương Giá
寒刃   -> Hàn Nhận
酿酒   -> Nhưỡng Tửu
火山灰 -> Tro Núi Lửa
熔融   -> Nóng Chảy
附骨   -> Phụ Cốt
咒溃   -> Suy Kiệt
烟雾   -> Yên Vụ
炎夏   -> Viêm Hạ
```

Other accepted named terms include `Người Đại Diện Tố Tụng`, `Hang Thỏ`, `Thủy Tinh Bôi Đầu Ảnh`, `Phấn Sắc Kinh Hỉ`, `Cung Phụng`, `Bán Chạy`, `Kim Qua`, `Tốc Vũ`, `Tiệt Chiêu`, `Nghiệp Chướng`, `Vụ Ẩn`, `Khốn Thú`, `Đoạn Chi`, `Quá Lự`, `Truy Du`, `Ngạch Kiếm`, `Nghiệp Hỏa Chước Thân`.

Important distinction:

```text
same Chinese spelling != same semantic identity
```

For example the project distinguishes class mechanic `瞄准 -> Nhắm Bắn` from raw buff/status identities that may retain a separate canonical term under exact Buff ID context.

Parked packet:

```text
localization/exports/buff_closure_translation_packet_20260917_114332.xlsx
```

Do not auto-apply.

---

# 10. ID / POPUP / EX PRINCIPLES

See `WHMX_MASTERDATA_ID_CONVENTIONS.md` for the full mandatory rules.

Key reminders:

```text
public base slots = 01, 11, 02, 03, 04, 05
06 = NON_BASE_OR_UNKNOWN unless exact raw graph proves its role
Type != slot suffix
ex != automatic Trí Tri
LAN/Lan/BLan have no universal semantics
same name != same ID/effect
```

Popup/data binding must preserve path/branch context. Flat `Buff_ID`-only binding is insufficient for controller/multi-variant graphs.

EX architecture separates:

```text
display_source
parameter_source
```

No hybrid base-title + EX-description object is allowed.

---

# 11. POSTGRESQL ARCHITECTURE — IMPLEMENTED THROUGH D2

Chosen stack:

```text
Neon PostgreSQL
Drizzle ORM / drizzle-kit
Better Auth + Drizzle adapter
Vercel Functions
```

Neon project:

```text
empty-smoke-82458354
```

Current non-production branch:

```text
development
br-bold-butterfly-azt1occt
```

Production remains untouched for normal work.

Migration discipline:

- committed SQL migrations;
- reviewed migration execution;
- standard executor `scripts/db-migrate.mjs`;
- no Vercel auto-migration;
- no arbitrary shared-environment `push` workflow;
- destructive migration requires explicit owner review.

Canonical migrations currently extend through:

```text
0004_odd_magik.sql
```

## Milestone B — Foundation COMPLETE

Foundation included auth/core/source/managed/audit schema, server-only DB access, transaction proof and DB health path.

Core tables originally established included:

```text
users
sessions
accounts
verifications
source_snapshots
managed_entities
import_runs
edit_history
```

Later migrations extend typed Character/Skin/Preview/asset domains.

## Milestone C — Character/Skin import COMPLETE

Implemented typed domain model for:

```text
characters
skins
Series/reference data
acquisition taxonomy/state
source snapshots/import provenance
override/revision behavior
asset mappings
```

Importer is deterministic/idempotent-oriented and does not delete merely because a source omits a row.

Raw/source IDs and relationships remain protected.

Optimistic locking uses numeric revision; stale writes return `409 VERSION_CONFLICT` rather than last-write-wins.

---

# 12. AUTH / ACCOUNT OPERATIONS — D1 COMPLETE

Better Auth is the accepted auth foundation.

Current rules:

```text
one account per person
roles owner/editor
public self-signup disabled
HttpOnly sessions
server-only DB client
all protected writes authorized server-side
```

Initial owner bootstrap issue was fixed after Better Auth 1.7.5 behavior with `autoSignIn:false` was understood.

Password-reset tooling uses Better Auth reset-token flow; no plaintext/custom hash path. Session revocation is part of reset behavior where appropriate.

Local routing/auth regression once came from Vercel local routing / `.vercelignore` / catch-all behavior, not DB correctness; route adapter/body/env handling was corrected.

Security invariants:

- generic invalid-credential response;
- service errors separated from auth failures;
- no raw secret in browser/VITE env;
- no browser direct privileged DB connection;
- role/active user/field allowlist/validation/revision enforced on mutations;
- raw/source-backed fields have no normal CRUD path.

---

# 13. CHARACTER / SKIN ADMIN — D2 THROUGH D2.4.1 COMPLETE

D2 introduced the Vue Character/Skin Admin workspace while older Admin auth/account/Preview sections remain plain JS.

Vue is currently an island/programmatic mount inside a legacy Vite/vanilla application; there is no requirement to rewrite the public app immediately.

Accepted CMS structure:

```text
Characters index/grid
-> Character workspace
   Overview
   Skins
   Source
   History
```

Future Profile/Assets/Skills modules should only appear when actually implemented. Do not create fake placeholder tabs.

D2 evolution:

```text
initial 3-column inspector      rejected as cramped
D2.1 flattened editorial shell accepted
D2.2 selection/cache/avatar fixes
D2.3 workspace architecture + durable naming
D2.4 compact grid/source comparison/skin gallery/source/history
D2.4.1 source + hierarchy + usability correction accepted
```

Latest accepted D2.4.1 behavior:

- no giant near-background outer container in Character/Skin workspace;
- clear Vietnamese labels instead of abbreviations;
- avatar source verified 128×128;
- old crop caused by `object-fit: cover` in horizontal frame;
- fixed with square `contain` presentation;
- editor uses centered modal (~84vw, max 1280px, max 88vh), internal scroll;
- Raw CN + Workbook VI reference on left, editable override on right;
- narrow desktop stacks;
- long text areas bounded;
- X/backdrop/Escape dirty close protection;
- cached modal open does not refetch;
- selection intent/AbortController/stale-response guards retained.

Character source/tag correction:

```text
workbook CHARACTER.tags_cn
== characterTable.CharacterTagLanText
133/133 exact
0 mismatch
```

Distinguish:

```text
CharacterTagLan     = field identity/reference
CharacterTagLanText = raw CN display
```

Current editable override fields:

```text
Character:
name_vi
fullname_vi
nickname_vi
tags_vi

Skin:
name_vi
description_vi
obtain_vi
```

`nicknameVi` has no trustworthy direct CN source currently; show fallback rather than invent a source pairing.

Protected source fields remain read-only.

Proof/regression reported PASS across D2/D1/D0, build, migration/schema/health, conflict, browser layout, cache/no-refetch, and secret checks. `public/data.json` did not change in D2.4.1.

Treat D2.4.1 as closed unless a new observed bug appears.

---

# 14. APP ARCHITECTURE — NOW CANONICAL

Canonical guide:

```text
WhmxCalc/docs/WHMX_APP_ARCHITECTURE.md
```

Its purpose is to stop future Profile/Skill/Buff/Guide/Tier List work from making the repository increasingly flat and tangled.

Status vocabulary:

```text
LOCKED
TARGET
OPEN DECISION
LEGACY
```

Core principles:

## Global shell vs domain

Target frontend organization conceptually:

```text
src/app/        global bootstrap/router/layout/settings
src/features/   characters/skins/profile/skills/buffs/guides/tier-list/assets
src/admin/      cross-cutting Admin shell/auth/audit/management
src/shared/     proven domain-neutral primitives only
src/styles/     tokens/global/typography gradual extraction
```

Do not create empty folders just to imitate a tree.

## Feature-first ownership

Domain rendering/contracts live with the domain. Admin does not own duplicate public renderers.

## Shared promotion rule

Feature-local first. Promote to `shared/` only after real reuse, stable domain-neutral contract, and no feature-specific imports.

## Public renderer reuse

Whenever practical:

```text
same real renderer
-> public page
-> Admin preview
-> future contextual inline edit preview
```

Do not maintain visually similar independent public/Admin implementations without a technical reason.

## Admin architecture

Admin is a cross-cutting authenticated workspace for:

- search/bulk management;
- source comparison;
- audit/history;
- conflict resolution;
- moderation/publication;
- account/asset operations.

Contextual inline editing on public-style pages may coexist with the full CMS.

## TypeScript policy

New substantial frontend/Vue modules should prefer TypeScript. No mass JS-to-TS rewrite is required. Avoid `any` where a real contract is known.

## Backend boundary

Target rule:

```text
api/
= thin HTTP/Vercel adapters

server/
= domain query composition, authorization, transactions, invariants,
  business orchestration

db/
= DB client, schema, migrations, narrowly reusable DB primitives

scripts/tools/
= explicit operational/import/export/build/proof tooling
```

Two wording clarifications are owner-approved but may still be pending in the physical document:

1. scoped server-issued presigned browser upload to R2 is valid;
2. domain-specific query composition belongs to `server/`, not generic `db/`.

The current migration planning task is expected to apply those doc clarifications if still missing.

---

# 15. ARCHITECTURE MIGRATION — CURRENT PLANNING TASK, NOT YET EXECUTION

Owner approved making a safe GitHub rollback point before structural migration.

The current Terra task is authorized to:

1. inspect live dirty Git state;
2. identify accepted vs local/unrelated changes;
3. commit/push accepted uncommitted state using exact staging only;
4. create/push annotated rollback tag:

```text
pre-app-architecture-migration-2026-09-20
```

or a deterministic suffixed tag if the name already exists;

5. audit real path/import/dependency hazards;
6. create:

```text
WhmxCalc/docs/WHMX_ARCHITECTURE_MIGRATION_PLAN.md
```

7. stop before moving production/application files.

No architecture migration is authorized in that planning task.

Important: at the time this handoff was generated, the owner has not yet pasted the completion output for this checkpoint/plan. Therefore do not assume the checkpoint SHA/tag exists. Verify the eventual report.

Planned migration philosophy:

```text
small independently reversible batches
commit/proof per successful batch
no repository-wide move
no behavior redesign
no schema/authority/publication decision hidden inside folder cleanup
```

Potential areas to evaluate include app/global shell, Admin shell, Character/Skin domain placement, flat server modules, and gradual CSS extraction, but the migration plan must choose the actual order from repository dependencies.

---

# 16. PUBLIC DATA DELIVERY — CURRENT VS LONG-TERM

## Current

```text
public Vite SPA
-> generated public/data.json
-> R2/local assets
```

Admin/Auth:

```text
browser
-> Vercel Functions
-> Better Auth / Drizzle
-> Neon PostgreSQL
```

This current split is working, but the old workflow where every routine Admin content change eventually requires the owner to run a local export/build/deploy is no longer acceptable as the long-term hosted CRUD experience.

## Locked long-term requirement

```text
routine hosted Admin Save must not depend on owner local PC
```

## Open implementation

Two paths are under evaluation:

```text
A. direct hosted reads for some views
   frontend -> API/Data API -> Neon

B. unattended public publisher
   PostgreSQL -> validated immutable/versioned release -> R2/CDN
```

Likely hybrid direction:

```text
Admin/live preview -> hosted DB/API
Public high-read encyclopedia -> CDN/R2 published data
Assets -> R2
```

A proposed strong pattern for B is:

```text
new immutable release
-> validate fully
-> upload release
-> atomically switch current manifest/pointer
```

This avoids half-published public state and supports rollback/cache safety.

However the exact publisher, review model, chunking strategy, direct-read routes, and localization-authority implications remain OPEN.

Do not freeze them accidentally during folder migration.

---

# 17. FUTURE DOMAIN DIRECTION — PROFILE / SKILL / BUFF / GUIDE / TIER LIST

Public already has Skill/Buff through the static source/workbook builder, but these are not yet in PostgreSQL Admin CRUD.

Future major domains:

```text
Profile
Skills
Buff/Status
Guides
Tier List
Assets
broader Localization management
```

The owner wants hosted editing to be practical for collaborators.

Target product behavior may include both:

```text
public-style contextual Edit controls for authorized editors
+
full Admin CMS for bulk/search/source/audit/structural tasks
```

Frontend hiding/showing Edit is only UX. All writes remain server-authorized.

Guide/Tier List/Profile content should be data-driven rather than hard-coded permanently into JS. Structured JSON/JSONB content models are acceptable where layout/document structure is naturally block-based, while relational entities/relationships should remain queryable where needed.

Shared renderer principle applies strongly here:

```text
GuideRenderer
TierListRenderer
CharacterProfileRenderer
SkillRenderer
```

should be reusable by public and Admin preview rather than duplicated.

---

# 18. FRONTEND CURRENT REALITY / PERFORMANCE

The project is intentionally mixed:

```text
legacy Vite + vanilla JS public SPA
new Vue 3 Character/Skin Admin island
plain-JS legacy Admin auth/account/Preview sections
Vercel Function backend
```

Do not call legacy code broken merely because it is old.

Current organization debt includes:

- flat/multi-responsibility frontend modules;
- `src/style.css` concentration;
- mixed Admin shell responsibilities;
- flat server domain files;
- older milestone-driven growth.

The canonical architecture exists so new work stops adding to that debt and bounded touched areas can migrate gradually.

Performance observations:

- pure static Vite is fast;
- local Vercel Dev + Neon introduces most observed Admin latency;
- current `public/data.json` is ~14–15 MB and should eventually be chunked rather than grow forever;
- route count itself is not the major performance risk if JS/data are lazy-loaded;
- future chibi/Spine/L2D should not run dozens of active runtimes in roster grids;
- prefer static thumbnail -> on-demand animation runtime -> dispose on leave/offscreen.

---

# 19. UI / DESIGN DIRECTION

Mandatory design skill for substantial UI work:

```text
WhmxCalc/.agents/skills/huashu-design/SKILL.md
```

Read required references before design/rework.

Accepted visual direction:

```text
dark neutral/charcoal canvas
existing warm antique gold accent
editorial/museum rather than SaaS dashboard
restrained typography
artwork focus
few cards/borders/radii/shadows
```

Admin product priority:

```text
rõ > nhanh > ít lỗi > nhất quán > đẹp vừa đủ
```

Do not spend milestones on decorative polish when workflow correctness is the real issue.

Existing Gallery/Character public visual work and Batch 5C motion/Lenis remain accepted and should not be casually redesigned.

---

# 20. HISTORICAL PUBLIC UI / MOTION NOTES STILL RELEVANT

Accepted public routes include:

```text
#/characters
#/gallery
#/weapons
#/calc
#/skins/:skinId
#/characters/:...
```

Legacy aliases remain for compatibility.

Lenis/motion work from earlier UI phase is considered closed unless a new real bug appears.

The Calculator dynamic-height Lenis bug was fixed by observing the real growing content and explicitly resizing Lenis. Do not remove scrollbar-gutter/scroll restoration work casually.

Legacy calculator-era initial screen remains a known stale product area, but owner previously chose not to bundle its redesign into unrelated work.

---

# 21. TEST / VALIDATION PHILOSOPHY

Structural/product changes should preserve relevant regression gates.

Current common gates include:

```text
npm run build
git diff --check
```

plus domain-specific proof scripts for:

```text
D2 Character/Skin
D1 auth/reset
D0 Preview/managed asset
DB schema/migration/transaction/health
local Vercel HTTP
secret scan
public/data.json parity/unchanged checks where relevant
```

Data/public legacy validators still matter when their source paths are touched:

```bash
python tools/validate_public_output.py
python tools/validate_skin_roster.py
python tools/validate_skin_assets.py
python tools/validate_data.py
```

Do not rerun expensive broad suites repeatedly during simple edits unless debugging requires it; run the appropriate comprehensive regression before accepting a milestone/batch.

---

# 22. CURRENT DEFERRED / OPEN ITEMS

Deferred unless owner resumes:

```text
Direct runtime HTTP transport reverse
Packet61 original character-card visual reconstruction
parked buff closure auto-apply
broad mobile redesign without audit
stable-name asset cache-header cleanup unless touching infra
mass JS -> TS rewrite
big-bang project reorganization
```

Open architectural decisions:

```text
exact public-data publisher vs direct hosted read split
workbook -> PostgreSQL localization authority transfer
publication review/approval semantics
public data chunk/version manifest details
```

Known future functional areas:

```text
Skill/Buff DB + Translation Admin
Profile
Guide
Tier List
Admin audit/operations expansion
DB -> public publication
Preview/public promotion flow
```

---

# 23. CURRENT NEXT STEP

At this checkpoint the active waiting task is the Terra pre-migration safety + planning run.

Expected report must include:

- Git state before checkpoint;
- exact accepted paths committed;
- excluded dirty/untracked paths and reasons;
- validation results;
- checkpoint commit SHA;
- pushed branch/remote;
- pushed rollback tag;
- `docs/WHMX_ARCHITECTURE_MIGRATION_PLAN.md`;
- proposed bounded batches;
- recommended first batch/risk;
- confirmation that no app files were moved.

After that report arrives:

```text
review plan
-> approve/adjust batch order
-> only then execute first small migration batch
```

Do not begin structural moves simply because the canonical architecture exists.

---

# 24. CONTINUATION CHECKLIST FOR A NEW AGENT

Before coding:

1. Read current state.
2. Read app architecture.
3. Read ID conventions if raw data/Skill/Buff/Skin is involved.
4. Read this handoff for the relevant deeper track.
5. Inspect Git/live files.
6. Preserve dirty work.
7. Use exact source relations.
8. Keep secrets/server-only boundaries.
9. Do not touch production unless explicitly scoped.
10. If doing UI, read Huashu skill.
11. If doing structural migration, follow the approved migration plan and rollback tag.
12. If doing new substantial frontend code, prefer TypeScript without rewriting unrelated legacy.
13. Reuse real public renderers for Admin preview where practical.
14. Do not introduce a new public-data architecture assumption silently.
15. Report facts/observations/hypotheses separately when evidence is incomplete.

---

# 25. CURRENT STATUS IN ONE LINE

WHMX has moved beyond a static-only project: runtime updates and asset delivery are automated/proven, R2 serves heavy art, Neon/Drizzle/Better Auth power hosted multi-user Admin CRUD, Character/Skin D2.4.1 is accepted, and the next controlled step is a GitHub rollback checkpoint plus an owner-reviewed incremental architecture migration plan before any repository-wide structural move.

---

# 26. NEOARTIFACTS HISTORICAL TECHNICAL RECORD — PRESERVE, DO NOT REPEAT BLINDLY

This section intentionally preserves the important NeoArtifacts work that led to the current `runtime-update` pipeline. It exists so a fresh agent can understand not only the current commands, but also what was previously tried, what evidence established the current model, and which old conclusions are superseded.

The rule for this historical appendix is:

```text
current sections 1–25
= current operational truth

section 26+
= historical/provenance record

if they conflict:
current 2026-09-20 state wins
```

## 26.1 Evolution of the runtime/update work

The NeoArtifacts path evolved through these stages:

```text
old static/base downloader
-> SmallPack/base-packet verification
-> mismatch discovered between local base state and live runtime
-> rooted MuMu inspection
-> exact live data.dat / bundle inventory
-> D0183 targeted extraction
-> passive log/network update investigation
-> reusable natural-update capture tooling
-> character-centric exact bundle materialization
-> Hoán Chương asset sync
-> immutable runtime snapshot model
-> runtime-update check / plan / apply
-> proven r3021 -> r3026 delta update
```

Important superseded conclusion:

```text
r3021 does NOT imply SmallPack s3021
```

The live game proved `smallPackVersion=s2856` and `resVersion=r3021` could coexist. The project therefore stopped treating the SmallPack namespace and runtime resource namespace as the same sequence.

Passive capture/direct transport work was necessary historical reverse engineering, but it is no longer the normal update path. Keep it only for anomalies or explicit direct-download reverse work.

## 26.2 Character materialization and Hoán Chương asset sync

The character materialization pipeline was proven before the newer runtime updater and remains important provenance for the asset model.

## B. NeoArtifacts runtime snapshot / character asset pipeline

The character materialization pipeline is now **closed/accepted** unless a concrete bug appears.

Current accepted snapshot:

```text
r3021-20260915T080728349568Z-D0183
```

Properties:
- exact `data.dat` r3021;
- immutable snapshot/provenance;
- asset index and MasterData captured in the same internally-created runtime session;
- compatibility: `SAME_RUNTIME_STATE_PROVENANCE`;
- no `--allow-mixed-sources` is required for this snapshot.

Current MuMu ADB executable:

```text
D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe
```

Current proven endpoint used for the completed materialization work:

```text
127.0.0.1:16384
```

Current startup/preflight:

```bash
ADB="/d/Program Files/Netease/MuMuPlayer/nx_device/15.0/shell/adb.exe"
"$ADB" connect 127.0.0.1:16384
"$ADB" -s 127.0.0.1:16384 root
"$ADB" connect 127.0.0.1:16384
"$ADB" devices
```

Root may need to be re-enabled after emulator/ADB restart. Older `emulator-5554` / `127.0.0.1:7555` details in this handoff are historical and must not override the currently connected endpoint.

Accepted full character bulk result:

```text
roster_characters=134
characters_materialized=134
characters_complete=134
characters_partial=0
characters_failed=0
index_confirmed_included_assets=2952
unique_bundles_required=498
unique_bundles_already_verified=69
unique_bundles_pulled=429
unique_bundles_remote_missing=0
unique_bundles_md5_mismatch=0
unique_bundles_pull_failures=0
index_metadata_conflicts=0
```

Bulk manifest:

```text
NeoArtifacts/Assets/character_sync_history/r3021-20260915T080728349568Z-D0183/bulk_manifest.json
```

Important distinction:
- **134** = current `MATERIALIZABLE_CHARACTER_ROSTER` for asset materialization.
- **133** = historical/current localization roster closure.
- Do not silently force these numbers to match.

Current character asset categories:

```text
included:
avatar
special_avatar
card
drawing
skill_icon
archive
skin_activity
guide
promo
background
cg

excluded by default:
novel_character
drawing_spine
battle_model
battle_effect
audio
storyboard
```

Owner decisions:
- `archive` is useful artifact/profile imagery and remains a distinct included category.
- `characterSkins` already covers base/upgraded/skin images:
  - `001` base/original
  - `002` upgraded/base variant
  - `003+` skins
- no separate generic `skin` category is required.

Character manifests use:

```text
character_status
```

not top-level `status`. This mattered when migrating WhmxCalc `copy_assets.py`.

## C. Hoán Chương asset pipeline

Hoán Chương runtime asset sync is **closed/accepted**.

Current result:
- 47 current records/icons from `BrilliantMap` non-empty `Icon`;
- 47/47 exact runtime path matches;
- one bundle:
  - logical: `images_huanzhangicon.ab`
  - MD5Name: `22d8dad9baa4f7d7871b769c18043e60.ab`
  - FileMD5: `dd46746b55e4565a7944ed1316328874`
- current output: `NeoArtifacts/Assets/huanzhang/`
- history: `NeoArtifacts/Assets/huanzhang_sync_history/<snapshot_id>/`

Two current icons absent from the older 45-icon named set:
- `brilliant_a0120.png`
- `brilliant_d0092.png`

The first live attempt misleadingly reported `REMOTE_MISSING`, but the stored error was `Permission denied`. After `adb root`, the private bundle path existed and sync completed. Do not treat permission failure as evidence that the remote bundle is absent.

Ownership relation for Hoán Chương record IDs is currently classified as `ID_PREFIX_CONVENTION`, not `EXPLICIT_FK`.

Current interpretation of that historical result:

- the old `134 materializable` count belonged to that runtime/materialization snapshot and must not be blindly equated with the current public roster count;
- asset categories such as `archive` remain meaningful owner decisions;
- `drawing_spine`, battle models/effects, audio and storyboards were deliberately excluded from the normal character asset materialization scope, not proven nonexistent;
- future chibi/Spine/animation research should extend the existing exact-bundle/decrypt/object-discovery pipeline rather than start from an unrelated downloader;
- Hoán Chương metadata/gameplay/asset ownership must still follow raw evidence rather than suffix heuristics.

## 26.3 D0183 historical investigation

## 8. D0183 history and current status

### 8.1 Localization/controller classification before release

D0183 data first appeared in a preload/incomplete form. Many BUFF_STATUS rows contained only IDs and no Chinese player-facing text. A targeted audit classified:

- 83 `INTERNAL_CONTROLLER` rows.
- 4 player-facing nodes total, including shared dependency `Buff_Intervene`.
- Three D0183 player-facing rows: `Buff_D0183_KG`, `Buff_D0183_WZS`, `Buff_D0183_XS`.
- 0 ambiguous rows at that snapshot.

The 83 controller-only rows were removed from MasterData publication/translation queue but retained in a dependency manifest. They were not treated like ordinary buffs that have CN text. This is why the D0183 cleanup must not become a blanket rule for all BUFF_STATUS rows.

Manifest:

```text
WhmxCalc/localization/manifests/D0183_dependencies.json
```

D0183 initially had lifecycle `PRELOAD`, `public_roster_included:false`, and was deliberately excluded from `public/data.json`.

### 8.2 Release supersedes preload assumption

The owner confirmed D0183 officially released on 2026-09-10. Therefore:

- “Do not add D0183 to roster” is **superseded as a permanent rule**.
- Do not automatically add it without a current source/localization/asset audit.
- Reclassify against official current MasterData, verify all six public slots and exact buffs, translate BUFF-first, obtain art, then onboard it using the same public eligibility gates.

Known community/working terms requiring owner/source verification:

```text
幻戏图 → Huyễn Hý Đồ
提线 → Đề Tuyến
寂处逢生 → Tịch Xứ Phùng Sinh
骷髅相护 / related raw title → Khôi Cốt Thao Diễn was recalled; verify exact CN-ID pairing
玄丝 → Huyền Ti
骷髅 → Khôi Cốt
未知生 → Vị Tri Sinh
```

Do not treat the recalled list as stronger than exact current raw CN.

### 8.3 MasterData identity and skins

After refresh/deserialization:

- `characterTable.json`: ID `D0183`, short/display CN `幻戏图`.
- Full CN: `李嵩《骷髅幻戏图》页`.
- Working Hán-Việt full form: `Lý Tung 《Khô Lâu Huyễn Hý Đồ》 Hiệt`.
- `characterSkins.json`:
  - `D0183001`, base, `肖形`, `skinFile:""`.
  - `D0183002`, non-base, `写照`, `skinFile:""`.

Empty `skinFile` did not mean the drawing bundle was absent. The runtime asset index contained the actual containers.

Current status correction:

- D0183 is no longer a preload-only special case;
- its investigation remains valuable because it exposed several architectural issues: runtime-vs-base asset divergence, case sensitivity, exact bundle resolution, controller-vs-player-facing Buff classification, and the need for immutable provenance;
- do not reapply old preload exclusions to current public logic.

## 26.4 NeoArtifacts downloader/version history

## 9. NeoArtifacts capabilities and version history

### 9.1 Existing CLI

The observed root help listed:

```text
status
download
masterdata
split-cfc
decrypt-assets
deserialize
verify-legacy
painting
```

`download --category` accepts `all`, `assets`, `tables`, `masterdata`, or `fix`, plus workers/retries/force, `--res-version`, `--probe`, `--keep-packets`, `--limit`, repeated `--packet`, `--cfc`, `--lang-ver`, and `--fix-ver`.

Later modifications added or extended:

- `painting --data-dat`
- repeatable `--bundle-dir`
- `--character`
- `--output-dir`
- `painting-plan`
- `adb-pull-drawing`
- provenance sidecar when extracting future CDN `data.dat`

The patch was reviewed for backward compatibility. Default painting still uses `Assets/data.dat` and lookup `Assets/bundles → Assets`. A0001 default export was regression-tested without overwriting the existing PNG.

### 9.2 Version facts

One `status` checkpoint reported:

| Field | Value |
|---|---|
| APK resVersion | `r2856` |
| APK cfcVersion | `1c116e13145cb2da7281afe5f6595baf` |
| APK language | CN |
| launch SmallPack | `s2856` |
| launch ResVersion | `r1880` |
| launch FixVersion | `f3422` |
| launch Config/cfc | `91852aac69f58f14d78568fdb5f26fa4` |
| launch LangData | `5499` |
| clientVersion | `3.2.0` |
| resource CDN | `https://l4-prod-patch-lgmx.bilibiligame.net/resource` |

An older 2026-09-07 source handoff had Fix `f3376`, Lang `5417`, and cfc `521a5ffec5a89909edc937bf771e90e7`; these are **historical/superseded snapshot values**, not current.

Cryptographic keys appeared in tool output but are deliberately omitted. Read them only from authorized local configuration if a task requires them; never copy them into reports or chat.

### 9.3 Base pack download

`s2856` packet config contained 62 files and was described as 8.71 GB; terminal transfer accounting showed approximately 9.4 GB. A subsequent run downloaded 0 and skipped 62 because local packets passed expected-size and MD5 checks.

Code audit confirmed skip logic is not merely “file exists.” `download_file.dest_ok()` checks expected size and checksum.

The `Assets/data.dat` copy was traced to CDN packet `s2856_15`, not the APK:

```text
packet MD5: bad965cd2fe7830046193d90e93f85c2
slice MD5:  73656840ae5a9a726627bb325b62b46d
slice size: 7,171,824 bytes
```

The confirmed refresh sequence was:

```sh
python NeoArtifacts.py masterdata
python NeoArtifacts.py download --category fix
python NeoArtifacts.py deserialize
python NeoArtifacts.py painting
```

Observed results: masterdata/fix files were already cached and verified; `lang 5499_cn.bin → 5499_cn.json` produced 107,718 entries; CFC produced 548/548 JSON tables; painting processed 634/634 drawings with 0 missing AB and 567/634 named in-table, exporting 0 because 634 PNGs already existed.

### 9.4 The probe misconception

**SUPERSEDED CONCLUSION:** “The downloader is stale because it probes only 40 versions past s2856 and therefore misses s3021.”

What remains true: the implementation had a bounded probe-ahead value of 40. What was disproved: that `s3021` should exist or correspond to runtime `r3021`.

Direct request for `s3021` failed:

```text
RuntimeError: 指定版本 s3021 的 packet_config 不存在
```

Raw runtime logging later proved `smallPackVersion=s2856` and `resVersion=r3021` coexist. Do not expand probing blindly or hardcode `s3021`.

### 9.5 Current launch logic

Static code uses an encrypted POST to:

```text
https://le4-prod-all-gateway-lgmx.bilibiligame.net/get_launch_data_v2
https://le3-prod-all-gateway-lgmx.bilibiligame.net/get_launch_data_v2
https://le1-prod-all-gateway-lgmx.bilibiligame.net/get_launch_data_v2
```

Observed code payload schema:

```json
{
  "Platform": "Android",
  "Channel": "onesdk",
  "ClientVersion": "3.2.0",
  "ResVersion": "r1",
  "FixVersion": "",
  "ServerId": "prod"
}
```

Headers include service `net-config`, `KeyVersion: 3.2.0`, and code-side `IsEmulator: False`. Runtime properties reported emulator true. Whether this difference changes response is an unproven hypothesis.

Current precedence in `cmd_download` was traced as:

```text
explicit --res-version
→ successful live launch
→ state/HAR evidence
→ APK fallback
```

PC `version.json` is fallback/cache, not runtime evidence.

Current status correction:

- the bounded SmallPack probe issue was not the true blocker for runtime updates;
- ordinary runtime updates are now handled by the integrated runtime snapshot/delta updater;
- do not enlarge probes or invent `s<runtimeVersion>` mappings without evidence.

## 26.5 MuMu / Android / ADB historical environment

## 10. MuMu / Android / ADB setup

### 10.1 MuMu and ADB paths

MuMu is installed on drive D. Working ADB:

```text
D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe
```

Git Bash form:

```text
/d/Program Files/Netease/MuMuPlayer/nx_device/15.0/shell/adb.exe
```

Another ADB exists at:

```text
D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe
```

Use the `nx_device\15.0\shell` binary for the documented workflow.

### 10.2 Devices and package

Working serial:

```text
emulator-5554
```

TCP connection also worked temporarily:

```text
127.0.0.1:7555
```

When both serials were present, commands without `-s` failed with:

```text
adb.exe: more than one device/emulator
```

Always use explicit `-s emulator-5554` or the runbook variable.

Game package:

```text
com.cipaishe.wuhua.bilibili
```

The package grep also found `com.leiting.yxhs.bilibili`, but that is not the target app.

Launcher/activity evidence:

```text
ONESDKLaunchActivity
MainActivity
```

One capture reported process PID `2495`, but PIDs are ephemeral; resolve the live process instead of reusing it.

### 10.3 Root behavior

`su` is not available:

```text
/system/bin/sh: su: inaccessible or not found
```

MuMu supports direct root adbd:

```text
adb -s emulator-5554 root
adb -s emulator-5554 shell id
```

Verified result:

```text
uid=0(root) gid=0(root) ... context=u:r:su:s0
```

Do not call `su -c`. A prior command with `su -c` did not actually provide `su`; the shell's later `sort -h` error came from Android toybox and should not be mistaken for successful `su`.

MuMu may print `timeout expired while waiting for device` after `adb root` even when a subsequent `shell id` succeeds. The reliable condition is a live explicit serial plus `shell id` returning `uid=0(root)`.

### 10.4 Git Bash path conversion

Git Bash/MSYS converted Android absolute paths into Windows paths and produced:

```text
ls: C:/Program: No such file or directory
ls: Files/Git/sdcard/Android/data/com.cipaishe.wuhua.bilibili: No such file or directory
```

Use either PowerShell or prefix Android-shell commands with:

```text
MSYS_NO_PATHCONV=1
```

### 10.5 Important Android paths

Public/external:

```text
/sdcard/Android/data/com.cipaishe.wuhua.bilibili
/data/media/0/Android/data/com.cipaishe.wuhua.bilibili
/data/media/0/Android/obb/com.cipaishe.wuhua.bilibili
```

Private runtime data:

```text
/data/user/0/com.cipaishe.wuhua.bilibili
/data/user/0/com.cipaishe.wuhua.bilibili/files/data.dat
/data/user/0/com.cipaishe.wuhua.bilibili/files/data.dat.bak
/data/user/0/com.cipaishe.wuhua.bilibili/files/data_config
/data/user/0/com.cipaishe.wuhua.bilibili/files/lang_config
/data/user/0/com.cipaishe.wuhua.bilibili/files/bundles
/data/user/0/com.cipaishe.wuhua.bilibili/files/cdn_s.0
/data/user/0/com.cipaishe.wuhua.bilibili/files/config_s.0
/data/user/0/com.cipaishe.wuhua.bilibili/shared_prefs/
```

Public `/sdcard/.../files/bundles` contained only `LoadImages/guidbg.png` (~2.3 MB). Actual ~9.66 GB runtime data lived under the private path.

Current status correction:

- exact ports/serials are runtime-dependent and may change;
- the later character-sync/runtime updater work also used `127.0.0.1:16384` in a proven setup;
- never hard-code an old serial/port as universal truth;
- always rediscover the live device and verify root before private runtime operations.

## 26.6 Runtime asset evidence and targeted extraction

## 11. Runtime asset evidence and D0183 extraction

### 11.1 Index comparison

| Index | Build | Size | SHA-256 | ABList | Drawings |
|---|---|---:|---|---:|---:|
| `Assets/data.dat` | r2856 | 7,171,824 | `f29cf8a2ef079f01181bf5163788ca193dd4d923d4a8ea3da2270b07114e0fc8` | 6,417 | 634 |
| `emulator_capture/data.dat` | r3021 | 7,483,776 | `73ee2aa122875ab4eee8485a4e7159d782bcd9f1611d0dc795f075c425d22e2e` | 6,711 | 658 |
| `emulator_capture/data.dat.bak` | r3001 | 7,443,824 | `87c7f38554af59e5ea90a58ff98e7315db8c2da4db6e20f951b24ab27436c66f` | 6,664 | 655 |

Bundle counts changed during live observation:

- PC: 6,481 files.
- Runtime initially: 6,748.
- Runtime live audit later: 6,749.
- Exact later comparison: runtime − PC = 277; PC − runtime = 9; net +268.

Do not mix the initial “267” estimate with the exact later set comparison. The 277/9/net-268 result is current for that snapshot.

### 11.2 Exact D0183 drawing records

**D0183001:**

```text
logical AB: character_drawing_d0183001.ab
MD5Name: f3257407cb26f3b78ceb6c5364a797a9.ab
container: assets/_bundleresources/character/d0183/drawing/d0183001.png
FileMD5: 8e88c305490441271c811d13317dcb63
size: 479,973 bytes
local SHA-256: 7d7955…7f7ef1
```

**D0183002:**

```text
logical AB: character_drawing_d0183002.ab
MD5Name: 3426a535b67a63123a944d6b08472951.ab
container: assets/_bundleresources/character/d0183/drawing/d0183002.png
FileMD5: 5224bf80383c4670270d5b0d92869840
size: 2,571,397 bytes
local SHA-256: 4de7d6…c542c2
```

`MD5Name` is the exact storage/lookup filename; `FileMD5` verifies contents. Do not compare one as though it were the other.

### 11.3 Export result

Output directory:

```text
NeoArtifacts/emulator_capture/Painting_D0183/
```

Files:

```text
来古弥新_幻戏图_肖形.png  # 1024×1024 RGBA, 1,007,705 bytes
来古弥新_幻戏图_写照.png  # 2048×2048 RGBA, 4,980,291 bytes
```

Both passed Pillow `verify()` and reopen checks. The owner visually confirmed they are correct. Chinese filenames are normal for the existing painting exporter; numeric IDs belong in provenance, not necessarily filenames.

### 11.4 Safety review of extraction patch

The NeoArtifacts patch was reported as +332/-36 in `NeoArtifacts.py` and +212 for new `tools/audit_runtime_assets.py`. Review found two safety gaps and fixed them:

1. ADB device/package had defaults rather than being required.
2. `LOCAL_VERIFIED` checked MD5 but not remote size.

Current safeguards:

- `adb-pull-drawing` requires explicit `--data-dat`, `--character`, `--device`, and `--package`.
- Device/package and MD5 filenames are syntax-validated.
- No `shell=True` and no `su`.
- Remote path comes only from validated package + exact indexed MD5Name.
- Existing correct files are `LOCAL_VERIFIED` only if remote size and `FileMD5` match.
- Wrong local files become `LOCAL_CONFLICT_NOT_OVERWRITTEN`.
- Fake/missing character fails before pull.
- Missing bundle report includes logical AB, MD5Name, and container.

This evidence established several rules that remain current:

```text
MD5Name = storage lookup name
FileMD5 = content checksum

runtime data.dat
= authoritative runtime asset index for that snapshot

private /data/user/0/.../files/bundles
= actual large runtime bundle store in the investigated MuMu setup
```

It also proved that empty or incomplete higher-level metadata fields do not necessarily mean the underlying asset bundle is absent; exact runtime index/path evidence wins.

## 26.7 Passive update capture and network reverse history

## 12. Runtime update discovery and passive capture

### 12.1 Evidence from rooted runtime

Filtered current-process logcat showed:

```text
D OnesdkPlatform: SetProperties:
{
  "smallPackVersion":"s2856",
  "resVersion":"r3021",
  "serverResVersion":"r1880",
  "fixVersion":"f3422",
  "clientVersion":"3.2.0",
  "langVersion":"5499",
  "configVersion":"91852aac69f58f14d78568fdb5f26fa4",
  "selectServer":"prod",
  "IsEmulator":"True"
}
```

A later cold-start property record reported lang/config as 0 while the same core s/r/f values remained. This shows the properties aggregate multiple initialization sources; it does not invalidate the primary version relationship.

`playerprefs.xml` also contained `SmallPack=s2856`, `FixVersion=f3422`, and persisted `ResVersion=r1880`; it is corroborating persisted state, not proof of current local asset index.

### 12.2 Cold-start before/after capture

The owner manually restarted the game after logcat clear. No force-stop, automated start, cache/data clear, or asset pull occurred.

- Before snapshot: `2026-09-11T06:19:41Z`.
- Logcat cleared: `2026-09-11T06:20:44Z`.
- Process re-entered `MainActivity`.
- `data.dat` r3021, backup, `data_config`, `lang_config`, bundle directory, and 6,749 bundle count did not change.
- Nine small config/cache candidates changed hash or mtime; `playerprefs` grew from 147,828 to 150,379 bytes.
- No URL, response, packet config, or asset manifest was exposed.

Conclusion: the incremental update had already happened before capture. A normal restart cannot reproduce it.

### 12.3 Cache format findings

Read-only copies were pulled under:

```text
NeoArtifacts/emulator_capture/cache_format_evidence_2026-09-11T063000Z/
```

Files:

| File | Size | SHA prefix | Finding |
|---|---:|---|---|
| `cdn_s.0` | 6,780 | `9172…0fbd` | `AC ED 00 05`, 27-byte wrapper, plaintext UTF-8 JSON |
| `config_s.0` | 4,114 | `3585…11ae` | same wrapper; Bilibili SDK/CDN hosts, no asset version fields |
| `journal` | 27,094 | `af50…94a9` | Android `libcore.io.DiskLruCache` journal |

They did not contain `SmallPack`, `ResVersion`, `AssetVersions`, `AssetFixs`, `VersionURL`, or `packet_config`. No producer-specific decoder was found. The CFC AES/gzip path in `NeoArtifacts.py` has no provenance match and was correctly not applied.

### 12.4 One-off passive tcpdump capture

Runtime contained:

```text
/system/bin/tcpdump
tcpdump 4.99.4
libpcap 1.10.4
```

Exact command used:

```sh
nohup /system/bin/timeout 300 /system/bin/tcpdump -i any -nn -s 1024 -U -w /data/local/tmp/whmx_launch_capture.pcap '(udp port 53 or tcp port 53 or tcp port 443 or udp port 443)' >/dev/null 2>&1 &
```

Local PCAP:

```text
NeoArtifacts/emulator_capture/network/whmx_launch_capture.pcap
size: 470,883 bytes
SHA-256: 429f36b41ef4f7047397e5bda2b48d4eba8f3d45cbdbb13fe9be239d9703dbb1
```

Remote/local hashes matched; exact remote PCAP was then removed and tcpdump stopped.

Observed SNI destinations:

```text
line1-sdk-app-api.biligame.net
line1-log.biligame.net
api.biligame.net
static.biligame.net
p.biligame.com
le4-prod-all-gateway-lgmx.bilibiligame.net
le3-prod-all-gateway-lgmx.bilibiligame.net
l1-cs-api.biligame.net
bilibili-api.aihelpcn.net
```

The known base patch host `l4-prod-patch-lgmx.bilibiligame.net` was not observed. TLS exposed SNI/IP/timing only. It did not expose URL path, HTTP method/status, payload, or response fields. UDP/443 likely included QUIC not fully decoded. No update occurred in the window.

### 12.5 Account safety and ban-risk decision

Passive tcpdump reads packet metadata/content at the device network interface; it does not alter the game process or certificates. It can still capture encrypted packets and network identifiers, so raw PCAP is sensitive.

Risk policy agreed in conversation:

- Prefer passive capture over MITM/proxy/instrumentation.
- Do not log in again or perform payment during a capture.
- Do not change proxy, VPN, certificates, or network during capture.
- Do not bypass TLS pinning, inject Frida, patch the APK, or automate gameplay without a separate explicit risk decision.
- No evidence was found of a WHMX-specific rule banning passive local capture, but zero ban risk cannot be guaranteed.
- Raw PCAP/config/PlayerPrefs must not be committed or shared by default.

### 12.6 Reusable capture tool

Files:

```text
NeoArtifacts/tools/capture_runtime_update.py
NeoArtifacts/tools/test_capture_runtime_update.py
NeoArtifacts/RUNTIME_UPDATE_CAPTURE_RUNBOOK.md
```

State machine:

```text
NEW → PREPARED → CAPTURING → FINISHED
  ↘ ABORTED       ↘ ABORTED
```

Commands:

```text
doctor
prepare
start CAPTURE_DIR
status CAPTURE_DIR
finish CAPTURE_DIR --confirm-main-screen
abort CAPTURE_DIR
analyze CAPTURE_DIR
```

Every device-touching command requires explicit `--adb`, `--device`, `--package`, and `--output-root`. `analyze` is offline and constructs no ADB client.

Key safety properties after review:

- No `su`, `shell=True`, `pkill`, `killall`, `pm clear`, or `rm -rf`.
- Tool does not open/close/restart the game.
- Bundle directory is inventoried by direct filename/size/mtime only; no bundle content pull/hash scan.
- Exact remote PCAP path under `/data/local/tmp` is validated.
- State and evidence writes use temp + fsync + atomic replace.
- Start intent is journaled before tcpdump; PID/start ticks/exact cmdline/path are verified.
- Stop, removal, abort, and interrupted finish are resumable.
- PCAP is deleted remotely only after local size/SHA verification is durably saved.
- A nanosecond PID reuse race cannot be mathematically eliminated without pidfd, but the guarded recheck is fail-safe in practice.
- Output roots inside any Git worktree must be ignored.

### 12.7 Exact natural-update runbook

Use Windows PowerShell:

```powershell
$adb = 'D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe'
$device = 'emulator-5554'
$package = 'com.cipaishe.wuhua.bilibili'
$outputRoot = 'emulator_capture\runtime_updates'
```

1. Know a natural update is available, but **do not open the game yet**. Close the game manually before `prepare`.

```powershell
python tools\capture_runtime_update.py doctor `
  --adb $adb --device $device --package $package --output-root $outputRoot
```

2. Only if doctor returns 0:

```powershell
python tools\capture_runtime_update.py prepare `
  --adb $adb --device $device --package $package --output-root $outputRoot
```

3. Copy the exact capture directory printed by the tool:

```powershell
$capture = 'emulator_capture\runtime_updates\20260911T120000Z_deadbeef'
```

Do not guess the timestamp and do not open the game between prepare and start.

4. Optional dry run:

```powershell
python tools\capture_runtime_update.py start `
  --adb $adb --device $device --package $package --output-root $outputRoot `
  --dry-run $capture
```

5. Arm real capture:

```powershell
python tools\capture_runtime_update.py start `
  --adb $adb --device $device --package $package --output-root $outputRoot `
  --timeout-seconds 7200 $capture
```

6. After `CAPTURE_ARMED`, owner manually opens the game once and waits through the natural update to a stable main screen. No login/payment/network changes.

7. Read-only status as needed:

```powershell
python tools\capture_runtime_update.py status `
  --adb $adb --device $device --package $package --output-root $outputRoot `
  $capture
```

8. Finish only after stable main screen:

```powershell
python tools\capture_runtime_update.py finish `
  --adb $adb --device $device --package $package --output-root $outputRoot `
  --confirm-main-screen $capture
```

9. Abort if required:

```powershell
python tools\capture_runtime_update.py abort `
  --adb $adb --device $device --package $package --output-root $outputRoot `
  --reason 'owner-cancelled' $capture
```

Add `--pull-partial` only if the owner wants to preserve partial PCAP.

10. Offline analysis:

```powershell
python tools\capture_runtime_update.py analyze --write-reports $capture
python tools\capture_runtime_update.py analyze $capture
```

Share only:

```text
<capture>/reports/analysis.json
<capture>/reports/summary.md
```

Do not share raw PCAP, PlayerPrefs, or config without separate manual review/redaction.

Current operational interpretation:

- this tooling is preserved as forensic/debug capability;
- the natural-update capture work is historical evidence for why the project moved toward local runtime snapshot/delta application;
- no fresh agent should restart MITM/proxy/TLS-bypass experimentation as a routine step;
- raw PCAP/preferences/config remain sensitive;
- passive network reverse is only justified by a real updater anomaly or an explicitly resumed direct-transport objective.

---

# 27. NEOARTIFACTS CURRENT/FUTURE DIRECTION

NeoArtifacts should continue evolving as the authoritative game-source ingestion layer, not as a second web application.

Long-term responsibilities:

```text
runtime version detection
immutable snapshots
exact MasterData provenance
exact bundle index provenance
character-centric asset closure
Hoán Chương closure
safe delta application
raw relationship evidence
asset extraction/materialization
future animation/chibi/Spine discovery
```

Likely future asset research:

```text
AssetBundle decrypt
-> inventory Unity object types
-> locate TextAsset / MonoBehaviour / Animator / AnimationClip /
   SpriteAtlas / Mesh / Material / skeleton / atlas / moc-like data
-> identify whether WHMX uses Spine, Live2D, sprite animation,
   Unity Animator/prefab, or a custom format
-> export only after exact format/provenance is established
```

Do not assume `drawing_spine` means all animated character presentation is already solved. It is a known asset category/evidence point, not yet a fully specified public animation pipeline.

NeoArtifacts raw/source assets remain separate from delivery optimization:

```text
NeoArtifacts
= source-quality/raw/provenance

R2/CDN
= optimized web delivery

PostgreSQL
= structured managed metadata/working data, never bulk raw image/bundle storage
```

---

# 28. WHY THE CURRENT PROJECT DIRECTION LOOKS THE WAY IT DOES

The current architecture is the result of the historical lessons above:

```text
raw evidence must remain reproducible
-> immutable snapshots/provenance

large art cannot live comfortably in Vercel artifact
-> R2/CDN

hosted collaborators cannot depend on owner-local commands
-> hosted Admin/DB and future unattended publication

public read-heavy traffic should remain cheap/cacheable
-> static/read-optimized public delivery remains valuable

Admin preview must match user-visible rendering
-> reusable public renderers

project grew through multiple generations
-> incremental architecture migration, not big-bang rewrite
```

This causal history matters. Future agents should not "simplify" the architecture by removing provenance, bypassing exact source relationships, putting image binaries into PostgreSQL, or forcing every public read through the database without an explicit architecture decision.

---

# 29. HISTORICAL PATHS THAT ARE CLOSED OR PARKED

Closed for normal operation unless a new concrete bug appears:

```text
re-proving D0183 drawing extraction
re-proving SmallPack s2856 vs runtime r3021 mismatch
rebuilding character materialization from scratch
rebuilding Hoán Chương asset sync from scratch
redoing the successful r3021 -> r3026 updater proof
```

Parked intentionally:

```text
direct runtime HTTP transport reverse
Packet61 character-card reconstruction
broad BUFF closure auto-apply
full animation/chibi public pipeline
workbook -> PostgreSQL localization authority transfer
exact public Neon-direct vs R2-publisher split
```

When resuming a parked path, read its historical evidence first instead of restarting discovery from zero.

