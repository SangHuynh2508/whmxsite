# WHMX Application Architecture Migration Plan

## 1. Objective

This plan describes a bounded, behavior-preserving migration from the observed repository structure toward [`WHMX_APP_ARCHITECTURE.md`](./WHMX_APP_ARCHITECTURE.md). It is a plan, not authorization to execute any migration batch.

The migration must:

- separate the global application shell, domain features, cross-cutting Admin workspace, server domains, database primitives, and operational tooling;
- preserve accepted public and Admin behavior, especially the D2.4.1 Character/Skin baseline;
- avoid a framework rewrite, visual redesign, schema change, data migration, or source-authority change;
- keep public renderer reuse as the direction for future Admin preview work; and
- leave public-data publication and workbook-to-PostgreSQL authority transfer as explicit open decisions.

Moving folders must never be used to smuggle in a product redesign, new data model, new authorization policy, or publication decision.

## 2. Safety checkpoint

The rollback checkpoint was created and pushed before this plan was written.

| Item | Value |
| --- | --- |
| Branch | `feat/postgres-admin-crud` |
| Checkpoint commit | `0bea367cb59e5c3077a5b64d24e49f70fb7f99d9` |
| Git remote | `origin` → `https://github.com/SangHuynh2508/whmxsite.git` |
| Remote branch | `origin/feat/postgres-admin-crud` |
| Annotated rollback tag | `pre-app-architecture-migration-2026-09-20` |
| Tag message | `WHMX accepted state before application architecture migration` |
| Remote verification | Branch and peeled tag both resolve to `0bea367cb59e5c3077a5b64d24e49f70fb7f99d9`. |

Safe recovery references, to be used only when needed:

```text
git show pre-app-architecture-migration-2026-09-20
git switch -c recovery/<descriptive-name> pre-app-architecture-migration-2026-09-20
```

Creating a recovery branch is preferred to destructive reset or broad worktree cleanup. Preserve the tag permanently.

## 3. Current repository map

The current application is a valid hybrid. Legacy denotes its generation and coupling, not that it is broken.

```text
index.html                         explicit Vite HTML entry, global shell DOM, global CSS link
src/main.js                        stable Vite entry delegating to application bootstrap
src/app/bootstrap/boot.js          public bootstrap and global initialization
src/app/layout/                    global navigation, sidebar, and feedback layout behavior
src/app/runtime/smoothScroll.js    shared application scroll lifecycle
src/app/settings/theme.js          forced/persisted application theme setting
src/router.js                      hash routing, route transitions, view selection, scroll coordination
src/data/                          public snapshot loading, state, calculator/stat behavior
src/ui/                            remaining public Character, Weapon, and Calculator renderers
src/ui/charViews/                  Character detail subviews
src/features/assets/assetPaths.js  shared Character/Skin public asset URL resolution
src/features/skins/views/          public Skin Gallery and Detail renderers
src/features/skins/styles/skinGallery.css
                                   feature-local Skin Gallery/Detail CSS
src/admin/layout/adminShell.js     Admin route/session/login/accounts shell and Vue island loader
src/admin/preview/previewWorkspace.js
                                   Preview Character and managed-upload Admin UI
src/characterSkinAdminWorkspace.js Vue 3 Character/Skin Admin island
src/style.css                      tokens, global/public styles, responsive rules, and Admin/D2 styles

api/                               Vercel filesystem/HTTP transport
server/admin/accounts/             Admin account and password-reset domain
server/assets/                     Managed-asset orchestration and R2 adapter
server/preview-characters/         Preview commands, reads, and operations
server/                            auth and remaining flat server modules
db/client.mjs                      PostgreSQL/Drizzle client
db/schema/                         auth, core, Character/Skin, Preview/Asset schemas
db/migrations/                     committed Drizzle SQL and metadata
scripts/                           DB operations, imports, proofs, and local runtime checks
tools/                             localization/build/export/validation operations
public/data.json                   generated public read snapshot
localization/localization_master.xlsx
                                   current persistent Vietnamese localization authority
```

