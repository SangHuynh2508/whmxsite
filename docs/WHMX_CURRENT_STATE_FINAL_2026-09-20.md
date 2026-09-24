# WHMX — CURRENT STATE FINAL

**Checkpoint:** 2026-09-20  
**Purpose:** Latest fresh-chat continuation state for WHMX. This supersedes `WHMX_CURRENT_STATE_FINAL_2026-09-19.md` and earlier same-day state notes for day-to-day work.

---

# 0. DOCUMENT PRECEDENCE / WHERE THINGS LIVE

Shared project documents belong at:

```text
D:\BaiTapCode\WHMX\
```

Current important shared-root documents:

```text
WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20.md
WHMX_MASTERDATA_ID_CONVENTIONS.md
WHMX_CURRENT_STATE_FINAL_2026-09-20.md
WHMX_POSTGRES_CRUD_REFACTOR_PLAN_2026-09-19_v3.md
WHMX_NEON_SETUP_PROMPT_2026-09-19.md
```

Repo-specific application architecture lives under WhmxCalc:

```text
D:\BaiTapCode\WHMX\WhmxCalc\docs\WHMX_APP_ARCHITECTURE.md
```

`WHMX_APP_ARCHITECTURE.md` is the canonical application-organization guide. The repository-root `WhmxCalc/ARCHITECTURE.md` is Codex-kit architecture and does not replace the application guide.

Current precedence:

```text
1. Explicit latest owner decision
2. WHMX_CURRENT_STATE_FINAL_2026-09-20.md
3. WHMX_APP_ARCHITECTURE.md for application organization
4. WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20.md for deeper history/technical context
5. WHMX_MASTERDATA_ID_CONVENTIONS.md for ID/raw-relationship interpretation
6. Older handoffs/state files only as historical context
```

If an older document conflicts with this state, this state wins unless the newer canonical architecture/owner decision says otherwise.

---

# 1. REPOSITORIES / STANDING RULES

```text
D:\BaiTapCode\WHMX\
├─ NeoArtifacts\
└─ WhmxCalc\
```

Current WhmxCalc working branch:

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

Standing Git/worktree rules:

- Worktrees may intentionally be dirty.
- Never use `git reset --hard`, `git clean`, `git restore .`, `git checkout .`, or broad deletion.
- Stage exact reviewed files only.
- Never assume every dirty/untracked file belongs in a commit.
- `.env`, `.env.local`, credentials, tokens, cookies, private URLs, raw captures, and generated secrets must never be committed.
- No deploy unless owner explicitly approves.
- Commit/push is normally owner-gated. The only current exception is the explicitly authorized pre-architecture-migration rollback checkpoint described in Section 12.

Owner interaction rules:

- Use informal Vietnamese `tao/mày` in project chat.
- Plain `ok/oke` means approval of the proposal just presented.
- If a numbered proposal is given, omitted numbers are accepted unless owner says otherwise.

Agent/model rule:

```text
Default implementation/prompt agent: Luna High
Use Terra High only for genuinely difficult/high-risk architecture, security,
production migration, deep reverse-engineering, or repo-wide structural refactors.
```

---

# 2. SOURCE-OF-TRUTH MODEL — CURRENT VERIFIED STATE

```text
NeoArtifacts raw MasterData / runtime evidence
    = immutable source evidence for raw CN, IDs, exact relationships,
      gameplay semantics, and raw asset provenance

WhmxCalc/localization/localization_master.xlsx
    = current persistent Vietnamese localization authority

Neon PostgreSQL
    = hosted normalized working/Admin layer for implemented domains,
      with human overrides/revisions/audit

WhmxCalc/public/data.json
    = current generated public/frontend snapshot
```

Important:

- Raw exact relationships beat ID-shape heuristics.
- ID shape is supporting evidence only.
- Do not hand-edit NeoArtifacts evidence to fit an assumption.
- PostgreSQL import does not automatically transfer source authority.
- `public/data.json` is never a hand-edited authority.
- Localization-authority transfer from workbook to PostgreSQL remains an **OPEN DECISION**.

