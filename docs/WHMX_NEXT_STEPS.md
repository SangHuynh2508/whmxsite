# WHMX — Next Steps (task order)

**Read first, in this order:**
1. [`WHMX_CURRENT_STATE_FINAL_2026-09-22.md`](./WHMX_CURRENT_STATE_FINAL_2026-09-22.md) — or whichever `WHMX_CURRENT_STATE_FINAL_*.md` is newest — full context on what's done, decided, and open.
2. [`WHMX_APP_ARCHITECTURE.md`](./WHMX_APP_ARCHITECTURE.md) — where code belongs.
3. [`WHMX_ENGINEERING_PRINCIPLES.md`](./WHMX_ENGINEERING_PRINCIPLES.md) — how to write it so it stays stable without being rigid.
4. [`WHMX_ARCHITECTURE_MIGRATION_PLAN.md`](./WHMX_ARCHITECTURE_MIGRATION_PLAN.md) — structural migration history (Q1–Q4 done, don't redo).
5. [`WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md`](./WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md) — reference-site research behind the Admin/UI roadmap below.
6. Session plan file (outside this repo): `C:\Users\Legion\.claude\plans\you-are-working-in-fluffy-micali.md` — full design detail for every item below. This file is the *order*; that file is the *how*.
7. Admin UI redesign plan (outside this repo, separate from #6): `C:\Users\Legion\.claude\plans\m-u-c-c-dropdown-v-n-sprightly-fox.md` — Phase 1 (bug fixes) done; Phase 2 (direction exploration) was attempted and **all 3 directions rejected** — read this file's Phase 2 section before attempting again, it records exactly why and what the corrected brief is (full open dashboard layout, not a boxed card, on both Preview/Users and Character/Skin CMS routes).

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
`.app-nav` no longer force-hidden on Admin routes (`src/admin/styles/adminShell.css`) — only `.top-nav`/`#app`/`#drawer-backdrop`/calc-picker/feedback-button stay hidden, so Admin still owns its own content area, just beside the rail instead of covering the whole viewport. Added a pinned `.app-nav-footer` entry (`index.html`, `#app-nav-admin-link` → `#/admin`) below the domain links. Fixed a real-bug side effect discovered along the way: the nav rail's actual rendered width is a hardcoded `60px` (a later "Compact Overlay Rail" cascade layer in `src/style.css` overrides the older `--app-nav-width` token with `!important`), not the token value — matched `.admin-auth-page`'s new margin-left and the `.admin-character-workspace-active .admin-shell` width formula (3 call sites) to that same real `60px` so nothing overflows horizontally on desktop; mobile (`.app-nav` already `display:none` there) is unaffected.

**Revised after owner feedback (2026-09-22, same day):** the nav entry is now **always visible** to every visitor (not hidden-until-authorized as first built) — icon swaps between a plain `LogIn` glyph (logged out) and `ShieldCheck` (logged in), label swaps "Đăng nhập" ↔ "Quản trị", both driven by `src/app/layout/appNav.js`'s `syncAdminNavEntry()` reading the Phase-1 session check. Owner's reasoning: they want a discoverable login entry point, not one that only reveals itself to people already authenticated (the original "no anonymous-visitor login UI" principle was about not offering *signup*, not about hiding the *login shortcut itself* — don't re-hide this on a future pass). Verified: build clean, desktop layout shifts correctly with no horizontal overflow, mobile unchanged, nav links usable while on `#/admin`.

### 4. Roadmap Phase 3 — contextual inline edit MVP (Character) — ✅ DONE (Overview tab, 3 of 4 fields)
New standalone module `src/features/characters/components/characterInlineEdit.js` (+ `src/features/characters/styles/characterInlineEdit.css`). **Revised UX after owner feedback on v1** (per-field pencils were "too small, hard to see, wrong position") — now a single visible "✏️ Sửa" pill button sits right beside the "HỒ SƠ KHÍ GIẢ" section heading on the public Character Overview tab. Clicking it turns every field that supports editing (`name_vi`/`fullname_vi`/`nickname_vi`, tagged `data-field="..."` in `src/features/characters/views/detail/overviewView.js`) into an input at once — fields without a `data-field` hook (not in the server allowlist) are left exactly as rendered, untouched. One "Lưu thay đổi"/"Hủy" pair (not one per field) sends every changed field in a single PATCH. Hidden entirely for anonymous visitors (checks the Phase-1 `isAuthorizedEditor(await getSession())` before mounting anything — zero admin-API calls for non-editors, confirmed via network log). On open, lazily `GET /api/admin/characters/:id` once per character to learn the current `revision` (public `/data.json` has none), then `PATCH` the same endpoint with `{ expectedRevision, changes: { <camelCase field>: ... }, requestId }` — the exact contract `characterSkinAdminWorkspace.js` already uses, mirrored independently (no import from that file, per its god-component guardrail). On success, mutates the in-memory `char` object and does a full `renderOverviewTab` re-render rather than patching DOM by hand, so every derived display (e.g. the art-caption title) stays consistent, then re-mounts a fresh toggle. 409/403/422 map to the same Vietnamese messages the admin workspace uses.

**Scoped down from the full 4-field allowlist:** `tags_vi` is only shown in the page header (`characterDetail.js`, rendered once per character, not per-tab), not the Overview tab body — deferred rather than wired in this pass, to keep the MVP to one integration point. Also out of scope for this MVP: adding a value to a field that's currently empty (the pencil only attaches where a field already renders a value) — clearing a field to empty removes its row with no way to re-add it from the public page (Admin CMS still can). Both are reasonable small follow-ups once this base is validated, matching the roadmap's own "small batches" philosophy.

**Verified:** build clean; anonymous visitor gets 0 pencils and 0 `/api/admin/characters/*` requests (checked via network log); no console errors. **Not verified:** the actual authorized edit/save/409-conflict flow — needs a real owner/editor login to exercise end-to-end (no test credentials available to this agent); please try it and report back if anything's off.

### 5. Checkpoint — Hướng A/B — ✅ DECIDED (2026-09-22): Hướng B, kept A-compatible; publish pipeline not built yet
Owner confirmed: build Hướng B (static `public/data.json` model + an automated republish pipeline on Admin save), not Hướng A (no live public reads from Postgres) — full decision + the required "don't foreclose A" constraints (JS/Node per-entity resolvers, not a monolithic or Python-only script; atomic publish swap) recorded in `WHMX_APP_ARCHITECTURE.md` §11 (canonical) and `WHMX_CURRENT_STATE_FINAL_2026-09-22.md` §4.2 (history). **What's still open is only the build itself** — no publish pipeline exists yet, so Postgres-only edits (Admin CRUD, Phase 3's contextual inline edit) still don't reach the public site. Building that pipeline is real, unscheduled work — decide when to schedule it separately, informed by real usage of Phase 3 first.

### 6. Roadmap Phase 4 — extend to future domains (Skill/Guide/Tier List/Buff)
**Status: designed, not started. Requires #1 (Plan A) done first** — new domains would re-hit the function cap otherwise. Also requires each domain's data model to exist in Postgres first (none do yet).

### 7. Admin UI redesign — Phase 1 ✅ done, Phase 2 ❌ rejected 3x, corrected brief now known
**Status: in progress, blocked on a redo of Phase 2.** Full detail: `C:\Users\Legion\.claude\plans\m-u-c-c-dropdown-v-n-sprightly-fox.md`.
- Phase 1 (isolated bug fixes — `color-scheme` for the `<select>` popup contrast bug, corrupted dark-token reconstruction) shipped.
- Phase 2 (3 direction options) was built and **all 3 rejected** — they only varied details *inside* the existing narrow `.admin-shell` card, which was the wrong axis. **Corrected brief, in the owner's own words:** *"muốn là 1 trang quản trị/admin chuẩn, layout to, không bị đóng hộp, bố cục rõ ràng ở cả 2 route preview và character"* — a proper open admin-dashboard layout (big, not boxed), on **both** Preview/Users **and** Character/Skin CMS routes. This overrides the plan's earlier "don't touch `.admin-shell` width" and "Character/Skin CMS = polish only" positions — see the plan file's Phase 2 section for the full correction and a reusable design-review technique (temp test account + real browser login + self-contained static HTML snapshots, since screenshots alone weren't reliable this session).
- Cleanup done — temp test account and seeded preview rows deleted at session end.

### 8. Queued — Character Lore into Postgres + artifact ("hiện vật") archive images
**Status: noted only, not started, not designed in detail yet.** Owner asked to look into this next, but explicitly said: only after the Admin UI redesign (item #7 above) is done — do not start until then.

- Source of the lore text: the `profile` field already read from `localization_master.xlsx` (same source as the other character profile fields already flowing through `tools/build_web_data.py` into `public/data.json`'s `char.profile.*`).
- Source of the images: `D:\BaiTapCode\WHMX\NeoArtifacts\Assets\characters\<CHAR_ID>\archive\` — each character has an `archive/` folder (verified: `A0001/archive/` contains `a0001.png`, `head_a0001.png`) alongside the existing `avatar/card/drawing/skill_icon/skin_activity` folders already used elsewhere in the pipeline. These are the "hiện vật" (anthropomorphized-artifact) reference images, not yet wired into any part of the site.
- **Hướng A/B is now decided (item #5): Hướng B.** That doesn't unblock Lore by itself, though — the publish pipeline B requires isn't built yet, so a Lore Admin-editing surface built today would still hit the same "edit lands in Postgres, nobody sees it live" gap until that pipeline exists (confirmed via code audit this session: `tools/build_web_data.py` has zero Postgres awareness; no publish/export script bridges Postgres → `public/data.json` today — design-only in `docs/POSTGRES_CRUD_ARCHITECTURE_PROPOSAL_2026-09-19.md` §M). Whoever picks up Lore should check whether the publish pipeline has shipped by then; if not, either build Lore's own resolver per the locked JS/Node-resolver pattern (`WHMX_ENGINEERING_PRINCIPLES.md` §2 worked example 1) as part of this work, or sequence Lore after the publish pipeline lands.
- **Reuse, don't reinvent, the existing managed-asset system** for the archive images: `db/schema/character-skin.mjs` already has `assetObjects`, `assetRole` (currently `drawing`/`card`/`avatar`), `assetProvider` (`r2`/`public`), `assetProvenance`, `assetStorageTier`, `assetVerificationState` enums, and a `skinAssetMappings` join table — the pattern for a new `characterAssetMappings` table + a new `assetRole` value (e.g. `artifact_archive`) already exists to extend, matching `server/assets/` (R2-backed) rather than a new upload/storage mechanism.
- No further design done — schema shape, whether lore needs its own table vs. extending `characters`, and the R2 upload/migration path for existing archive images are all open until this item is actually picked up.

---

## Explicitly not sequenced here (separate, larger initiatives — do not fold into the above)

- DB → public publication architecture as a general system (beyond the narrow Hướng-A checkpoint in #5).
- Localization authority transfer (workbook → PostgreSQL).
- Reducing `characterSkinAdminWorkspace.js`'s god-component risk — not urgent until something (likely Phase 3) needs to reuse its logic.
- "Layered ticket asset" rarity-badge visual treatment — unscheduled design idea, feasibility not spiked.