### Observed concentration and coupling

- `index.html` directly loads `/src/style.css` and `/src/main.js`; there is no custom Vite configuration or path-alias layer. All current moves therefore affect relative paths directly.
- `src/main.js` imports public data/state/calculator modules, UI initializers, router code, Admin bootstrap, and analytics. It is small, but it is the single startup fan-out.
- `src/router.js` statically imports public Character, Skin, weapon, calculator/sidebar, transition, and smooth-scroll behavior. `src/config/reportIssue.js` also imports router helpers, so the router is not currently an isolated route table.
- `src/admin/layout/adminShell.js` owns route detection, session/login state, account UI, shell markup, and the dynamic import of `src/characterSkinAdminWorkspace.js`.
- `src/characterSkinAdminWorkspace.js` is a programmatically mounted Vue 3 island, not an SFC application. Its module-level caches, dynamic loading, stale-response protection, editor state, and rendering are accepted D2.4.1 behavior.
- `src/style.css` is approximately 175 KB and mixes design tokens, global shell rules, public features, responsive behavior, and Admin/D2 styling. Cascade order is behavior.
- `src/features/skins/views/skinGalleryView.js` imports `../styles/skinGallery.css` locally. `src/talent.css` exists, but the audit found no current import or HTML reference; do not delete or move it without a focused rendering/history check.
- `api/` routes are generally thin. Preview routes delegate reads and transaction-scoped mutations to explicit operations in `server/preview-characters/`, while retaining HTTP transport and error-envelope responsibilities.
- `server/` has real domain modules but is flat. `server/admin-api.mjs` is a cross-cutting authorization/error helper with imports from account and Character/Skin domains, so it has a larger blast radius than its name suggests.
- `db/` is already close to the canonical boundary. One boundary anomaly remains: `db/client.mjs` imports `server/load-local-env.mjs`. Do not “fix” this during an unrelated move; environment loading needs its own runtime-safe decision.
- Proof scripts import concrete files from `api/`, `server/`, and `db/`. A server move is incomplete until every proof/operation import is updated in the same batch.
- `tools/` and localization artifacts contain many fixed repository-relative paths. They are operational pipelines, not candidates for a cosmetic application-folder migration.

## 4. Target mapping

The table is intentionally selective. “Later” means migrate as a bounded approved batch; “when touched” means legacy may remain indefinitely while stable.