---

# 3. RUNTIME / MASTERDATA UPDATE PIPELINE — CLOSED FOR NORMAL USE

Current authoritative immutable runtime snapshot:

```text
r3026-20260917T074908111475Z
```

Pointer:

```text
NeoArtifacts/Assets/runtime_snapshots/current_authoritative_snapshot.json
```

Normal updater is integrated into `NeoArtifacts.py`:

```bash
python NeoArtifacts.py runtime-update check
python NeoArtifacts.py runtime-update plan
python NeoArtifacts.py runtime-update apply
```

Proven natural update:

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

Current rule:

```text
capture_runtime_update.py = forensic/debug/reverse tooling only
normal updates            = runtime-update check/plan/apply
```

Direct runtime HTTP transport remains:

```text
PAUSED INTENTIONALLY
NOT FAILED
NOT ABANDONED
```

Do not rebuild/reverse the updater again unless a real anomaly appears.

---

# 4. CHARACTER / ASSET PIPELINE — CURRENT BASELINE

NeoArtifacts character-centric materialization/sync is established and should be extended rather than replaced when new asset classes such as Spine/chibi/animation are investigated later.

Existing pipeline concept:

```text
runtime snapshot/index
-> exact bundle identity
-> ADB pull/cache verification
-> decrypt UnityFS bundle
-> extract character-related assets
-> provenance/manifest
```

Unity AssetBundle notes:

- WHMX `.ab` files are Unity AssetBundle/UnityFS containers in this pipeline.
- Current asset decrypt path already handles the game's UnityFS/XOR obfuscation.
- CFC/language/server payload AES logic is separate from AssetBundle decryption.
- Future Spine/chibi/L2D discovery should inventory/decode more bundle object types instead of creating a parallel downloader from scratch.

Included character asset categories already proven useful include avatar/card/drawing/skill icons/archive and other character-scoped categories. `archive` remains a distinct useful profile/artifact category.

Character skin image convention currently accepted:

```text
001 = base/original appearance
002 = upgraded/base portrait appearance
003+ = skin candidates; exact raw skin_type/relations still decide semantics
```

Do not create a redundant generic `skin` asset category when `characterSkins` already covers the image identities.

---

# 5. R2 / WEB ASSET STATE

Cloudflare R2 bucket:

```text
whmx-assets
```

Public endpoint currently used:

```text
https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev
```

Completed card/drawing migration:

```text
411 card objects
411 drawing objects
822 total WebP objects
all keys normalized lowercase
quality 88 / method 4
~234.9 MB total WebP from ~1.32 GB source PNG
validation 822/822 PASS
```

Example key:

```text
characters/a0001/drawings/a0001001.webp
```

Current public data result:

```text
133 characters
822 remote card/drawing URLs
0 mapping errors
```

Current asset split:

```text
R2/CDN:
- character cards
- character drawings
- managed/preview assets through controlled pipeline

local public assets:
- avatars
- item icons
- Series badges
- other smaller legacy categories for now
```

Managed upload architecture is already designed/implemented around:

```text
server-issued scoped presigned upload
-> browser uploads directly to R2 quarantine
-> server verifies decode/hash/metadata
-> server transactionally activates mapping
```

Browser storage credentials, unrestricted object-store mutation, unverified acceptance, and client-trusted finalization are forbidden.

Stable named asset cache-policy risk remains noted: long `immutable` caching is safe for content-hashed filenames but risky for stable names such as avatar paths. Do not reopen unless touching asset headers/infrastructure.

---

# 6. PUBLIC DATA / SKIN INVARIANTS

Current key counts:

```text
Characters:                  133
Actual Skins:                145
High Skins:                   10
Actual-skin Series refs:      19
Canonical Skin mappings:     435
```

Special no-Series skin:

```text
S0174003
```

It intentionally has no Series and must not be assigned one by heuristic.

All 145 actual skins currently use:

```text
skin_type = 3
```

Current acquisition taxonomy after the latest Character/Skin import normalization:

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

Canonical Series names remain 202–220 with:

```text
205 -> Phi Di
```

Only detail-context prose may expand it to:

```text
Phi Di (Di sản phi vật thể)
```

High Skin is semantic:

```text
is_high_skin
```

Do not infer it from `series_id == 220`.

Base appearance naming:

```text
肖形 / 造形 -> Tạo Hình
写照       -> Chân Dung
```

---

# 7. LOCALIZATION — CURRENT RULES

Important canonical terms include:

```text
瞄准   -> Nhắm Bắn      # gameplay/class mechanic
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

Other approved names include:

```text
诉讼代理人 -> Người Đại Diện Tố Tụng
兔洞       -> Hang Thỏ
水晶杯投影 -> Thủy Tinh Bôi Đầu Ảnh
粉色惊喜   -> Phấn Sắc Kinh Hỉ
供奉       -> Cung Phụng
畅销       -> Bán Chạy
金戈       -> Kim Qua
速羽       -> Tốc Vũ
截招       -> Tiệt Chiêu
业障       -> Nghiệp Chướng
雾隐       -> Vụ Ẩn
困兽       -> Khốn Thú
断肢       -> Đoạn Chi
过滤       -> Quá Lự
追游       -> Truy Du
额剑       -> Ngạch Kiếm
业火灼身   -> Nghiệp Hỏa Chước Thân
```

Important distinction:

```text
瞄准 as class/gameplay mechanic -> Nhắm Bắn
buff/status identities using their own exact raw IDs may retain a different canonical identity
```

Never merge terms solely because displayed CN matches.

Translation style:

- Owner-approved character names in `CHARACTER` are reused in skills/lore.
- Named/private identities default strongly toward Hán-Việt where understandable.
- Global/common mechanics may use natural Vietnamese when verified.
- Do not hybridize components inside one identity compound.
- External-origin proper names may use verified original/English form where Chinese is itself a localization.

Parked buff translation packet remains parked and must not be auto-applied:

```text
localization/exports/buff_closure_translation_packet_20260917_114332.xlsx
```

---

# 8. POSTGRESQL / NEON / DRIZZLE — IMPLEMENTED FOUNDATION

Approved stack:

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

Non-production development branch:

```text
name: development
id:   br-bold-butterfly-azt1occt
```

Production branch must not be used for normal development.

Do not use the obsolete dangerous flow:

```text
neon link --project-id ... --branch production
```

Current branch/tooling should use modern `neon link` + `neon checkout development` flow when needed.

Standard migration executor:

```text
scripts/db-migrate.mjs
```

Current canonical migration line extends through:

```text
0004_odd_magik.sql
```

Milestone B — foundation: COMPLETE

- foundational migrations created;
- auth/core source/managed/audit tables established;
- transaction proof PASS;
- server-only DB access;
- health endpoint proven;
- no test residue left after proof.

Milestone C — Character/Skin import: COMPLETE

- typed Character/Skin/Series/acquisition tables;
- source snapshot/import provenance;
- deterministic importer;
- exact raw relationships preserved;
- optimistic numeric revision conflict path proven;
- no omission-driven delete behavior.

PostgreSQL remains a hosted working/Admin layer; it does not silently replace raw/workbook authority.

---

# 9. AUTH / SECURITY — D1 COMPLETE

Better Auth is the current auth foundation.

Requirements now implemented/accepted:

```text
one account per person
roles: owner / editor
public self-signup OFF
HttpOnly sessions
server-side authorization
server-only DB client
```

Owner/user operations include secure bootstrap/reset flows. Password reset uses Better Auth request/reset semantics rather than plaintext/custom hashing, and active sessions are revoked where appropriate.

Do not expose raw auth errors to users. Invalid credentials remain generic.

Security boundary:

```text
frontend role/button visibility = UX only
server session + active status + role + validation = actual authorization
```

Every protected mutation must enforce field allowlists and optimistic revision where applicable.

Known historical local issue:

- an old Vercel Dev process on port 3003 held stale host allow-list state and returned `AUTH_OPERATION_FAILED`;
- isolated correct process on port 3004 passed;
- this is not a D2.4.1 blocker.

---

# 10. PREVIEW / MANAGED ASSETS — D0A/D0B/D0C COMPLETE

Preview Character design is separate from raw Character authority.

Concepts include:

```text
preview_characters / managed_entities
origin: manual_preview / source_backed
lifecycle/status controls
optional claimed raw ID
managed asset mappings
quarantine upload
owner review/activation
```

A claimed raw ID is never automatically authoritative.

Managed asset pipeline uses R2 metadata/mappings in DB; image bytes remain in object storage.

D0 milestones:

```text
D0A Preview DB/domain                COMPLETE
D0B R2 managed asset pipeline        COMPLETE
D0C Preview Character Admin UI/API   COMPLETE
```

---

# 11. CHARACTER / SKIN ADMIN — D2.4.1 ACCEPTED BASELINE

D2 Character/Skin CRUD and the follow-up usability passes are complete for the current scope.

Latest accepted D2.4.1 behavior:

- Character/Skin outer Admin frame flattened only in the Character/Skin workspace.
- Login/Preview/Users legacy shells remain unchanged.
- Explicit Vietnamese labels:
  - `Tên tiếng Việt`
  - `Tên đầy đủ tiếng Việt`
  - `Biệt danh tiếng Việt`
  - `Thẻ tiếng Việt`
  - `Tên skin tiếng Việt`
  - `Mô tả tiếng Việt`
  - `Cách nhận tiếng Việt`
- Character avatar source is actually 128×128.
- Previous half-avatar bug was CSS `object-fit: cover` inside a horizontal frame.
- Current avatar presentation uses a square container + `contain`, without distortion.
- Narrow right drawer was replaced by a large centered editor modal (~84vw, max 1280px, max 88vh).
- ≤900px editor layout stacks.
- Raw CN + Workbook VI appear as reference/source data.
- Editable VI override appears separately.
- Long textarea height is bounded with internal scroll.
- Dirty-close protection works for X/backdrop/Escape.
- Opening cached editor does not refetch unnecessarily.
- Selection/cache/AbortController/stale-response protections remain.

D2.4.1 Character `tags` source correction:

```text
workbook CHARACTER.tags_cn
== raw characterTable.CharacterTagLanText
```

Verified:

```text
133/133 exact matches
0 mismatch
```

Important distinction:

```text
CharacterTagLan     = source field identity/reference
CharacterTagLanText = raw Chinese display value
```

`nicknameVi` still has no trustworthy direct raw CN pair and must display the subdued no-direct-source fallback.

Current mutation scope remains narrow:

Character editable override fields:

```text
name_vi
fullname_vi
nickname_vi
tags_vi
```

Skin editable override fields:

```text
name_vi
description_vi
obtain_vi
```

Raw IDs, type, commerce/source relations, source snapshots, and protected mappings remain read-only.

Latest proof summary reported PASS for:

```text
133 Characters
raw/workbook/editor simultaneous display
save/discard/conflict
dirty-close/Escape
long Skin text
cache/no-refetch
selection race
avatar correctness
1280/1440/1920 layout at 5/6/8 columns
D2 domain/browser/local Vercel
D1 auth/reset
D0A/D0B/D0C
schema/migration/transaction/health
npm run build
git diff --check
```

`public/data.json` remained unchanged by D2.4.1.

Treat D2.4.1 as CLOSED unless a new real bug appears.

---

# 12. CANONICAL APP ARCHITECTURE + PRE-MIGRATION CHECKPOINT

Canonical application guide now exists:

```text
WhmxCalc/docs/WHMX_APP_ARCHITECTURE.md
```

Accepted architecture principles:

**LOCKED**

- incremental migration; no big-bang rewrite;
- raw-source authority preserved;
- server-side authorization is the real security boundary;
- public renderer should be reused for Admin preview/contextual editing where practical;
- palette/visual direction must not silently change during structural refactor;
- routine hosted Admin publication must not depend on owner opening the local PC and manually rebuilding/deploying.

**TARGET**

```text
src/app/        global shell/router/layout/settings
src/features/   characters/skins/profile/skills/buffs/guides/tier-list/assets
src/admin/      cross-cutting Admin workspace/auth/audit/etc.
src/shared/     truly domain-neutral reusable primitives only
src/styles/     gradual token/global/typography separation
```

Backend target boundary:

```text
api/     thin HTTP/Vercel transport
server/  domain behavior, authorization, transactions, invariants
 db/     client/schema/migrations/narrow reusable DB primitives
