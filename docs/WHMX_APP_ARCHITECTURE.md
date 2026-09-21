# WHMX Application Architecture

## 1. Purpose and scope

This is the canonical guide for organizing the **WHMX application**. It governs where new application modules, domain logic, rendering, styling, APIs, database concerns, and operational tooling belong.

It does not replace the repository-root [`ARCHITECTURE.md`](../ARCHITECTURE.md). That file describes the Codex Kit scaffolding (`AGENTS.md`, skills, workflows, and agents), not the WHMX product architecture.

This guide governs *where code lives*. For *how to write code so it stays stable without becoming rigid* — isolating decisions that may change behind narrow interfaces, avoiding vendor lock-in, and judging when flexibility is worth its cost versus when it is premature — see [`WHMX_ENGINEERING_PRINCIPLES.md`](./WHMX_ENGINEERING_PRINCIPLES.md). Read both before substantial new work.

This guide is intentionally incremental. WHMX has valid legacy Vite/vanilla-JavaScript code alongside newer Vue, Vercel Function, PostgreSQL/Drizzle, Better Auth, and R2 work. It is not authorization for a rewrite, a mass move, or a change in product behavior.

## 2. Architectural status vocabulary

| Status | Meaning |
| --- | --- |
| **LOCKED** | New implementation must follow this decision unless the owner explicitly changes it. |
| **TARGET** | New or substantially refactored work should move toward this pattern. Existing code may remain while it is sound and out of scope. |
| **OPEN DECISION** | Do not encode a permanent implementation assumption until an owner decision or a later approved architecture record resolves it. |
| **LEGACY** | A valid existing implementation that is not the preferred template for new work. It is not automatically defective. |

## 3. Current application reality

Audit snapshot: 2026-09-21. The repository is a deliberately mixed application, not a clean-room framework migration.

| Area | Observed current state | Status |
| --- | --- | --- |
| Public browser app | Vite serves `index.html`; `src/main.js` delegates startup to `src/app/bootstrap/boot.js`, and `src/app/router/router.js` drives the hash-routed, mostly plain-JavaScript SPA. `src/data/loader.js` reads the public snapshot. | Current hybrid boundary |
| Public UI | `src/features/characters/`, `src/features/skins/`, `src/features/calculator/`, and `src/features/weapons/` own their respective public renderers. `src/ui/` now holds only the remaining shared/Character-adjacent Calculator modules (`calcCharacterPicker.js`, `talentGraph.js`, `resourceSummary.js`, `loreReveal.js`, `utils/`) and the orphaned `dataView.js` placeholder, kept in their legacy location because they are genuinely shared with the Character feature or app shell rather than Calculator/Weapons-exclusive. Global navigation, sidebar, feedback, theme, and smooth-scroll behavior live in `src/app/`. | Current hybrid boundary |
| Vue | Vue 3 is used as a dynamically imported, programmatically mounted Character/Skin Admin island in `src/admin/character-skin/characterSkinAdminWorkspace.js`. There are currently no `.vue` SFCs or a Vite Vue-plugin boundary. | Current hybrid boundary |
| Admin shell | `src/admin/layout/adminShell.js` and `src/admin/preview/previewWorkspace.js` provide the authenticated Admin shell and Preview workspace; the former retains its accepted route/session/UI responsibilities. | Current hybrid boundary |
| API runtime | `api/` contains Node-style Vercel Function adapters for auth, session, Admin Character/Skin/Preview/User routes, managed-asset upload intents, and DB health. Preview routes delegate transaction-scoped reads/mutations into `server/preview-characters/`. | Current foundation |
| Server/domain layer | `server/admin/accounts/`, `server/assets/`, and `server/preview-characters/` are already real current domain directories; remaining Better Auth, Character/Skin Admin, and R2 adapter modules stay flat until their own bounded batch. | Current foundation; TARGET for remaining domain directories |
| Database | Neon/PostgreSQL is accessed through Drizzle and `postgres` in `db/`. Schemas are already separated into auth, core, Character/Skin, and preview/asset files; committed SQL migrations exist. | Current foundation |
| Assets | Source card/drawing assets are R2/CDN-backed; public avatars, item icons, and Series badges are local public assets. Managed-asset services store metadata and mappings in PostgreSQL, not image bytes. | Current foundation |
| Public data | `public/data.json` remains a generated, read-optimized frontend artifact. `tools/build_web_data.py` joins source-backed relationships, localization, and asset information; it is not a blind table export. | Current public delivery |
| Auth | Better Auth is mounted under `api/auth/[...].js`; Admin reads session state from `api/admin/session.js`. Roles and active status are enforced server-side. | LOCKED security boundary |
| Operations | `scripts/` contains migrations, importers, bootstrap/reset operations, and proof scripts. `tools/` contains the existing localization/build/validation workflow. | Current operational boundary |