| Current path | Current responsibility | Target ownership/path | Risk | Dependencies | Timing |
| --- | --- | --- | --- | --- | --- |
| `src/main.js` | Vite entry and startup fan-out | Keep as thin entry; move boot orchestration to `src/app/bootstrap/boot.js` | LOW–MEDIUM | All startup imports; `index.html` | First batch |
| `index.html` shell markup | Root DOM, global navigation, route containers | `src/app/layout/` only when shell rendering is actively refactored | HIGH | DOM IDs used throughout router/UI/CSS | When touched |
| `src/router.js` | Hash routing, transitions, scroll, feature view composition | `src/app/router/` with route table separated from transition/scroll coordination | HIGH | Most public views, `reportIssue.js`, DOM IDs | Later, split into sub-batches |
| `src/ui/appNav.js`, `theme.js`, `smoothScroll.js` | App-wide navigation/settings/runtime behavior | `src/app/layout/` and `src/app/settings/` | MEDIUM–HIGH | Router lifecycle and global CSS | Later |
| `src/ui/characterCatalogView.js`, `characterDetail.js`, `charViews/**` | Public Character feature | `src/features/characters/` | HIGH | Router, state, asset paths, many DOM/CSS selectors | Only when Character public work is active |
| `src/ui/skinGalleryView.js`, `skinDetailView.js`, `skinGalleryView.css` | Public Skin feature | `src/features/skins/` | MEDIUM–HIGH | Router, asset resolver, public data shape, feature CSS import | Later/when touched |
| `src/ui/weaponsView.js` | Public weapon view | `src/features/weapons/` | MEDIUM | Router and public snapshot | When touched |
| `src/data/calculator.js` and calculator UI modules | Calculator domain | `src/features/calculator/` | HIGH | Shared state, DOM IDs, Lenis resize contract | When touched |
| `src/constants/assetPaths.js` | Cross-feature asset URL policy | `src/features/assets/assetPaths.js` | LOW–MEDIUM | Six public importers and hard-coded fallback paths | Early bounded batch |
| `src/adminShell.js` | Admin session/layout/accounts/island loading | `src/admin/layout/`, `src/admin/auth/`, `src/admin/accounts/` | MEDIUM–HIGH | Main/bootstrap, hash routes, dynamic import, session cache | Later bounded batch |
| `src/adminPreviewShell.js` | Preview/Admin operational UI | `src/admin/preview/` consuming Character/Asset contracts | MEDIUM | Admin shell and Admin APIs | Same Admin batch or immediately after |
| `src/characterSkinAdminWorkspace.js` | Accepted D2 Vue island | Eventually feature-owned Admin components plus shared public renderers | HIGH | Vue chunk, D2 behavior/cache/editor/CSS/API | Defer until this domain is actively extended |
| `src/style.css` | Tokens + global + feature + Admin CSS | `src/styles/{tokens,global,typography}.css` plus feature-local CSS | HIGH | Global cascade, direct HTML load, all selectors | Late and incremental |
| `api/**` | Vercel transport and filesystem routes | Keep paths stable; update only imports, except separately approved API design work | HIGH if moved | Vercel conventions and `vercel.json` auth rewrite | Do not relocate |
| `server/admin-account-domain.mjs`, `admin-password-reset-domain.mjs` | Admin account behavior | `server/admin/accounts/` | MEDIUM | User routes, auth helpers, scripts/proofs | Early server batch |
| `server/managed-asset-domain.mjs`, `r2-managed-assets.mjs` | Asset orchestration/storage adapter | `server/assets/` | MEDIUM | Upload routes, Preview domain, D0 proofs | Separate server batch |
| `server/preview-character-domain.mjs`, `preview-character-read-domain.mjs` | Preview Character commands/queries | `server/preview-characters/` | MEDIUM–HIGH | Preview routes, Admin helper, assets, multiple proofs | Separate server batch |
| `server/character-skin-admin-domain.mjs` | Combined Character/Skin Admin behavior | Domain-owned Character/Skin service boundary decided during active work | HIGH | Four API routes, Admin helper, D2 proofs | Defer; do not mechanically split |
| `db/**` | Client, schemas, migrations | Remain under `db/` | LOW | Runtime imports and migration journal | No folder migration needed |
| `scripts/**`, `tools/**` | Operations/build/import/export/proofs | Remain operational; update exact imports only with owning batch | MEDIUM | Concrete filenames and cwd-relative paths | No broad migration |

## 5. Dependency hazards