scripts/ operational/import/export/proof commands
tools/   localization/build/validation pipeline
```

New substantial frontend modules should prefer TypeScript. There is no requirement to mass-convert legacy JS.

Two wording clarifications to the architecture guide are approved but may still be pending application at the moment of this state:

1. browser -> scoped short-lived presigned R2 upload is valid; only unrestricted/unscoped mutation and client-trusted finalization are forbidden;
2. domain-specific query composition belongs in `server/`, not a giant generic `db/` repository layer.

Current owner-authorized architecture migration safety task:

- audit current dirty Git state;
- create/push a safe rollback checkpoint of accepted work only;
- create annotated tag:

```text
pre-app-architecture-migration-2026-09-20
```

(or deterministic suffix if it already exists);

- then create `docs/WHMX_ARCHITECTURE_MIGRATION_PLAN.md`;
- **NO production/application file migration is authorized in that planning task.**

At the time of writing this state, the Codex output for that checkpoint/plan has not yet been reviewed here. Do not assume the commit/tag exists until the report confirms the actual SHA/tag/remote.

---

# 13. PUBLIC DATA DELIVERY — LONG-TERM REQUIREMENT / OPEN IMPLEMENTATION

Current public site remains read-heavy and currently consumes static generated data.

Current public model:

```text
Vite static SPA
+ public/data.json
+ R2/local assets
```

Admin/Auth are dynamic through Vercel Functions + Neon.

Long-term requirement now explicitly established:

```text
friend/editor edits hosted Admin data
-> routine content changes must not require owner local PC
-> no mandatory manual local export + Vite rebuild + deploy for every ordinary save
```

Two mechanisms are being evaluated:

```text
A. direct hosted reads for selected experiences
   frontend -> authenticated API/Data API -> Neon

