# WHMX — CURRENT STATE FINAL (2026-09-22)

**Supersedes:** `WHMX_CURRENT_STATE_FINAL_2026-09-20.md` for day-to-day work. That file's still-valid background (source-of-truth model, R2/asset invariants, localization rules, ID conventions) is NOT repeated here — read it for that. This file only covers what changed or was decided since 2026-09-20.

**Companions to read first, in order:** this file → `WHMX_APP_ARCHITECTURE.md` → `WHMX_ENGINEERING_PRINCIPLES.md` → `WHMX_ARCHITECTURE_MIGRATION_PLAN.md` → the 2026-09-20 state/handoff docs for deep history. For **what to actually do next and in what order**, see [`WHMX_NEXT_STEPS.md`](./WHMX_NEXT_STEPS.md) — this file explains the *why*, that one tracks the *sequence/status*.

---

## 1. Git state (verified, not assumed)

```text
Branch: feat/postgres-admin-crud
Remote (origin) HEAD: 2e00309 — pushed, accepted
Local HEAD: 879721c — 1 commit ahead of origin, NOT pushed
Rollback tag: pre-app-architecture-migration-2026-09-20 -> 0bea367... (unchanged, never touch)
```

Full local commit chain (newest first) since the rollback checkpoint includes the entire structural migration wave (Q1–Q4), the SSR color fixes, and this session's docs work. `git log --oneline -20` from `WhmxCalc/` shows the exact chain if needed.

**Push policy:** only the push up to `2e00309` was ever authorized and executed. Everything after (`879721c` — docs commit) and everything still to come (Plan A, roadmap phases, public-data-delivery work) stays **local-only** until the owner explicitly says push.

## 2. What's DONE since 2026-09-20

