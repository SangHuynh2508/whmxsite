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
**Status: designed, not started. Do this first.**
Not because nothing else can start before it, but because it fixes an **active production bug** — Vercel Preview deployments are failing right now (13 functions, Hobby cap is 12) — which outranks any new feature. Self-contained (`api/` + new `server/admin-api-routes/` + one test script import), doesn't block or get blocked by anything else below. Full design in the plan file.

### 2. Roadmap Phase 1 — session-awareness primitive
**Status: designed, not started.**
Shared module so public-page code can ask "is this visitor an authorized editor," reusing existing `/api/admin/session`. Foundation for Phase 2 and 3.

### 3. Roadmap Phase 2 — global sidebar includes Admin
**Status: designed, not started. Depends on Phase 1.**
Stop hiding `.app-nav` on Admin routes; add one session-aware entry pinned at the bottom (shortcut to existing login, not a general-audience feature — WHMX login is owner+editors only).

### 4. Roadmap Phase 3 — contextual inline edit MVP (Character)
**Status: designed, not started. Depends on Phase 1+2.**
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