B. unattended public publisher
   PostgreSQL -> validated/versioned release -> R2/CDN -> public frontend
```

Likely hybrid direction under consideration:

```text
Admin/live preview -> hosted DB/API directly
Public high-read paths -> automatically published CDN/R2 data
Assets -> R2/object storage
```

A versioned immutable release + atomic `current` manifest has been discussed as a strong publication pattern, but exact implementation is still **OPEN DECISION**.

Do not hard-code the old assumption that production publishing must always be:

```text
DB -> local public/data.json -> Git commit -> owner deploy
```

The architecture must support unattended hosted publication in the long run.

---

# 14. FUTURE CONTENT DOMAINS

Public already contains Skill/Buff through the static raw/workbook -> build pipeline, but Skill/Buff are not yet normalized into PostgreSQL Admin CRUD.

Future Admin-managed domains are expected to include:

```text
Profile
Skill
Buff/Status
Guide
Tier List
Asset management
possibly broader Localization management
```

Guides/Tier Lists/Profile should be data-driven/Admin-editable rather than permanently hard-coded into frontend JS.

Architectural principle:

```text
editable directly in hosted Admin
!=
public must query DB directly
```

A domain can be Admin-editable while public delivery still comes from an automatic CDN snapshot.

Future renderer principle:

```text
one real domain renderer
-> public read view
-> Admin preview
-> future contextual inline editing
```

Contextual inline editing and a full CMS may coexist.

---

# 15. FRONTEND / DESIGN / PERFORMANCE

Public frontend still includes substantial legacy vanilla JS plus newer Vue Admin work.

Current direction:

```text
public legacy stays working
new substantial UI work -> Vue 3, preferably TypeScript
no forced legacy rewrite
```

Design direction remains:

```text
dark charcoal canvas
current antique/warm gold accent
restrained editorial/museum typography
few borders/cards/shadows
clear hierarchy over decorative SaaS patterns
```

For every substantial UI/design/rework task, read:

```text
WhmxCalc/.agents/skills/huashu-design/SKILL.md
```

and its required references.

Admin usability principle:

```text
rõ > nhanh > ít lỗi > nhất quán > đẹp vừa đủ
```

Performance notes:

- public `data.json` is already ~14–15 MB and should not grow forever as one monolith;
- future public data should be chunkable/lazy-loaded by domain/entity;
- many routes do not inherently make the site slow if code/data/assets are lazy-loaded;
- future Spine/chibi/L2D should load only when needed, not animate entire grids simultaneously;
- use static thumbnails on rosters and initialize/dispose animation runtime on demand.

Local Admin performance evidence indicates Vercel Dev function overhead + Neon dev latency dominate, not basic domain query code.

---

# 16. CURRENT DEFERRED / PARKED ITEMS

Do not reopen casually:

```text
Direct runtime HTTP reverse
Packet61 original character-card reconstruction
parked buff closure packet auto-apply
broad mobile redesign without audit
stable named asset cache-policy cleanup unless touching headers
mass legacy JS -> TS conversion
big-bang folder migration
```

Legacy public initial/calculator-era landing experience is known stale and may be redesigned later, but it is not part of the current architecture migration unless explicitly scoped.

---

# 17. NEXT PRIORITIES

Immediate sequence:

```text
1. Receive Codex pre-migration checkpoint + architecture migration plan output.
2. Verify pushed checkpoint SHA/branch/tag and exact included/excluded files.
3. Review WHMX_ARCHITECTURE_MIGRATION_PLAN.md before moving any production file.
4. Only after owner approval, execute migration in small independently reversible batches.
5. Keep D2.4.1 behavior frozen during structural migration.
6. Continue product domains after the organization boundary is stable enough:
   Profile / Skill / Buff / Guide / Tier List / publication architecture.