The current public application is therefore not yet an `app/` + `features/` tree. The target below is deliberately shaped so that it can be reached one bounded domain at a time.

## 4. Target frontend organization

**TARGET.** New substantial frontend work should use domain ownership and keep application-wide concerns separate. Do not create empty directories simply to match this sketch.

```text
src/
  app/                         # application shell only
    bootstrap/                 # startup and app mounting
    layout/                    # global navigation, header/footer, shell regions
    router/                    # route registration and route-level composition
    runtime/                   # shared application lifecycle behavior
    settings/                  # theme, persisted UI preferences, app providers

  features/
    characters/
      components/              # public Character composition and local parts
      views/                   # route-level Character views where justified
      api/                     # browser adapters for Character endpoints/data
      styles/                  # Character-owned CSS when justified
    skins/
      views/
      styles/
    profile/
    skills/
    buffs/
    guides/
    tier-list/
    assets/

  admin/                       # cross-cutting Admin workspace, not domain copies
    layout/
    auth/
    accounts/
    preview/
    audit/
    components/                # only when a real Admin-wide component exists

  shared/                      # proven domain-neutral primitives only
    components/
    composables/
    api/
    types/
    utils/

  styles/
    tokens.css                 # only when a stable global token layer exists
    global.css                 # only when a stable global/base layer exists
```

### Incremental mapping from today

- When public bootstrap/navigation/router code is materially changed, migrate its bounded responsibility from `index.html`, `src/main.js`, `src/router.js`, and `src/ui/` toward `src/app/`; do not move it merely for appearance.
- Keep current public rendering functional while a domain is migrated. A feature may initially wrap a legacy renderer or data adapter.
- Keep the accepted Admin shell at `src/admin/layout/adminShell.js` and Preview workspace at `src/admin/preview/previewWorkspace.js`. Evolve the Vue Character/Skin island only when materially extended; accepted D2.4.1 behavior is a baseline, not a migration trigger.
- New Character/Skin/Profile/Skill/Buff/Guide/Tier List work belongs in the owning feature, even if the public consumer remains legacy JavaScript for a period.
- A new Vue module should use TypeScript and may use `<script setup lang="ts">`; adopting SFCs later is optional, not a prerequisite for organizing a feature.

`app/` may know which feature route is active. It must not contain Character, Skill, Guide, or Tier List business rules, fetch contracts, or feature-specific editor rules.

## 5. Domain ownership rules

**TARGET.** A domain owns its public representation, its feature-specific browser data adapter, its local components, contracts, and styles. It does not own application navigation, database credentials, raw-source import mechanics, or unrelated Admin shell UI.

| Domain | Owns | Does not own |
| --- | --- | --- |
| Characters | Character display model, public renderer/composition, Character pages, Character-specific Admin editing adapters, Character contracts. | Skin gallery policy, global navigation, raw ID mutation. |
| Skins | Skin gallery/detail display, Series/acquisition presentation, Skin-specific editor adapters, asset-reference presentation. | Character identity authority, generic upload security, global shell. |
| Profile | Profile display/edit contracts, provenance-aware presentation, profile-local components. | Character or Skill renderer copies. |
| Skills | Skill views, exact source-backed relationship display, Skill contracts and local styling. | Inferred gameplay relationships or generic Admin layout. |
| Buffs | Buff/status views and raw-evidence relationship presentation. | Guessing semantics from IDs or text similarity. |
| Guides | Guide content model, renderer, publication-aware editing surface when approved. | Tier List ranking logic or global publishing implementation. |
| Tier List | Tier List model, renderer, filtering/presentation, approved revision/publication controls. | A generic cross-product `shared/` dumping ground. |
| Assets | Asset-reference components, browser-side asset API adapters, selection UI that is genuinely domain-neutral. | Storage credentials, unverified upload acceptance, or direct object-store mutation from the browser. |