- **Structural migration wave (Q1–Q4)**: Calculator/Weapons ownership moves, Admin Character/Skin workspace relocated to `src/admin/character-skin/`, bounded CSS ownership follow-up (`src/admin/styles/adminShell.css` extracted). Full record in `WHMX_ARCHITECTURE_MIGRATION_PLAN.md`'s "Accelerated Frontend Migration Wave completion" section. **Pushed and accepted.**
- **SSR rarity badge color fix** (two passes: `ac32f14` fixed an invalid corrupted hex value; `2e00309` brightened it further using WHMX's own established red tokens, not S1N's gold). **Pushed.**
- **`docs/WHMX_ENGINEERING_PRINCIPLES.md`** — new doc, code-level design principles (distinct from `WHMX_APP_ARCHITECTURE.md`'s file/folder scope): isolate volatile decisions behind narrow interfaces, prefer portable libraries over vendor SDKs, avoid god-components, decouple "how many domains exist" from "how expensive it is to add one" — plus an explicit "when NOT to add flexibility" section. Linked from `WHMX_APP_ARCHITECTURE.md`. Local commit `879721c`, not pushed.
- **Docs cleanup**: deleted 3 files from `WhmxCalc/docs/` confirmed byte-identical to canonical copies already living in the parent `D:\BaiTapCode\WHMX\` folder (`WHMX_CURRENT_STATE_2026-09-19_v3.md`, `WHMX_NEON_SETUP_PROMPT_2026-09-19.md`, `WHMX_POSTGRES_CRUD_REFACTOR_PLAN_2026-09-19_v3.md`). Kept `WHMX_MASTERDATA_ID_CONVENTIONS(5).md` — checked, it is NOT a stale duplicate, appears newer than the parent-folder copy. **Note:** the parent `D:\BaiTapCode\WHMX\` folder (shared with the separate `NeoArtifacts` repo) still has its own internal versioned duplicates (`WHMX_CURRENT_STATE_2026-09-19.md`, `_v2`, `_v3`, `WHMX_CURRENT_STATE_2026-09-18_FINAL.md`, `WHMX_CURRENT_STATE_FINAL_2026-09-19.md`, `WHMX_POSTGRES_CRUD_REFACTOR_PLAN_2026-09-19_v2.md`/`_v3`) — **not touched**, out of scope for this repo-scoped cleanup, owner has not asked for that yet.
- **`huashu-design` Claude skill installed globally** at `~/.claude/skills/huashu-design`, copied from the already-vendored `WhmxCalc/.agents/skills/huashu-design/` (not re-cloned from GitHub, avoids version drift). Install script: `scripts/install-huashu-design-skill.sh`.

## 3. Live production issue found and diagnosed — NOT yet fixed

**Vercel Preview deployments have been failing** (`Build Failed: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`) since before this session started, unrelated to any code content (docs-only commits fail identically). Root cause confirmed: `api/` has **exactly 13 route files** (still true as of this doc — `find api -name "*.js" | wc -l` = 13), 1 over Vercel Hobby's cap.

**Fix designed but not yet executed — "Plan A" in the session's plan file** (`C:\Users\Legion\.claude\plans\you-are-working-in-fluffy-micali.md`, also should be read for full phase detail):

- Move the 10 `api/admin/{users,characters,skins,previews,assets}/**` files' logic into `server/admin-api-routes/*.mjs` (outside `api/`, doesn't count toward the cap).
- Replace them with one thin dispatcher `api/admin/[...path].js` (Vercel catch-all — preserves every existing external URL exactly, so `characterSkinAdminWorkspace.js`, `adminShell.js`, `previewWorkspace.js`, and 3 of 4 proof scripts need **zero changes**; only `scripts/db-preview-admin-api-test.mjs`'s two direct module imports need updating).
- Result: `api/auth/[...].js` + `api/admin/session.js` + `api/internal/db-health.js` + `api/admin/[...path].js` = **4 functions**, permanent headroom for Skill/Guide/Tier List/Buff and Character sub-features (Talent/Hoán Chương/Lore) — no future domain ever re-hits this wall.
- Full grounding facts (shared `server/admin-api.mjs` helper already used by every route, param-naming quirks, the `previews/[id].js` branching logic that must be preserved exactly, etc.) are in the plan file — don't re-audit, it's already done.

**This should be the next coding task** when work resumes, before anything else in the roadmap below, since it's self-contained, fixes a real broken production pipeline, and doesn't block on or get blocked by anything else.

## 4. Decided this session, not yet built

### 4.1 Neon vs Supabase — decided: **stay on Neon**

Deep evaluation happened (see conversation record if the reasoning ever needs re-justifying to the owner). Conclusion: `db/client.mjs` already uses the vendor-neutral `postgres` npm package + `drizzle-orm/postgres-js` (not Neon's proprietary driver) — switching the Postgres *host* alone is already cheap (just an env var + data dump) whenever wanted, no urgency. Supabase's real advantage (PostgREST direct-call, "unlimited API requests") only materializes if WHMX *also* adopts Supabase Auth + Row-Level-Security instead of the current Better Auth + custom `server/` authorization — that is a full rewrite of the already-CLOSED D1 (auth) and D2.4.1 (Character/Skin CRUD) milestones, and is not justified by current or realistically-projected traffic. Neon's branching (already relied on for dev/prod separation), autoscale-on-free, and same-provider upgrade path (Launch plan, usage-based, no re-platforming) fit WHMX's trajectory better. **Do not revisit this without a genuinely new reason** (e.g. deliberately wanting to drop custom API maintenance in favor of RLS — a product decision, not a cost decision).

Real Neon usage data point from this session: 2.41 CU-hrs consumed over 3 days of *heavy dev/test activity only* (public site still 100% static, zero real-user DB traffic) — comfortably inside the 100 CU-hr/month free budget even extrapolated.

### 4.2 Public data delivery — Hướng A vs Hướng B — leaning B, not decided/built

This is WHMX's long-documented OPEN DECISION (`WHMX_CURRENT_STATE_FINAL_2026-09-20.md` §13), explored in real depth this session:

- **Hướng A** — public pages read live from Postgres on every request (S1N.gg's pattern, verified via their live network traffic: direct Supabase/PostgREST calls). Pro: instant updates after Admin save. Con: only covers domains already in Postgres (Character/Skin) — Skill/Buff/Talent/Lore etc. are still static-pipeline-only, so A can't make *those* "update instantly" without first migrating them into Postgres CRUD (separate, larger, unplanned work). Also needs the joining/shaping logic (`tools/build_web_data.py` currently does this) re-implemented for live queries — real risk of the static-build logic and live-query logic drifting apart if not shared.
- **Hướng B** — keep the static `public/data.json` model, but build a pipeline that automatically republishes it whenever Admin saves (Great Limbus Library's pattern, verified via their live network traffic: zero runtime API calls, data baked into the JS bundle at build time — and GLL handles genuinely large traffic, 3.9M pageviews/month per their own public analytics, entirely on this static model). Pro: uniformly covers every domain including ones not yet in Postgres; reuses the already-correct joining logic instead of duplicating it; keeps the public site resilient to DB downtime (matches a free-tier, no-on-call hobby project well). Con: needs a real publish pipeline (atomic swap, no half-published state) — more upfront engineering than A.
- **Key design note if B gets built**: write the data-shaping logic as small per-entity functions (`resolveCharacterPublicView(id)`, etc. — see `WHMX_ENGINEERING_PRINCIPLES.md` §2 worked example 1), not one monolithic script. Done this way, B does not foreclose A later — exposing a live-read API afterward becomes an additive change (new thin route calling the same resolver), not a rewrite. If the resolvers end up implemented as a Python subprocess call instead of ported to JS, that specific implementation choice would NOT transfer to a future live-read path (Python subprocess-per-request doesn't work for a live API) — port the core shaping logic to JS/Node from the start if a smooth B→A path matters.
- **Compute-cost mental model established this session** (relevant if A is ever built, or if evaluating Hướng A's public-traffic cost): Neon's CU-hours meter *wall-clock awake time*, not per-query or per-visitor count. A compute instance stays awake through an idle-timeout window (default ~5 min) after the last query, so rapid navigation within one active browsing session is nearly free (one wake-window, not one per pageview), while sparse, spread-out visits (or an owner's own habit of poking the admin panel every 5–10 minutes) each cost close to a full wake+idle-tail cycle. Browser-perceived lag/latency does NOT count toward Neon's meter — only the DB compute's own active time does. Hover/tooltip/tab-switch interactions within an already-loaded page cost nothing (verified in code: `talentsView.js`'s popup hover handler has no `fetch()` call at all, reads already-in-memory data).

**Recommendation on record**: build a narrow Hướng-A-style live read only for the fields *already* in Postgres Admin CRUD (Character/Skin, matching Phase 3 of the roadmap below) as a fast MVP; design Hướng B properly (JS resolvers, atomic publish) as the general long-term solution once there's time. Not yet started either way.

### 4.3 Admin/Public UI integration roadmap — designed, Phase 0 done, rest not started

Full detail lives in the plan file (`C:\Users\Legion\.claude\plans\you-are-working-in-fluffy-micali.md`). Summary:

- **Phase 0** (SSR color) — ✅ done, pushed.
- **Phase 1** — session-awareness primitive: a shared module wrapping `fetch('/api/admin/session')`, called once at boot, so public-page code (not just `adminShell.js`) can know "is this visitor an authorized editor." Not started.
- **Phase 2** — make the global icon rail (`.app-nav`) truly global including Admin routes (currently `body.admin-route-active > .app-nav { display:none }` hides it); add one session-aware entry pinned at the bottom (shortcut to existing `#/admin` login, not a general-audience login — WHMX's login is owner+editors only, confirmed explicitly). Not started.
- **Phase 3** — contextual inline "Edit" affordances on public Character/Skin pages for authorized editors, reusing the existing Admin mutation API and D2.4.1's revision/409-conflict handling. Explicit guardrail: build as a small focused component, do not copy-paste logic out of the already-large `characterSkinAdminWorkspace.js`. Not started.
- **Phase 4** — extend the same pattern to future domains (Skill/Guide/Tier List/Buff) as each gets built. Not started; depends on those domains existing in Postgres first.
- **Combined execution order** (Plan A + roadmap): Plan A (API consolidation) first — self-contained, fixes the live Vercel break, blocks nothing — then Phase 1 → 2 → 3 → 4. Phase 4 specifically requires Plan A done first (new domains would re-hit the function cap otherwise); nothing else has a hard ordering dependency.

Reference material behind these decisions: `docs/WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md` (owner-provided, ChatGPT-authored analysis of S1N.gg/GLLimbus admin patterns) plus this session's own live verification of both sites (network traffic, actual page structure) — several of the analysis doc's claims were checked against the real sites rather than trusted blindly, and one correction was needed (S1N's SSR-equivalent rarity color is gold, not WHMX's red — do not copy their color, only their layout *pattern*, e.g. login/admin entry pinned at the bottom of the nav rail).

## 5. Explicitly still open / do not decide unilaterally

- DB → public publication mechanism (Hướng A vs B, §4.2 above) — leaning B, not committed.
- Localization authority transfer (workbook → PostgreSQL) — untouched, still open per prior state docs.
- Whether to eventually reduce `characterSkinAdminWorkspace.js`'s god-component risk (flagged, not scheduled) — becomes more urgent once Phase 3 wants to reuse pieces of its logic.
- The "layered ticket asset" rarity-badge visual treatment (owner's own idea, alternative to a flat badge) — unscheduled, feasibility (stacking multiple asset layers, reusing across the roster grid) not spiked yet.

## 6. Fresh-session continuation checklist

1. Read this file, then `WHMX_APP_ARCHITECTURE.md`, `WHMX_ENGINEERING_PRINCIPLES.md`.
2. Read the plan file at `C:\Users\Legion\.claude\plans\you-are-working-in-fluffy-micali.md` for full Plan A + roadmap phase detail before writing any related code.
3. Confirm live git state with `git log --oneline -5` and `git ls-remote origin feat/postgres-admin-crud` — do not trust this document's SHAs blindly if significant time has passed.
4. Do not push anything beyond what's already on `origin` without explicit owner approval (unchanged standing rule).
5. Do not touch the parent `D:\BaiTapCode\WHMX\` folder's own doc duplication without being asked (shared with `NeoArtifacts`, out of this repo's scope).
6. The Vercel Preview build failure (§3) is real and current — if the owner reports deploys failing, this is almost certainly still the cause unless Plan A has since been executed.