```

Architecture migration must not silently decide:

```text
Neon-direct vs R2-public delivery
workbook -> PostgreSQL localization authority transfer
```

Those remain separate product/data architecture decisions.

---

# 18. FRESH-CHAT CONTINUATION RULES

A new agent/chat should:

1. Read this state first.
2. Read `WHMX_APP_ARCHITECTURE.md` before new substantial app work.
3. Read `WHMX_MASTERDATA_ID_CONVENTIONS.md` before interpreting raw IDs/skills/buffs/skins.
4. Use the 2026-09-20 technical handoff for deeper context/history.
5. Do not redo the runtime updater.
6. Do not redo skin Series/High Skin classification.
7. Treat D2.4.1 as accepted.
8. Do not move files until the migration plan is owner-reviewed.
9. Preserve dirty worktrees and exact-file staging discipline.
10. Never touch Neon production or production R2 without explicit production scope.
11. Never expose secrets.
12. Keep raw/workbook/DB/public-output authority boundaries distinct.
13. Keep public renderer/Admin preview reuse in mind for all new domain UI.
14. Prefer TypeScript for new substantial frontend modules, without mass rewriting legacy JS.
15. No broad cleanup just to make the tree look pretty.

---

# 19. CURRENT STATUS IN ONE LINE

WHMX now has a proven runtime/asset updater, R2 delivery, Neon/Drizzle/Better-Auth hosted Admin foundation, accepted Character/Skin CRUD through D2.4.1, and a newly locked application-architecture guide; the immediate task is to establish a GitHub rollback checkpoint and review a bounded folder/server migration plan before any structural file moves.
