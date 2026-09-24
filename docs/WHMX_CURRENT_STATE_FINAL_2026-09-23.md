# WHMX — CURRENT STATE FINAL (2026-09-23)

**Supersedes:** `WHMX_CURRENT_STATE_FINAL_2026-09-22.md` for day-to-day work. That file's still-valid background (source-of-truth model, R2/asset invariants, localization rules, ID conventions, git divergence history) is **not repeated here** — read it for that. This file covers only what happened in the 2026-09-23 session: the Admin UI redesign moved from static mockups into a real, partially-live React rewrite of the Admin shell, plus a framework pivot the owner directed mid-session.

**Read order:** `WHMX_NEXT_STEPS.md` → this file → `WHMX_APP_ARCHITECTURE.md` → `WHMX_ENGINEERING_PRINCIPLES.md` → the plan file at `docs/plans/WHMX_ADMIN_REDESIGN_HISTORY_PLAN_2026-09-22.md` (Phase-by-phase detail lives there, this file is the summary + gotchas).

---

## 1. The big picture: what actually changed this session

Session started continuing the Admin UI redesign (Direction 2 chosen by owner from 3 mockups sent 2026-09-22). Partway through, **the owner asked to pivot new Admin work from vanilla-JS to React + Tailwind v4 + shadcn**, after finding a component they liked on [reactbits.dev](https://reactbits.dev). This was **not** originally in the redesign plan — it's a real, owner-directed scope change, executed carefully to avoid a big-bang rewrite (see §3).

Net result: **Admin's shell (login/header/nav) is now React**, mounted through the exact same pattern the Vue Character/Skin CMS island already used (a container ref + mount function) — nothing about the Vue island or the vanilla-JS content modules (`previewWorkspace.js`, the new `usersPanel.js`) was rewritten, only *what wraps them* changed.

## 2. Git / branch state

**Unchanged from 2026-09-22 §7.4 — still not resolved, still not touched this session.** `main` (`e140ade`) and `feat/postgres-admin-crud` (last known `f0cf163`, now further ahead with this session's commits — **nothing has been committed this session**, all changes are uncommitted working-tree state) remain diverged. **Do not merge/push without the owner explicitly asking.** Run `git log --oneline -5` on both branches to get current SHAs before assuming anything.

**Nothing from this session has been committed.** `git status` in `WhmxCalc/` will show a large diff — see §7 for the exact file list.

## 3. React/Tailwind/shadcn adoption — what was decided and why

**Decision (owner-confirmed, 2026-09-23):** new Admin UI work uses React + Tailwind v4 + shadcn going forward. The existing Vue 3 Character/Skin CMS island (`characterSkinAdminWorkspace.js`) **stays Vue, untouched** — migrating it is a separate, larger, *not-yet-scheduled* decision (it has real invariants: optimistic revision lock, save/discard, 409 conflict handling — the "D2.4.1" behavior referenced throughout older docs). **Do not casually rewrite it** — this is also a `WHMX_ARCHITECTURE_MIGRATION_PLAN.md` / `WHMX_ENGINEERING_PRINCIPLES.md` locked principle ("no big-bang rewrite"), independently confirmed correct this session when the owner asked "can we do this while waiting for an npm install" and was told no, for exactly this reason.

**Folder naming lesson (owner caught this, worth remembering):** the new React code initially went into `src/admin/react/` — **wrong**, named after the *technology* not the *responsibility*. `WHMX_APP_ARCHITECTURE.md` mandates `src/admin/<area>/` named by area (`layout/`, `auth/`, `accounts/`, `preview/`, `audit/`), not by framework. Renamed to `src/admin/layout/` (the same folder name the old `adminShell.js` used to own — makes sense, since the new code took over that exact responsibility). **If you're tempted to name a new folder after React/Vue/whatever framework, don't — name it after what it does.**

**Why TypeScript (`.tsx`) and not plain `.js`:** `WHMX_APP_ARCHITECTURE.md` §9 already says new substantial modules prefer TypeScript (it only mentions Vue as the example because React didn't exist in the project yet when that line was written). Also: shadcn CLI generates `.tsx` by default (`components.json` has `"tsx": true`) — mixing JS/TS in the same subtree would be inconsistent.

### 3.1 What was actually scaffolded (first-time additions to this project)

- **First-ever `vite.config.mts`** — project ran on zero Vite config before. Adds `@vitejs/plugin-react` + `@tailwindcss/vite` only. Path alias `@` → `src/admin/layout`.
- **First-ever `tsconfig.json`** — scoped to `include: ["src/admin/layout"]` only, doesn't type-check the rest of the (still-JS) codebase.
- **First-ever `components.json`** (shadcn config) — `style: "new-york"`, `tsx: true`, `cssVariables: true`, CSS file at `src/admin/layout/styles/globals.css`. Has a `registries.@react-bits` entry pointing at `https://reactbits.dev/r/{name}.json` — this is what makes `npx shadcn@latest add @react-bits/<ComponentName>` work.
- **New deps in `package.json`:** `react`, `react-dom`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`, `clsx`, `tailwind-merge`, `lucide-react`, `class-variance-authority`, `tw-animate-css`, `ogl` (WebGL, pulled in by MoltenMetal — see §5). **`vercel` was removed as a side effect** (see §6.1) and re-adding it was still in progress / possibly stuck when the session ended — check before assuming `vercel dev` works locally.
- **shadcn theme mapping (`src/admin/layout/styles/globals.css`):** every shadcn CSS variable (`--background`, `--primary`, etc.) is a straight `var(--whmx-token)` reference to the *existing* `tokens.css` values (dark-charcoal/antique-gold), **not new colors** — this was deliberate, per the architecture doc's locked visual-identity rule. One naming collision handled carefully: shadcn's own `--accent` (a generic "subtle highlight" role) is a *different concept* from WHMX's `--accent` (the brand gold token used site-wide) — reusing the bare name would have shadowed the real one everywhere this CSS file loads (its selectors aren't scoped to `:root`, they're scoped to `.admin-react-root`... wait, actually check the current class name is `.admin-react-root` in the CSS file even though the folder is now `layout/` — **this literal CSS selector string was not renamed when the folder was renamed, it's cosmetic/harmless (just a class name, doesn't need to match the folder) but worth knowing it's not a leftover bug**). The fix: shadcn's own "accent" role is kept under a renamed `--surface-accent`/`--surface-accent-foreground` internally and only exposed to Tailwind's utility-class generator under the `--color-accent*` namespace — the literal `--accent` custom property is never redefined by this file.

## 4. Admin UI redesign — phase-by-phase status

Full detail + line-by-line rationale is in the plan file (`docs/plans/WHMX_ADMIN_REDESIGN_HISTORY_PLAN_2026-09-22.md`), which has been kept up to date this session. Summary:

| Phase | Status | Notes |
|---|---|---|
| 1 — bug fixes | ✅ done (prior session) | |
| 2 — 3 directions → pick | ✅ done | Owner picked **Direction 2** (top-bar, full-width sectioned, no sidebar) from the 3 real HTML mockups sent 2026-09-22 |
| **3 — shell chrome** | ✅ done, **with the React deviation described in §3** | `adminShell.js` deleted, replaced by `src/admin/layout/AdminApp.tsx` + `mount.tsx`. Session/login/logout logic ported behavior-for-behavior (not rewritten). Users-table logic that used to be inlined in `adminShell.js` was extracted verbatim into new file `src/admin/users/usersPanel.js` (same code, just now its own module, mountable the same way `previewWorkspace.js` already is). **Login screen additionally got a visual pass** (see §5) — that part was NOT in the original Phase 3 scope, it was a separate owner request after seeing the live shell looked "cramped." |
| **4 — Preview/Users reskin** | ✅ done | CSS-only changes to `src/admin/styles/adminShell.css` — no JS touched in `previewWorkspace.js`/`usersPanel.js`. Preview list → responsive card grid; section dividers switched to `--border-gold-divider`; provision form → 4 columns (fits now that `.admin-shell`'s old 960px cap is gone). Exact diff is in the plan file's Phase 4 section. |
| 5 — Character/Skin CMS polish + CSS relocation | ❌ **not started** | (a) light polish so it flows with the new shell, (b) move `.character-cms-*` out of `src/style.css` into its own file. **Next task if continuing the redesign track.** Do **not** touch `characterSkinAdminWorkspace.js`'s JS — CSS/shell-consistency only, per the plan. |
| 6 — final cross-surface verify | ❌ not started | Depends on 5 |

### 4.1 Login page visual pass (owner request, outside the phase list above)

Owner reported the login screen looked bad (screenshot: box cramped, text fields thin). Fix, **scoped to the unauthenticated branch of `AdminApp.tsx` only** — admin/user authenticated views were explicitly told not to change:

- Card widened (`max-w-md`→`max-w-lg`), padding increased (8→10), inputs made taller (`py-2`→`py-3` + `text-base`).
- Added **`MoltenMetal`** (react-bits component, `@react-bits/MoltenMetal-TS-TW`) as an animated WebGL background — a "molten metal" liquid-light shader, tinted with WHMX's own existing tokens (`--bg-main`, `--accent`, and the existing `--rarity-sr-text` warm-gold token as the 3 gradient stops — **not new colors**, literal hex values only because the component's props require raw hex strings, can't take `var()`). Lives at `src/admin/layout/components/MoltenMetal.tsx`. Pulled in `ogl` (~50KB gzip) as a real dependency.
- Replaced the plain submit button with **`StarBorder`** (`@react-bits/StarBorder-TS-TW`) — a button with an animated rotating-gradient border. Lives at `src/admin/layout/components/StarBorder.tsx`. Needed two custom `@keyframes` (`star-movement-top`/`star-movement-bottom`) added to `globals.css` manually, since the component's own doc comment assumes Tailwind v3's `tailwind.config.js` `theme.extend` convention — this project is on Tailwind v4 (CSS-first config), so they were translated into v4's `@theme { --animate-* }` + plain `@keyframes` syntax instead.
- **Verified working**: `npm run build` clean, live browser check (dev server, real WebGL render, zero console errors, screenshot confirmed the gold liquid-light animation + wider card + thicker inputs all render correctly).

## 5. Tooling / environment gotchas discovered this session (read before repeating the same debugging)

These cost real time — worth 60 seconds to read before hitting the same wall:

1. **This "Code tab" desktop app is not the standalone `claude` CLI.** `claude mcp add ...` (as documented in most MCP servers' READMEs, e.g. Playwright's) **does not work here** — there's no `claude` binary on PATH in this session's Bash tool. The actual mechanism this app uses for local/stdio MCP servers is a **project-level `.mcp.json` file** (already created this session, has `playwright` and `shadcn` servers declared) — but **it's only read at session start, not hot-reloaded into a running session**. A fresh session is needed for those two MCP servers' tools to actually become callable. OAuth-based "connectors" (Context7, Neon, etc.) are a *separate* mechanism (`mcp-registry` tool family) that *does* hot-connect mid-session via the Connect-card UI.
2. **`npm install <X>` reconciles the whole tree against `package.json`, silently removing anything present in `node_modules` but not declared** — this is what deleted `vercel` mid-session (it had been installed ad-hoc via bare `npx vercel ...` at some earlier point, never added to `package.json`, so the first `npm install react react-dom` pruned it as "extraneous"). **If a previously-working `npx <tool>` suddenly says "not recognized," check whether a recent `npm install` pruned it** rather than assuming a fresh problem. Fix used: `npm install -D vercel` to make it a real, declared, won't-get-pruned-again devDependency — **this specific install was still slow/possibly stuck as of session end, status unconfirmed, see §6.1**.
3. **Never run two `npm install`/`npm uninstall` commands concurrently against the same project** — real risk of lockfile corruption. This session accidentally raced two once; got lucky (both completed cleanly, verified via `node -e "JSON.parse(...)"` on both `package.json` and `package-lock.json`), but don't repeat it. Wait for one to finish (check via background-task notification, or `Get-Process node` / `Get-Process npm` to see if anything's still alive) before starting another.
4. **A killed/backgrounded `npm install` can report a misleading exit status.** One install in this session was force-killed via `Stop-Process -Force` and the task-completion notification still said "exited with code 0" — don't trust that signal alone after a manual kill; verify the actual result (`grep` the package into `package.json`, check `node_modules/.bin/`).
5. **Vite dev-server dependency pre-bundling bug (real, reproducible):** if a package (e.g. `motion/react`) is only reachable via a *lazily-imported* component, Vite's initial dependency crawl misses it, does a second pre-bundle pass later with a *different* module hash than the first pass already in use → **two live copies of React in one page → "Invalid hook call" error**, even though `npm ls react` shows a perfectly deduped tree (this is a Vite-cache issue, not an npm issue). Fix: declare the lazy dependency in `vite.config`'s `optimizeDeps.include` so it's swept into the *first* pass. (This exact fix was added, then later removed again once the component that needed it — `BlurText` — was deleted per owner request; if a future lazy-loaded heavy dependency causes the same symptom, this is the fix.)
6. **The Browser pane's `computer` screenshot action can return a stale/cached frame** (confirmed again this session, not a one-off) — if a screenshot looks suspiciously unchanged after an action that should have visibly changed the page, don't trust it. Verify via `getBoundingClientRect()` / `getComputedStyle()` / DOM injection instead, or close and reopen the tab.
7. **`.mcp.json` and Vite/shadcn config changes are picked up fine intra-session for the *build* — only the *MCP tool availability* needs a session restart** (item 1 above). Don't confuse the two.
8. **Ponytail mode is active for this whole session** (`/ponytail:ponytail`, level `full`) — persists until the user says "stop ponytail" or the session ends. A fresh session starts with it **off** unless the user re-invokes it or it's configured to persist across sessions (unconfirmed — check `SessionStart` hook output at the top of a new session to see if it auto-activates).

### 5.1 Reusable technique: installing a react-bits component

```bash
npx shadcn@latest add @react-bits/<ComponentName>-TS-TW --yes
```
Requires `components.json` to have the `registries.@react-bits` entry (already set up, see §3.1). Naming convention is `<PascalCaseComponentName>-TS-TW` (TypeScript + Tailwind variant — there are also `-JS-CSS`, `-TS-CSS`, `-JS-TW` variants per react-bits' own "pick your stack" system, not used here). The CLI auto-installs whatever npm deps the component needs (e.g. `ogl` for MoltenMetal) — check `package.json` after to confirm. Browse the actual catalog at reactbits.dev (organized into **Text Animations / Animations / Components / Micro / Backgrounds** categories, 200+ items) since the shadcn MCP server isn't loaded this session (§5 item 1) — WebSearch + direct browser navigation to `reactbits.dev/<category>/<slug>` works fine as a substitute.

## 6. Open blockers / unfinished as of session end

### 6.1 Local `vercel dev` — status unknown, needs checking first

`vercel` was removed from the project (see §5 item 2) and a clean re-install (`npm install -D vercel`, run alone, no concurrent npm calls) was started in the **owner's own terminal** (not one this session could observe) and had been running 20+ minutes with no output beyond 2 deprecation warnings as of the last check — likely stalled (a clean run of the same command took ~10-11 min when this session ran it directly, with continuous output throughout). **First thing to check in a new session:** `grep '"vercel"' WhmxCalc/package.json` — if absent, the install never finished; either retry (`cd WhmxCalc && npm install -D vercel`, let it run, don't kill it early) or skip it (it's optional — only needed for testing `/api/*` routes against a live local session; the app builds and deploys fine without it, Vercel's real production doesn't need the CLI installed anywhere).

**Consequence of not having it:** the authenticated Admin path (session fetch succeeding → Preview/Users panels mounting real data → Vue Character/Skin CMS island mounting) has **only been verified via DOM-injection of representative markup against the real stylesheet**, not a true end-to-end live-login test. The unauthenticated path (login screen) **has** been fully verified live (build + browser + no console errors). If picking this back up, get `vercel dev` working first (`.claude/launch.json` already has a `whmxcalc-vercel-dev` config pointing at `npx vercel dev D:\BaiTapCode\WHMX\WhmxCalc --listen 3003 --yes` — use the `preview_start` tool with name `"whmxcalc-vercel-dev"`, not raw Bash, per this session's own tool conventions), then:
1. Provision a temp owner account (pattern documented in the plan file's Phase 2 "How this was actually executed" section — `provisioningAuth.api.signUpEmail` + direct DB role update, same as `scripts/db-preview-admin-api-test.mjs` already does).
2. Log in for real through the browser (HttpOnly cookies can't be injected).
3. Verify: Users table renders/submits, Preview list/detail/lifecycle/asset-upload still work, Character CMS Vue island still mounts and behaves per its D2.4.1 invariants (cache, save/discard, 409 conflict).
4. **Clean up the temp account afterward** — deletion needs a specific FK-chain order (`character_publication_states` → `edit_history` → `preview_characters` → `managed_entities` → `users`), documented in detail in the plan file's Attempt-4 section. Don't hard-delete naively, it'll fail partway and potentially leave orphans.

### 6.2 Phase 5 (Character/Skin CMS) — not started

Next real chunk of the redesign track. See the plan file's Phase 5 section for the exact scope (CSS relocation + light polish, explicitly **not** a fix for `characterSkinAdminWorkspace.js`'s god-component structural debt).

### 6.3 Full Vue→React migration — explicitly NOT decided, NOT scheduled

Owner asked about this mid-session; answer given (and it holds): the Vue Character/Skin CMS island is production-critical, has real data-integrity invariants, and the project's own architecture docs lock against big-bang rewrites. If the owner wants to pursue this, it should be its own separately-scoped decision with its own verification plan — **do not fold it into finishing the Direction 2 redesign**, and do not start it "opportunistically" while something else is blocked/loading.

## 7. Files touched/added this session (uncommitted)

Run `git status --short` in `WhmxCalc/` for the authoritative list. Highlights:
- **Deleted:** `src/admin/layout/adminShell.js` (replaced by the React shell)
- **New:** `src/admin/layout/{AdminApp.tsx, mount.tsx, lib/utils.ts, styles/globals.css, components/{MoltenMetal,StarBorder}.tsx}`, `src/admin/users/usersPanel.js`
- **Modified:** `src/admin/styles/adminShell.css` (Phase 4 CSS), `src/app/bootstrap/boot.js` (import path swap), `package.json`/`package-lock.json` (new deps, see §3.1), `docs/WHMX_NEXT_STEPS.md`
- **New root config files:** `vite.config.mts`, `tsconfig.json`, `components.json`, `.mcp.json`
- **Untouched:** everything under `src/admin/character-skin/` (Vue island), `src/admin/preview/previewWorkspace.js`, all public-site code, all `server/`/`api/`/`db/` code, all localization tooling

## 8. Plan/doc files updated this session (already current, just noting where)

- `docs/WHMX_NEXT_STEPS.md` — item #7 status line
- `docs/plans/WHMX_ADMIN_REDESIGN_HISTORY_PLAN_2026-09-22.md` — Phase 3/4 sections rewritten with "what actually happened" detail (the source of truth for exact CSS/markup diffs, more detailed than this file)
- This file (new)

## 9. Fresh-session continuation checklist

1. Read this file, then the plan file's Phase 3/4/5 sections.
2. `cd WhmxCalc && git status --short` and `grep '"vercel"' package.json` — confirm current state matches §6.1/§7 before assuming anything.
3. If continuing the redesign: do Phase 5 (Character/Skin CMS), or finish §6.1's live-auth verification first if the owner wants that confirmed before moving on — ask which they want.
4. Do not touch the Vue island's JS logic (§4/§6.3). Do not merge/push branches (§2). Do not start a Vue→React migration unprompted (§6.3).
5. Ponytail mode may or may not carry over — check for a `SessionStart` hook message; if absent, ask the owner or just proceed with the project's own existing lazy/minimal-diff discipline either way.

## 10. Later same-day additions (behavior changes future work must know)

- **CSS layers:** `src/styles/global.css`'s universal reset is now inside `@layer legacy-reset`. Before this, the unlayered reset silently beat every Tailwind v4 utility (Tailwind wraps utilities in `@layer`), so all Admin margin/padding classes were zero. Don't move that reset back out of the layer.
- **Session change event:** `refreshSession()` (`src/app/auth/session.js`) dispatches `window` event `whmx:session-change` after it resolves. Anything outside React that shows auth state (currently `appNav.js`'s Admin entry) should listen to it rather than being called directly.
- **Router admin view:** `parseHash()` returns `{ view: 'admin' }` for `#/admin*`; `handleRoute()` updates nav highlight then returns — the public router no longer renders anything on Admin routes. Admin nav item is matched by `#app-nav-admin-link`, not tooltip text.
- **Fixture cleanup:** live DB now has exactly one user (the owner) and zero preview characters. `scripts/db-preview-admin-api-test.mjs` creates an owner account with a hard-coded password; if its `finally` cleanup ever fails again it leaves a working owner login behind — check `users` after running any proof script.