Character and Skin may share a narrowly defined relationship contract where exact source evidence requires it. They should not be collapsed into one generic `gameData` feature merely because both are in the current Admin workspace.

## 6. Shared renderer rule

**LOCKED.** The real public renderer is the default renderer for Admin preview and future contextual inline editing whenever practical. Admin may supply draft/effective data, permissions, controls, and an editing frame; it must not maintain a visually similar independent domain renderer stack.

For example, a future `features/characters/components/CharacterProfileRenderer` should receive a documented Character presentation contract. The public Character page supplies published data; a Character Admin preview supplies a revisioned draft of that same contract. Admin-only source comparison, dirty state, save/discard controls, and audit panels remain outside the renderer.

This is a correctness rule, not a forced immediate rewrite of the current vanilla public Character renderer or the accepted Vue D2.4.1 workspace. When the applicable public renderer or Admin preview is substantially changed, reuse must be evaluated first and any justified exception recorded in that change.

### Shared promotion rule

**LOCKED.** A component starts inside its feature. Move it to `shared/` only after all of the following are true:

1. it has real use in more than one domain or app-wide context;
2. its API is stable and domain-neutral;
3. it does not import feature business rules, field names, or domain-specific types; and
4. its ownership and accessibility behavior remain clear.

Modal, ConfirmDialog, SearchInput, EmptyState, LoadingState, generic form primitives, `EntityImage`, and a contract-neutral `FieldComparison` are plausible shared candidates. A `CharacterSkillPanel` is not.

## 7. Admin architecture

**LOCKED.** Admin is a cross-cutting authenticated workspace, not a second public application.

Admin provides the work that is genuinely administrative: authentication/session handling, account provisioning, audit/history, source comparison, conflict presentation, bulk/search workflows, review queues, moderation/publication controls, and asset-management workflow. Domain rendering and domain data contracts remain owned by the feature.

Contextual inline editing and a full CMS may coexist:

```text
public route + authorized editor -> contextual Edit entry point -> feature editor
Admin workspace                 -> bulk/search/review/audit operations -> same feature contracts/renderers
```

**LOCKED.** A visible Edit button, a browser role value, or an Admin route is never the authorization boundary. Every read/write with protected scope must validate the server session, active user status, role, field allowlist, input schema, and optimistic revision as applicable. Raw/source-backed fields remain unavailable to routine mutation.

Avoid `PublicCharacterRenderer` and `AdminCharacterPreviewRenderer` that independently implement the same product representation. Use a public renderer plus Admin wrappers, or document the narrow technical reason a renderer cannot yet be shared.

## 8. Backend organization

**LOCKED boundary; TARGET layout.**

```text
api/                            # thin Vercel Function / HTTP adapters
  auth/
  admin/
  internal/

server/                         # server-only application/domain behavior
  auth/
  admin/                        # cross-cutting authorization/account helpers
  characters/
  skins/
  preview-characters/
  assets/
  publishing/
  audit/
  shared/                       # server-only errors, request context, validation helpers

db/                             # client, schema, migrations, narrow DB primitives
  client.mjs
  schema/
  migrations/

scripts/                        # explicit operational commands and proof tools
  imports/
  exports/
  migrations/
  proofs/
tools/                          # existing build/localization/validation tooling
```

Today, Vercel adapters already live under `api/`, while the corresponding server modules are flat files such as `server/character-skin-admin-domain.mjs`, `server/preview-character-domain.mjs`, `server/managed-asset-domain.mjs`, and `server/auth.mjs`. The current database split in `db/schema/` is already a useful precedent. New server domains should prefer the target placement; existing files move only when their bounded domain is actively refactored.

