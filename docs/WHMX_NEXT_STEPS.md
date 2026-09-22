# WHMX — Next Steps (task order)

**Read first, in this order:**
1. [`WHMX_CURRENT_STATE_FINAL_2026-09-22.md`](./WHMX_CURRENT_STATE_FINAL_2026-09-22.md) — or whichever `WHMX_CURRENT_STATE_FINAL_*.md` is newest — full context on what's done, decided, and open.
2. [`WHMX_APP_ARCHITECTURE.md`](./WHMX_APP_ARCHITECTURE.md) — where code belongs.
3. [`WHMX_ENGINEERING_PRINCIPLES.md`](./WHMX_ENGINEERING_PRINCIPLES.md) — how to write it so it stays stable without being rigid.
4. [`WHMX_ARCHITECTURE_MIGRATION_PLAN.md`](./WHMX_ARCHITECTURE_MIGRATION_PLAN.md) — structural migration history (Q1–Q4 done, don't redo).
5. [`WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md`](./WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md) — reference-site research behind the Admin/UI roadmap below.
6. Session plan file (outside this repo): `C:\Users\Legion\.claude\plans\you-are-working-in-fluffy-micali.md` — full design detail for every item below. This file is the *order*; that file is the *how*.

This file only tracks **sequence and status**. When an item's status changes, update it here directly (this is a living doc, not a dated snapshot — don't create a new dated copy for a status change).

---

## Order

### 1. Plan A — consolidate `api/admin/*` into one serverless function
**Status: ✅ DONE, pushed (`bec6d7c` on `feat/postgres-admin-crud`).**
`api/` reduced from 13 functions to 4 (`admin/[...]`, `admin/session`, `auth/[...]`, `internal/db-health`) — confirmed both locally and via `vercel inspect` on the resulting Preview build, which is now `● Ready`. One deviation from the original design: a bare `[...path].js` file does not act as a true multi-segment catch-all on Vercel's plain (non-Next.js) routing — an explicit `vercel.json` rewrite was required (added, mirroring the existing `api/auth/[...].js` pattern).

### 2. Roadmap Phase 1 — session-awareness primitive
**Status: ✅ DONE.**
`src/app/auth/session.js` wraps `fetch('/api/admin/session')`, exports `initSession()` (called once at boot in `src/app/bootstrap/boot.js`, fire-and-forget), `getSession()` (returns the cached promise, lazily initializing if needed), `refreshSession()` (force re-check, unused so far, available for Phase 3), and `isAuthorizedEditor(session)` helper. Cache is boot-lifetime only, UX convenience — the HttpOnly cookie stays the real authorization boundary, matches the already-LOCKED principle. Verified: builds clean, fetch fires once at boot, memoized across repeat calls, no console errors.

### 3. Roadmap Phase 2 — global sidebar includes Admin
**Status: ✅ DONE.**
`.app-nav` no longer force-hidden on Admin routes (`src/admin/styles/adminShell.css`) — only `.top-nav`/`#app`/`#drawer-backdrop`/calc-picker/feedback-button stay hidden, so Admin still owns its own content area, just beside the rail instead of covering the whole viewport. Added a pinned `.app-nav-footer` entry (`index.html`, `#app-nav-admin-link` → `#/admin`) below the domain links, hidden by default and shown only once `initAppNav()` (`src/app/layout/appNav.js`) resolves the Phase-1 session check as an authorized owner/editor — matches the confirmed "no anonymous-visitor login UI" rule, this is a shortcut for people already logged in, not a general "Login" invite. Fixed a real-bug side effect discovered along the way: the nav rail's actual rendered width is a hardcoded `60px` (a later "Compact Overlay Rail" cascade layer in `src/style.css` overrides the older `--app-nav-width` token with `!important`), not the token value — matched `.admin-auth-page`'s new margin-left and the `.admin-character-workspace-active .admin-shell` width formula (3 call sites) to that same real `60px` so nothing overflows horizontally on desktop; mobile (`.app-nav` already `display:none` there) is unaffected. Verified: build clean, desktop layout shifts correctly with no horizontal overflow, mobile unchanged, nav links usable while on `#/admin`, admin link correctly hidden pre-login.

### 4. Roadmap Phase 3 — contextual inline edit MVP (Character)
**Status: designed, not started. Depends on Phase 1+2. Do this next.**
Small "Edit" affordances on the public Character page for authorized editors, reusing the existing Admin mutation API. Guardrail: build as its own small component, do not copy logic out of `characterSkinAdminWorkspace.js`.

### 5. Checkpoint — evaluate Hướng A/B before going further
**Status: not started, deliberately not scheduled as a build task yet.**
After Phase 3 ships, live with it. Contextual edit writes to DB correctly, but the public page won't reflect it until the next rebuild/deploy (current behavior, unchanged by Phase 3 alone). Decide *then*, with real usage, whether that gap is worth building a narrow live-read API for (Hướng A, scoped only to fields already in Postgres) — don't build it speculatively now. Full Hướng A vs B analysis (including the resolver-function design note so Hướng B doesn't foreclose Hướng A later) is in the current-state doc §4.2.

### 6. Roadmap Phase 4 — extend to future domains (Skill/Guide/Tier List/Buff)
**Status: designed, not started. Requires #1 (Plan A) done first** — new domains would re-hit the function cap otherwise. Also requires each domain's data model to exist in Postgres first (none do yet).

---

## Explicitly not sequenced here (separate, larger initiatives — do not fold into the above)

- DB → public publication architecture as a general system (beyond the narrow Hướng-A checkpoint in #5).
- Localization authority transfer (workbook → PostgreSQL).
- Reducing `characterSkinAdminWorkspace.js`'s god-component risk — not urgent until something (likely Phase 3) needs to reuse its logic.
- "Layered ticket asset" rarity-badge visual treatment — unscheduled design idea, feasibility not spiked.