| Hazard | Risk | Repository evidence and control |
| --- | --- | --- |
| Vite entry and module paths | HIGH | `index.html` directly names `/src/main.js` and `/src/style.css`; there are no aliases. Keep `src/main.js` as the stable entry during early migration. |
| Admin dynamic import | HIGH | `src/adminShell.js` dynamically imports `./characterSkinAdminWorkspace.js`. A wrong path breaks only the lazy Admin chunk and can escape public-route smoke tests. |
| Hash router + DOM contract | HIGH | `src/router.js`, `index.html`, UI modules, and CSS share route hashes and element IDs. Do not move the router and shell DOM together. |
| CSS cascade/import order | HIGH | Global CSS is directly linked before module execution; Skin CSS is imported from its JS module. Extract one layer at a time and compare computed/visual results. |
| Vercel filesystem routes | HIGH | Bracketed routes such as `api/auth/[...].js`, `[characterId].js`, and upload `[id]/finalize.js` depend on exact paths. Keep API paths fixed during organization work. |
| Auth rewrite | HIGH | `vercel.json` rewrites `/api/auth/(.*)` to `api/auth/[...]`. Do not rename or relocate the auth route during folder cleanup. |
| Server path fan-out | MEDIUM–HIGH | API adapters and many DB proof scripts import flat server filenames directly. Use `rg` before and after every move; update all importers in one commit. |
| API/server responsibility boundary | MEDIUM–HIGH | Preview API routes retain HTTP transport and error mapping; `server/preview-characters/` owns Preview reads, transaction scope, and domain orchestration. Preserve this split with Preview API proofs. |
| Database-to-server import direction | MEDIUM | `db/client.mjs` imports `server/load-local-env.mjs`. Resolve only after defining a runtime-neutral env bootstrap; do not duplicate or silently drop local loading. |
| Public asset URL assumptions | HIGH | Many modules hard-code `/assets/...`; `assetPaths.js` also encodes snapshot filename behavior. A folder move must not alter returned URLs, case, or fallbacks. |
| Public snapshot shape/path | HIGH | `src/data/loader.js` fetches `/data.json`; tools/scripts assume `public/data.json`. Folder cleanup must keep the artifact byte-identical. |
| Case sensitivity | HIGH | Development is on Windows while Vercel is case-sensitive Linux. Every moved import must match filename case exactly. |
| Proof and operator scripts | MEDIUM | Scripts import `api/`, `server/`, and `db/` by concrete relative paths and spawn named scripts. Include them in the owning move and validation. |
| Documentation path references | LOW–MEDIUM | Architecture, operations, and state docs name current files. Update only references made obsolete by an accepted batch. |

## 6. Migration batches

Each successful batch is one reviewable commit and rollback unit. Do not combine batches merely to reduce commit count.

### Batch 1 — Establish a stable application bootstrap seam

- **Objective:** create the first `src/app/` boundary while preserving Vite’s entry path and every initialization order dependency.
- **Files:** `src/main.js`; new `src/app/bootstrap/boot.js`.
- **Mapping:** retain `src/main.js` as a thin entry; move the existing imports and `boot()` orchestration to `src/app/bootstrap/boot.js` and export the boot function.
- **References to update:** relative imports inside the moved boot module only. Keep `index.html` pointing to `/src/main.js`.
- **Out of scope:** router, Admin modules, Vue island, CSS, domain files, API/server/DB, TypeScript conversion.
- **Invariants:** initialization order, analytics injection, Admin initialization, data load, subscriptions, calculator rendering, smooth-scroll resize, and error handling remain identical.
- **Proof:** `npm run build`; public hash-route smoke; Admin login-shell smoke; console/network error check; `public/data.json` unchanged; `git diff --check`.
- **Rollback:** revert the single batch commit; `src/main.js` returns to the checkpoint implementation.
- **Risk:** LOW–MEDIUM.
- **Execution model:** **Luna High** is appropriate for the mechanical extraction; use Terra High for review if any initialization behavior must change.

### Batch 2 — Place the public asset resolver under Asset domain ownership

- **Objective:** establish one small feature-domain move without changing any asset URL.
- **Files:** move `src/constants/assetPaths.js` to `src/features/assets/assetPaths.js`; update its importers in Character Catalog/Header, Character Gallery/Overview, Skin Gallery, and Skin Detail.
- **References to update:** all `assetPaths.js` imports found by `rg`; documentation only if it names the old path.
- **Out of scope:** hard-coded asset URLs elsewhere, asset data model, public assets, R2 keys, Admin upload APIs, fallback redesign.
- **Invariants:** every resolved card/drawing/avatar/item/Series URL and fallback remains byte-for-byte equivalent; no new network request pattern.
- **Proof:** build; Character Catalog/Detail and Skin Gallery/Detail browser smoke; broken-image/network check; public-data unchanged check.
- **Rollback:** revert one move/import-update commit.
- **Risk:** LOW–MEDIUM.
- **Execution model:** **Luna High** for the path-only move with Terra High review of URL parity.