`api/` adapters parse HTTP-specific input, call a server operation, and map known domain errors to response envelopes. They must not accumulate authorization policy, transaction orchestration, raw-source mapping, asset finalization, or feature business logic. `server/` owns domain-specific query composition, transactions, authorization, invariants, and business orchestration. `db/` owns the database client, schema, migrations, and narrowly reusable database primitives. `scripts/` and `tools/` own explicit operator/build/import/export/proof work. Vercel build/deploy must not silently run database migrations.

## 9. TypeScript policy

**TARGET.**

- New substantial application and Vue frontend modules prefer TypeScript.
- New Vue work may use `<script setup lang="ts">` when an SFC is appropriate; TypeScript in a `.ts` module is equally valid where the existing island boundary calls for it.
- Define explicit domain contracts when the system knows the contract: for example `Character`, `Skin`, `Profile`, `Skill`, `Buff`, `Guide`, `TierList`, `PublicationState`, and `RevisionedEntity`.
- Avoid `any` where a contract is known. Use validation and narrow/unknown-to-validated conversion at transport boundaries.
- Do not mass-convert legacy JavaScript. Convert a bounded module only while substantially refactoring it or when type safety has a concrete correctness/maintenance benefit.

TypeScript improves development-time checking and refactoring confidence. It does not improve runtime performance, replace runtime validation, or create a security boundary.

## 10. Styling policy

**TARGET with a LOCKED visual invariant.** Current styling is primarily `src/style.css`, with `src/talent.css` and `src/features/skins/styles/skinGallery.css` as established local exceptions. This remains a gradual extraction, not a required CSS migration and not a Tailwind mandate.

**LOCKED placement convention.** The repository is domain-first, not file-type-first:

- Application-global JavaScript belongs in `src/app/<responsibility>/`, such as `bootstrap/`, `layout/`, `router/`, `runtime/`, and `settings/`.
- Feature-owned JavaScript belongs in `src/features/<domain>/`. Use bounded `views/`, `components/`, `api/`, or `utils/` categories only when the domain has enough real files to justify them.
- Cross-cutting Admin JavaScript belongs in `src/admin/<area>/`, such as `layout/`, `auth/`, `accounts/`, `preview/`, and `audit/`.
- Truly global CSS belongs in `src/styles/`. `tokens.css` and `global.css` may exist when they each represent a stable global responsibility; `typography.css` is not mandatory.
- Feature CSS belongs in `src/features/<domain>/styles/`. Do not colocate it beside feature JavaScript when the domain already has a meaningful deterministic `styles/` directory. The accepted `src/features/skins/views/` and `src/features/skins/styles/` structure remains in place.
- Genuinely Admin-only CSS belongs in `src/admin/styles/`, for example `adminShell.css`, `previewWorkspace.css`, or `characterSkinWorkspace.css`; do not scatter arbitrary style directories through every Admin subarea.

Do not create `src/js/` or `src/css/`. `src/styles/` is not a dumping ground: feature-specific and Admin-specific selectors belong with their owners. Do not create empty directories merely for appearance.

**LOCKED:** architectural cleanup must preserve WHMX's accepted dark-charcoal / antique-gold visual direction, typography, and interaction character. Do not silently recolor the product, normalize all radii, or turn a file move into a visual redesign.

## 11. Data and asset delivery boundaries

| Boundary | Current verified role | Architectural rule |
| --- | --- | --- |
| Structured database data | Neon/PostgreSQL + Drizzle is the hosted working/Admin layer for the implemented domains, including revision/audit-aware workflows. | Database credentials and direct privileged access stay server-side. |
| Object-storage assets | R2/CDN supplies source card/drawing assets; public local assets still supply avatar/item/Series resources. Managed asset rows carry metadata/mappings, not image bytes. | A scoped, short-lived, server-issued presigned browser-to-R2 upload is allowed. Browser storage credentials, unrestricted or unscoped object-store mutation, unverified upload acceptance, and client-trusted finalization or activation are prohibited. |
| Public data delivery | `public/data.json` is the current read-optimized Vite artifact generated from trusted inputs. | It remains a projection, not an editable source and not a substitute for DB/admin models. |
| Admin/live preview | Current Admin reads protected hosted APIs and DB-backed effective/domain data. | Preview must use server-authorized data and favor the real public renderer. |

