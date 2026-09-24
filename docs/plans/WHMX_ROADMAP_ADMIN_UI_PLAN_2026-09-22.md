# WHMX — Admin/Public UI Integration Roadmap (post-structural-migration direction)

## Context

The structural migration wave (Phase A push + Q1–Q4: Calculator/Weapons/Admin-workspace ownership + bounded CSS follow-up) is **already executed** as 8 local commits on `feat/postgres-admin-crud` (`ac32f14`…`df7898e`), not pushed yet. That work is done and is **not** part of this plan — see `docs/WHMX_ARCHITECTURE_MIGRATION_PLAN.md`'s "Accelerated Frontend Migration Wave completion — 2026-09-21" section for the record. Per that plan's own philosophy and the owner's agreement, structural repo cleanup stops here; further "just move one more file" batches are explicitly out of scope.

The owner now wants direction for what comes **after** migration: an Admin experience that is integrated into the public site (not a walled-off second app), with contextual "Edit" affordances appearing directly on public pages for authorized editors, plus a reworked global sidebar that carries an Admin entry point. This request was informed by:

- A reference analysis document the owner added (`docs/WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md`, ChatGPT-authored) covering two reference products: **S1N.gg** (Path to Nowhere wiki/tool) and **Great Limbus Library / gll-fun.com** (Limbus Company fan database).
- Live browsing of both sites in this session (S1N: Sinners roster, character detail tabs, Guides, Crimebrands; GLL: Tier List with its disclaimer block, Identities grouped by character) to verify the analysis doc's claims against the real UI rather than trusting the write-up blindly.
- The owner's explicit corrections: **do not copy S1N's gold SSR color** (WHMX's SSR is red, always was); **do not copy S1N's "ticket" underline-fade rarity treatment 1:1** — it's too visually specific to their game. WHMX has its own layered "ticket" background assets (used in-game) as a possible alternative, feasibility/stacking unconfirmed, not committed to yet.

This is a **direction-setting plan**, not a sprint-ready spec for every item. Some pieces (the SSR color-token fix) are concrete enough to execute as soon as the owner says go; others (contextual editing, nav rework) need a first small slice built before the rest is designed in detail.

## What NOT to re-plan (already has a plan elsewhere)

- Repo structural migration (Q1–Q4, server domain grouping, CSS ownership) — **done**, tracked in `WHMX_ARCHITECTURE_MIGRATION_PLAN.md`. Only remaining action is pushing the 8 local commits when the owner is ready to review them.
- Future content domains (Profile/Skill/Buff/Guide/Tier List) as **data models** — direction already recorded in `WHMX_CURRENT_STATE_FINAL_2026-09-20.md` §14 and the handoff doc. This plan only adds the *editing/UI* layer on top; it does not re-decide what those domains contain.
- DB → public/R2 publication architecture — mechanism now **LOCKED as Hướng B** (2026-09-22, see `WHMX_APP_ARCHITECTURE.md` §11), kept Hướng-A-compatible via JS/Node per-entity resolvers; the actual publish pipeline is still unbuilt. Still explicitly *not* to be bundled into UI work. Not touched here.
- Localization authority transfer (workbook → PostgreSQL) — OPEN DECISION, unrelated, not touched here.

## Verified current state (grounding facts, not assumptions)

- The global icon rail (`.app-nav`, static markup in `index.html` lines ~59–105, icons via `src/app/layout/appNav.js`) has **zero session-awareness** today — no login link, no admin affordance, just 4 static route links (Characters/Skins/Weapons/Calc).
- `body.admin-route-active > .app-nav { display: none !important; }` (now in `src/admin/styles/adminShell.css`, moved verbatim in Q4) **actively hides** the global rail whenever the hash is under `#/admin`. Admin today is a fully separate shell (`src/admin/layout/adminShell.js`), not a content-area-within-the-global-layout like every other route.
- Session check is `fetch('/api/admin/session', {credentials:'same-origin'})`, currently called **only** from inside `adminShell.js`, gated by `isAdminRoute()`. Public boot (`src/app/bootstrap/boot.js`) never calls it — there is no existing "am I an admin" signal available to public-page code today.
- `characterSkinAdminWorkspace.js` (`src/admin/character-skin/`) is already a large (364-line) render-function component doing Character CRUD + Skin CRUD + History + Source-comparison + module-level caching in one file. This is the exact god-component shape the reference analysis warns against — a real, current risk, not hypothetical.
- SSR rarity color already has a correct, unused design token in `src/styles/tokens.css`: `--rarity-ssr-bg: rgba(145, 55, 45, 0.48)`, `--rarity-ssr-text: #F0A08F` (light salmon-red, WHMX's own hue), `--rarity-ssr-border: rgba(210, 92, 76, 0.55)`. `.chip-ssr` in `src/style.css` already hardcodes these exact values correctly. `.rarity-badge.ssr` and `.cd-rarity-badge-large.ssr` do **not** use the token and are the ones carrying the corrupted/muddy value fixed earlier this session (`ac32f14`) to a plausible-but-not-token-matched `rgba(255, 57, 47, 0.667)`.

## What to actually take from S1N / GLLimbus (principle, not pixels)

| Reference observation | WHMX takeaway | Do NOT copy |
|---|---|---|
| S1N icon rail: domain links stacked top-to-bottom, then a language toggle, then **Login pinned at the very bottom, visually separated** | Same placement pattern for an Admin/Login entry in `.app-nav` | S1N's icon set/branding |
| S1N shows `/login` to everyone, admin-only links presumably appear only post-auth (not observable logged-out) | Confirms "check session, conditionally render" is the right pattern, not a hardcoded always-visible tab | — |
| S1N Sinner card: rarity shown as a **thin colored underline**, not a filled badge | Confirms WHMX's own "ticket" asset idea is worth exploring as an alternative rarity treatment — but as a separate visual-design task, not blocking anything here | The literal underline-fade technique (owner's explicit call — too "signature" to that site) |
| GLL Tier List: transparent **disclaimer/methodology block** above the ranked list; tier groups show item counts; "NEW" badge on fresh entries; link out to Discord for disputes | Directly reusable pattern *when* WHMX builds its own Tier List domain later | Their exact tier boundaries/game balance opinions (not relevant, different game) |
| GLL Guides: **author-attributed** cards, grouped by category | Worth deciding now whether WHMX's future Guide domain supports multiple community authors or stays Admin-only-authored (affects the data model, cheap to decide early, expensive to retrofit) | — |
| GLL `AdminEditor`-equivalent risk (per the analysis doc, not independently observed since admin is private) | Directly applicable warning given `characterSkinAdminWorkspace.js` is already large | — |

## Roadmap — phased, in recommended order

### Phase 0 — SSR rarity color fix — ✅ DONE, pushed

Unified `.rarity-badge.ssr` and `.cd-rarity-badge-large.ssr` (`src/style.css`) onto/near the existing `--rarity-ssr-text` token, brightened background/border. Committed as `2e00309`, pushed to `origin/feat/postgres-admin-crud`. Verified live in browser (Character Detail header + Overview tab, character A0090).

The "layered ticket asset" rarity treatment remains a **separate, unscheduled idea** — feasibility of stacking multiple PNG/WebP layers per card needs its own small spike before it's a real plan item.

### Phase 1 — Session-awareness primitive (foundation for everything else)

Before any nav/UI can conditionally show an Admin entry, the public app needs a shared, cheap way to ask "is the current visitor an authenticated admin/editor." Concretely:
- A small module (e.g. `src/app/auth/session.js` or similar — exact placement TBD at design time) wrapping `fetch('/api/admin/session')`, called once at boot (`src/app/bootstrap/boot.js`), cached, exposed to both `appNav.js`/the nav renderer and any future contextual-edit code — reusing the existing `/api/admin/session` endpoint and Better Auth/role model already built for D1, not a new auth system.
- Decide caching/refresh strategy (session cookie already HttpOnly + server-validated; client cache is UX-only, must never be treated as the authorization boundary — matches WHMX's own already-LOCKED principle).

### Phase 2 — Global nav becomes truly global (including Admin route)

- Remove/rework the `body.admin-route-active > .app-nav { display: none }` rule so the icon rail renders on Admin routes too.
- Add a single session-aware entry at the bottom of `.app-nav` (mirrors the verified S1N placement pattern: pinned below the domain links, visually separated). This one entry point covers both states: unauthenticated → links to the existing `#/admin` login form; authenticated owner/editor → links into the Admin/workspace. Not a general "Login" feature for ordinary visitors — WHMX has no such concept (see confirmed decisions above).
- This changes Admin from "a separate shell that replaces the whole page" to "a content area within the shared layout," which has knock-on layout implications for `adminShell.js` (it currently owns full-page markup including its own header) — needs its own small design pass, not a blind CSS toggle.
- Explicitly preserve D2.4.1 behavior in the Character/Skin workspace itself — this phase touches the *shell around* it, not its internals.

### Phase 3 — Contextual inline editing, MVP on one domain

Start with **Character** specifically because Admin CRUD for it already exists end-to-end (fields, API, validation, revision) — this phase adds a *new UI entry point* to existing server capability, not new backend work:
- On the public Character detail page, an authorized editor (per Phase 1's session check) sees small "Edit" affordances next to the already-editable fields (`name_vi`, `fullname_vi`, `nickname_vi`, `tags_vi` for Character; `name_vi`/`description_vi`/`obtain_vi` for Skin — the exact same allowlist D2.4.1 already enforces server-side).
- Reuse the existing `/api/admin/...` mutation endpoints and their optimistic-revision/409-conflict handling — do not invent a parallel write path.
- **Guardrail from the reference-doc lesson:** build this as a small, focused "field editor" component, *not* by reaching into `characterSkinAdminWorkspace.js` and copy-pasting its editor logic. If a piece of that file's logic needs to be shared, extract it into its own module first — do not let contextual-edit become a second copy of the god-component's internals.
- Skin/other domains follow once the Character MVP is validated, each its own small batch.

### Phase 4 — Extend the pattern to future domains as they're built

Guide, Tier List, Skill, Buff get contextual editing + shared-renderer preview (per the already-LOCKED "public renderer reused for Admin preview" principle) as *part of building each domain*, not as a retrofit — this is already the intended order per `WHMX_CURRENT_STATE_FINAL_2026-09-20.md`. When Guide is designed, decide the author-attribution question (single Admin-authored vs. multi-contributor) up front, informed by GLL's pattern above.

## Decisions confirmed by the owner

1. **Admin tab is a shortcut only.** It links to the existing `#/admin` login flow — no change to the login page/shell logic itself, just a new discoverable entry point instead of requiring the URL to be typed manually.
2. **Admin's own header stays as-is for the first pass.** `WHMX ADMIN` eyebrow, role badge, logout button keep their current markup/behavior; only the global sidebar wraps around it. Merging it into one shared top bar is a later polish, not part of this phase.
3. **Session check runs on every public page load**, cached after boot. Important context behind this: **login on WHMX has no general-audience purpose at all** — it exists solely for the owner and a small number of invited editors (matches the already-LOCKED D1 rule: one account per person, roles owner/editor, public self-signup disabled). There is no "regular user account" concept to design around. The extra request is checking "is this anonymous visitor secretly one of the ~handful of authorized people," not gating a mass-market login feature — so the per-page-load cost is a non-issue at this site's scale, and no anonymous-visitor login/signup UI should ever be designed.

## Plan A — Consolidate `api/admin/*` into one serverless function (Vercel Hobby 12-function cap)

### Why

Vercel Preview deployments have been failing (`Build Failed: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`) since before this session started — confirmed by checking the Vercel dashboard, and confirmed unrelated to any code content (docs-only commits fail identically). `api/` currently has exactly **13** route files, 1 over the cap:

```
api/admin/assets/upload-intents.js
api/admin/assets/upload-intents/[id]/finalize.js
api/admin/characters/[characterId].js
api/admin/characters/index.js
api/admin/previews/[id].js
api/admin/previews/index.js
api/admin/session.js
api/admin/skins/[skinId].js
api/admin/skins/index.js
api/admin/users/[id].js
api/admin/users/index.js
api/auth/[...].js
api/internal/db-health.js
```

Owner is on the free Hobby plan with no intent to pay for Pro or migrate off Vercel (evaluated and rejected switching to Supabase/Netlify/Cloudflare Pages/Render — see conversation record; each requires re-verifying already-CLOSED D1 auth / D2.4.1 CRUD milestones for a benefit that doesn't fit WHMX's custom server-authorization model). A one-off fix (merge 2-3 file pairs) would only buy headroom for one more domain; every future content domain (Skill/Guide/Tier List/Buff) and every Character sub-feature that gets Admin CRUD (Talent, Hoán Chương, Lore) would re-trigger the same wall under the current "1 file per resource" pattern. Fix the pattern once, not per-domain.

### Grounding facts (from live code audit this session)

- **A single shared helper already exists and is used by all 10 consolidatable files**: `server/admin-api.mjs` exports `authenticatedUser(request, {requireOrigin})` (the session/role/active-status check — no file duplicates its own auth logic), `requestBody(request)`, `requestId(body)`, `sendAdminError(response, error)` (uniform `{error:{code}}` envelope), `AdminApiError`, `assertSameOrigin`. The consolidation reuses this module as-is.
- All mutating routes set `module.exports.config = {api:{bodyParser:false}}` and call `requestBody()` manually — must be preserved on the new file.
- Route param naming is inconsistent today (`characterId`, `skinId`, plain `id` for users/previews/upload-intent-finalize, and `skins/index.js` oddly takes `?id=` for a single-skin lookup rather than a true list) — irrelevant to external callers (they only see the URL), the new dispatcher can normalize internally.
- `api/admin/previews/[id].js` has unique branching logic in its `PATCH` handler (routes to `setPreviewPublicationState` vs `updatePreviewCharacter` depending on whether `body.lifecycle`/`body.visibility` are present) — must be preserved exactly.
- `api/admin/assets/upload-intents/[id]/finalize.js` is nested one extra directory level (import paths currently `../../../../server/...`).
- Two routes have **no current frontend caller** (`users/[id].js` PATCH, `skins/index.js` GET-by-id) — keep them working in the consolidation anyway (no silent capability loss), just note they're currently unused.
- **Critical: using Vercel's catch-all convention (`api/admin/[...path].js`) preserves every external URL exactly as-is** (`/api/admin/characters/A0090` still resolves the same way, now via path-array `['characters','A0090']` instead of a dedicated file). This means:
  - **Zero changes needed** in `src/admin/character-skin/characterSkinAdminWorkspace.js`, `src/admin/layout/adminShell.js`, `src/admin/preview/previewWorkspace.js` (all call by URL).
  - **Zero changes needed** in `scripts/db-d2-local-vercel-proof.mjs`, `scripts/db-d2-browser-proof.mjs`, `scripts/perf-local-vercel.mjs` (all call by real HTTP URL).
  - **One exception**: `scripts/db-preview-admin-api-test.mjs` directly `import()`s `api/admin/previews/index.js` and `api/admin/previews/[id].js` as modules and invokes their default-export function with hand-built fake `req`/`res` (not via HTTP) — this script's imports must be updated to point at wherever the preview dispatch logic ends up.

### Design

- `api/admin/[...path].js` — one thin Vercel function (`bodyParser:false`), parses `req.query.path` (array) into `[resource, ...rest]`, dispatches to one small per-resource handler.
- Per-resource dispatch logic moves into `server/admin-api-routes/` (new directory, e.g. `characters.mjs`, `skins.mjs`, `users.mjs`, `previews.mjs`, `assets.mjs`) — **outside `api/`, so it never counts toward the function cap**, and matches the architecture's own already-LOCKED "`api/` = thin HTTP adapter, `server/` = domain/routing logic" split. Each module keeps exactly the method-dispatch/param/auth/domain-delegation behavior audited above, just addressed by array segments instead of a dedicated file's `req.query.<name>`.
- `api/admin/session.js` and `api/internal/db-health.js` stay separate (session is called on every public page load per Phase 1 above and should stay minimal/fast; db-health is an ops-only endpoint). `api/auth/[...].js` stays untouched (Better Auth's own required convention).
- Resulting function count: `api/auth/[...].js` + `api/admin/session.js` + `api/internal/db-health.js` + `api/admin/[...path].js` = **4**, with headroom for Skill/Guide/Tier List/Buff and Character sub-features (Talent/Hoán Chương/Lore) to each become a new branch inside the same one function, indefinitely — no future domain ever adds a new serverless function again.

### Steps

1. Create `server/admin-api-routes/{characters,skins,users,previews,assets}.mjs`, porting each old file's logic verbatim (same domain-module imports, same auth calls, same error handling) — pure move, no behavior change, no new validation/logic invented.
2. Create `api/admin/[...path].js` as the dispatcher.
3. Delete the 10 old `api/admin/{users,characters,skins,previews,assets}/**` files.
4. Update `scripts/db-preview-admin-api-test.mjs`'s two imports to the new location (only touched caller).
5. Validate: `npm run build`; `npx vercel dev` or the equivalent local Vercel proof (`db:d2-local-vercel-proof`, `db:preview-admin-api-test`, `db:preview-admin-test`, `db:preview-admin-api-test`, `db:managed-asset-test`, `db:admin-auth-test`) — every existing proof script must still pass unmodified (except the one import fix); browser smoke on Admin login, Character/Skin workspace (D2.4.1 invariants: cache/no-refetch, 409 conflict, save/discard), Preview workspace, asset upload flow; confirm `api/` now has exactly 4 files; push and confirm the next Vercel Preview deployment succeeds (this is the actual proof the fix worked — a real build failure, not just local checks).
6. Commit as its own batch, separate from any UI-roadmap phase.

## Combined execution order (Plan A + the Admin/Public UI roadmap above)

Owner asked whether these two plans need interleaving. They mostly don't — worth stating plainly instead of forcing artificial cross-stepping:

1. **Plan A first.** It's fully self-contained (touches only `api/`+`server/admin-api-routes/`+one test script), preserves every external URL so it cannot block or be blocked by anything in the UI roadmap, and is the thing that actually fixes the broken Vercel deployments right now. No reason to delay it.
2. **Roadmap Phase 1** (session-awareness primitive) — independent of Plan A, can follow immediately.
3. **Roadmap Phase 2** (global sidebar) — depends on Phase 1, independent of Plan A.
4. **Roadmap Phase 3** (contextual inline edit MVP) — depends on Phase 1+2 for the UI entry point; doesn't strictly depend on Plan A since URLs don't change either way, but building it against the already-consolidated, cleaner `server/admin-api-routes/` is preferable to building against files about to be deleted.
5. **Roadmap Phase 4** (future domains: Skill/Guide/Tier List/Buff, plus Character sub-features Talent/Hoán Chương/Lore) — this is the one phase that **genuinely requires Plan A done first**, since these are exactly the new routes that would re-hit the 12-function wall without it.

So the practical order is simply **Plan A → Phase 1 → Phase 2 → Phase 3 → Phase 4**, not because Plan A is arbitrarily "first" but because nothing in the roadmap needs to happen before it and Phase 4 explicitly needs it done.

## Verification approach (once any phase moves to code)

- Reuse this session's established pattern: `npm run build`, browser smoke via the Vite dev server (`.claude/launch.json` already configured, `whmxcalc-dev`), fresh-tab console checks, `git diff --check`, `public/data.json` SHA unchanged, D1 auth regression (`db:admin-auth-test`) whenever session/auth code changes, D2 character-skin proofs (`db:character-skin-test`, `db:d2-character-skin-proof`) whenever Character mutation paths are touched by contextual editing.
- Phase 2's nav rework needs an explicit visual parity pass on the Admin login page and the Character/Skin workspace, since it changes shell structure, not just CSS values.
- Plan A's real verification is a green Vercel Preview build, not just local proofs — local `npm run build` passing has never been the failure signal here.