### Batch 3 — Group Admin account server modules

- **Objective:** begin server domain organization with a bounded, well-proven account domain.
- **Files:** move `server/admin-account-domain.mjs` and `server/admin-password-reset-domain.mjs` under `server/admin/accounts/`; update user API routes, Admin bootstrap/reset commands, `server/admin-api.mjs`, and D1/account proof imports.
- **Out of scope:** `server/auth.mjs`, Better Auth schema, route paths, password behavior, roles/status policy, DB schema/migrations.
- **Invariants:** self-signup remains disabled; server-derived roles/status remain authoritative; password reset preserves identity/role and revokes sessions; first-owner guard remains unchanged.
- **Proof:** build; `db:admin-auth-test`; `db:admin-password-reset-proof`; first-owner proof only on an isolated DB with zero owners; local Vercel auth proof; secret scan.
- **Rollback:** revert the batch commit; no migration rollback is involved.
- **Risk:** MEDIUM.
- **Execution model:** **Terra High** because auth path fan-out and operational scripts are security-sensitive.

### Batch 4 — Group server-side Asset modules

- **Objective:** place managed-asset orchestration and R2 storage code under `server/assets/` without changing the upload contract.
- **Files:** move `server/managed-asset-domain.mjs` and `server/r2-managed-assets.mjs`; update upload-intent/finalize API imports, Preview-domain imports, and managed-asset proof imports.
- **Out of scope:** API route paths, presign/finalize semantics, MIME/dimension limits, key namespaces, DB mappings, real R2 migration, UI.
- **Invariants:** scoped short-lived presigned upload remains allowed; no browser credentials, unscoped mutation, unverified acceptance, or client-trusted activation; immutable replacement and cleanup rules remain intact.
- **Proof:** build; `db:managed-asset-test` with fake storage; Preview tests; secret scan. Run the live R2 proof only with separately confirmed non-production credentials/prefix.
- **Rollback:** revert the batch commit; no object or DB migration.
- **Risk:** MEDIUM.
- **Execution model:** **Terra High** due to storage security and cleanup invariants.

### Batch 5 — Group Preview Character server modules

- **Objective:** place Preview Character commands and queries under one domain directory.
- **Files:** move `server/preview-character-domain.mjs` and `server/preview-character-read-domain.mjs` to `server/preview-characters/`; update Preview API, Admin/account helper, Asset service, performance script, and all D0/D1 proof imports.
- **Out of scope:** moving transaction ownership, changing endpoint payloads, reconciliation policy, publication behavior, schema, or Admin UI.
- **Invariants:** lifecycle/visibility, optimistic revision, reconciliation, role gates, audit rows, and hidden-preview behavior remain identical.
- **Proof:** build; `db:preview-character-test`; `db:preview-admin-test`; `db:preview-admin-api-test`; `db:managed-asset-test`; `db:admin-auth-test`; local HTTP smoke.
- **Rollback:** revert the path-only batch commit.
- **Risk:** MEDIUM–HIGH because the domain is imported across API, server, assets, and proofs.
- **Execution model:** **Terra High**.

### Batch 6 — Move Preview transaction orchestration out of API adapters

- **Objective:** make Preview Vercel functions thin transport by moving transaction/query composition now performed in `api/admin/previews/**` into the Preview server domain.
- **Files:** bounded to `api/admin/previews/index.js`, `api/admin/previews/[id].js`, `server/preview-characters/**`, and their direct Preview API proofs.
- **Out of scope:** endpoint paths/contracts, DB schema, authorization rules, public export, other API domains.
- **Invariants:** status codes/error envelopes, transactions, revision conflicts, audit behavior, and response shape remain identical.
- **Proof:** all Batch 5 proofs plus request/response fixture parity and a deliberate rollback/failure-path proof.
- **Rollback:** revert the orchestration commit independently of Batch 5.
- **Risk:** MEDIUM–HIGH.
- **Execution model:** **Terra High**.

#### Completion record — 2026-09-21