**LOCKED:** a routine hosted Admin Save must not require the owner to open a local PC, manually export data, rebuild Vite, and redeploy in order to publish routine content changes.

**OPEN DECISION — public publication mechanism.** The exact split between direct hosted reads (for example Admin/live preview or selected public experiences) and an unattended, versioned R2/CDN public-data publisher is not locked here. The current static `public/data.json` path remains valid during transition, but it does not by itself satisfy the long-term routine-publication requirement. Decide the durable publisher, review/approval model, versioning/rollback, and which public routes may read hosted APIs before hard-coding a new public delivery contract.

## 12. Source-of-truth boundaries

**LOCKED.** Source authority does not move merely because a value has been imported into PostgreSQL or displayed by Admin.

```text
NeoArtifacts raw MasterData / runtime evidence
  -> authoritative for raw CN, IDs, exact source relationships, gameplay evidence,
     and raw asset provenance

localization/localization_master.xlsx
  -> current persistent Vietnamese localization authority

PostgreSQL
  -> hosted normalized working/Admin layer; explicit human overrides, revisions,
     provenance, and audit for implemented domains

public/data.json
  -> generated public projection, never a hand-edited authority
```

Exact raw evidence beats ID-shape, suffix, text-similarity, or display-name inference. Importers and future relationship models must preserve actual nulls and source distinctions rather than fabricate convenient fallbacks.

**OPEN DECISION — localization authority transfer.** The workbook remains the verified persistent localization authority. Database-held Admin edits/overrides do not prove that authority has transferred. If PostgreSQL is to become a localization authority, the owner must approve the reconciliation, import/export, review, conflict, and rollback policy explicitly; until then, retain traceability to the workbook/source baseline and do not silently replace it.

## 13. Migration strategy

**LOCKED: no big-bang rewrite.** Apply “touch it, improve it”:

- A new feature starts in the target organization.
- A substantial refactor of a legacy feature may migrate that bounded feature and its direct tests/contracts.
- A trivial bug fix does not force an architectural move or JS-to-TS conversion.
- Extract shared code only after the shared promotion rule is met.
- Avoid repository-wide file moves, naming churn, or framework migration without a concrete product, correctness, or maintenance payoff.
- Preserve accepted D2.4.1 Character/Skin Admin behavior while that area is not otherwise being changed.

When a migration spans a public renderer and Admin preview, preserve behavior first, introduce a shared contract/renderer behind the existing route, then retire duplication only after parity is demonstrated. Do not make a visually similar Admin preview a substitute for parity.

## 14. Anti-patterns

- One giant workspace file that owns routing, fetching, cache, grid, editor, history, source rendering, and mutation forever.
- Feature business logic inside the global app shell.
- Independent Admin and public renderers for the same product representation.
- Adding every new selector to one global CSS file indefinitely.
- Putting domain rules, transaction choreography, or raw mapping directly in Vercel Function handlers.
- Treating `shared/` as an unowned miscellaneous folder.
- Naming durable production modules after temporary milestones such as `d2` or `d3`.
- Treating browser role checks or hidden buttons as security.
- Hard-coding content in JavaScript that is intended to become Admin-managed data.
- Inferring gameplay relationships from an ID/text pattern when raw evidence exists.
- Requiring routine hosted Admin content saves to depend on the owner’s local export/build/deploy workflow.

## 15. Feature checklist

Before adding or materially restructuring a feature, answer:

1. Which domain owns it?
2. Is it app-global, domain-local, Admin-only, or truly shared?
3. Does a public renderer already exist, and can Admin preview/contextual editing reuse it?
4. What is the authoritative source, what is editable, and how is provenance represented?
5. What server-side authorization, validation, revision, and audit boundary applies?
6. What explicit TypeScript contract represents it, or why is a bounded legacy-JS exception appropriate?
7. Where does its CSS belong, and does it preserve the accepted palette?
8. Does it introduce a data-delivery or publication assumption that is still open?
9. Does it preserve raw-source authority and avoid relationship inference?