Batches 3–6 are complete as separate reversible commits. The current server locations are `server/admin/accounts/`, `server/assets/`, and `server/preview-characters/`; Preview API adapters now delegate database reads and transaction-scoped mutations to `preview-character-operations.mjs`. The historical source-to-target entries above are intentionally retained.

#### Frontend Structure Wave completion — 2026-09-21

- **F1:** Admin shell and Preview workspace now live at `src/admin/layout/adminShell.js` and `src/admin/preview/previewWorkspace.js`; the accepted `src/characterSkinAdminWorkspace.js` island remains unchanged.
- **F2:** global navigation, sidebar, feedback, theme, and smooth-scroll modules now have explicit `src/app/` layout, settings, and runtime ownership.
- **F3:** Skin Gallery/Detail views and their local CSS now live under `src/features/skins/`.

No Character public cluster, router, Calculator domain, or global `src/style.css` split was included in this wave.

### Batch 7 — Organize the Admin cross-cutting shell

- **Objective:** move the authenticated shell and Preview workspace under `src/admin/` while leaving the accepted Character/Skin island content unchanged.
- **Files:** `src/adminShell.js` → `src/admin/layout/adminShell.js`; `src/adminPreviewShell.js` → `src/admin/preview/previewWorkspace.js`; update bootstrap import and the shell’s Preview/dynamic-island paths.
- **Out of scope:** `src/characterSkinAdminWorkspace.js` content, Vue conversion/SFC work, D2 CSS, renderer convergence, API behavior.
- **Invariants:** session caching, login/logout, owner-only users UI, hash navigation, lazy Vue loading, mounted-cache survival, and D2 no-refetch/stale-response behavior.
- **Proof:** build; D1 auth/reset; D0 Preview/Asset; local Vercel HTTP; full D2 browser proof on a clean isolated port; verify a separate Admin chunk still builds and loads.
- **Rollback:** revert the Admin move commit.
- **Risk:** MEDIUM–HIGH.
- **Execution model:** **Terra High**.

### Batch 8 — Styling extraction, only after route/module moves stabilize

- **Objective:** extract only proven global layers before any feature CSS relocation.
- **Initial bounded scope:** move root design variables/theme variables to `src/styles/tokens.css`; then, in a separate commit, move reset/typography/global shell rules to `src/styles/global.css`. Preserve explicit load order.
- **Out of scope:** selector renaming, value changes, palette/radius redesign, Admin D2 rule movement, Skin CSS redesign, deleting `talent.css`.
- **Invariants:** computed values and accepted dark-charcoal/antique-gold visuals remain unchanged in light/dark, desktop/mobile, public/Admin states.
- **Proof:** build; computed-token comparison; screenshot/visual comparison of public routes and Admin; reduced-motion/responsive smoke; D2 browser proof.
- **Rollback:** one commit per extracted layer.
- **Risk:** HIGH because cascade order is application behavior.
- **Execution model:** **Terra High**.

### Explicitly deferred feature migrations

Public Character/Calculator router migration and the Character/Skin Admin renderer convergence are not scheduled as mechanical batches. They should begin only with active domain work and a dedicated parity plan. The combined `server/character-skin-admin-domain.mjs` should likewise not be split merely to make the tree look symmetrical.

## 7. Recommended first migration batch

Choose **Batch 1 — stable application bootstrap seam**.

It has the best risk/value/reversibility ratio because:

- `index.html` keeps its proven `/src/main.js` entry, so Vite and deployment entry assumptions do not move;
- no route, domain renderer, Admin island, API, server, database, CSS, or public asset moves;
- it creates the canonical `src/app/` boundary needed by later shell/router work;
- the exact initialization sequence can be copied without semantic changes; and
- rollback is one small commit with no external state.

Do not move the D2.4.1 Character/Skin island first. It is stable, dynamically loaded, and coupled to cache/editor/CSS/API invariants; its current risk is much higher than the organizational value of an immediate path move.

Recommended execution: **Luna High**, with a strict build/browser parity gate. Risk: **LOW–MEDIUM**.

## 8. Validation matrix

| Validation | B1 bootstrap | B2 asset resolver | B3 accounts | B4 assets | B5 Preview paths | B6 Preview orchestration | B7 Admin shell | B8 styles |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `git diff --check` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `npm run build` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Public route smoke | ✓ | ✓ | — | — | — | — | ✓ | ✓ |
| `public/data.json` unchanged/parity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D2 Character/Skin domain proof | — | — | — | — | — | — | ✓ | ✓ |
| D2 browser proof | smoke only | image routes | — | — | — | — | ✓ | ✓ |
| D1 auth/reset | — | — | ✓ | — | as dependency | — | ✓ | — |
| D0 Preview/Asset | — | — | — | ✓ | ✓ | ✓ | ✓ | — |
| Local Vercel HTTP | Admin shell smoke | image routes | ✓ | upload routes | Preview routes | ✓ | ✓ | visual routes |
| Schema/migration integrity | — | — | no diff check | no diff check | no diff check | no diff check | — | — |
| Staged secret scan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

For every batch:

1. confirm the exact diff contains only the batch scope;
2. verify all old-path references are gone or intentionally retained as compatibility shims;
3. run on Windows and ensure import casing will work on Linux/Vercel;
4. do not run production migrations or real R2 writes;
5. inspect `git status` before committing; and
6. record any intentionally skipped proof and its reason.

## 9. Rollback strategy

- One successful migration batch equals one commit. Do not mix cleanup, feature work, schema changes, or visual changes into that commit.
- Before accepting a batch, confirm the previous accepted batch is available remotely if the owner authorizes pushing it.
- Preserve `pre-app-architecture-migration-2026-09-20` permanently as the whole-migration rollback reference.
- For a failed/unaccepted batch, preserve unknown work and use a targeted inverse patch or a recovery branch. Do not use `git reset --hard`, `git clean`, or broad restore.
- For an accepted batch later found defective, prefer a normal `git revert <batch-commit>` on the active branch, subject to owner approval and compatibility review.
- Database and object storage are outside these structural batches. If a proposed batch would require external-state rollback, it is no longer a folder-only migration and needs a separate plan.

## 10. Deferred areas

Do not migrate these as part of early application organization:

- stable public Character, calculator, talent, motion, Lenis, and lore-reveal modules without active product work;
- the accepted D2.4.1 Character/Skin island solely to improve its pathname;
- `tools/` localization/build/recovery pipelines or their fixed source paths;
- localization batches, reviews, backups, exports, temporary workbooks, and caches;
- NeoArtifacts or raw MasterData/runtime updater architecture;
- `public/data.json` publication design;
- workbook-to-PostgreSQL localization authority transfer;
- database schema/migrations;
- production Neon, production R2, Vercel deployment, or dependency upgrades;
- visual redesign or broad CSS selector/value cleanup; and
- deletion of apparently unused files such as `src/talent.css` without focused evidence.

## 11. Definition of done

The migration is complete only to the extent of the approved batches, and only when:

- the resulting target organization is coherent rather than a collection of aliases and half-moves;
- Vite entry, hash routes, dynamic imports, Vercel routes, server imports, proof scripts, and documentation resolve correctly;
- required build, domain, HTTP, browser, and parity proofs pass;
- accepted public and Admin behavior is equivalent, including D2.4.1 invariants;
- `public/data.json`, database schema/data authority, R2 data, and authorization policy did not change accidentally;
- API adapters remain thin and domain orchestration resides in `server/`;
- `db/` contains client/schema/migrations/narrow primitives rather than feature orchestration;
- migrated production module names do not retain temporary milestone labels;
- shared code has a proven stable domain-neutral contract; and
- canonical documentation reflects final accepted paths and any deliberately retained legacy boundaries.

Legacy modules that were explicitly deferred do not block completion. The canonical architecture requires incremental convergence, not a repository-wide move for its own sake.
