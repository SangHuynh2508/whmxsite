# WHMX — CURRENT STATE FINAL (2026-09-23, v2 — later session same day)

**Supersedes** `WHMX_CURRENT_STATE_FINAL_2026-09-23.md` for day-to-day work (that file stays valid as history for the React pivot and Phases 3–4). Still-valid background (source-of-truth model, R2/asset rules, localization rules, ID conventions, git divergence history) lives in `WHMX_CURRENT_STATE_FINAL_2026-09-22.md` and is not repeated.

**Read order for a fresh agent:**
1. `WHMX_NEXT_STEPS.md`
2. this file
3. `plans/WHMX_ADMIN_PLAN_2026-09-23.md`: the working plan. Its status table says what's next.
4. `WHMX_APP_ARCHITECTURE.md`, then `WHMX_ENGINEERING_PRINCIPLES.md`
5. `admin-redesign/critique-and-spec.md`: the locked UI constraints, including the `.hidden` and preflight gotchas.
6. `admin-redesign/direction-review.md` and `admin-redesign/direction-approved.md`

All plans now live in `docs/plans/` (moved from Claude-local files, 2026-09-23).

---

## 1. Git / working tree

- **Nothing from this session is committed.** `main` and `feat/postgres-admin-crud` are still diverged (see the 09-22 file §7.4).
- **Do not commit, push or merge unless the owner asks.** Run `git status --short` in `WhmxCalc/` first; it's a large mixed diff that includes earlier sessions' work.
- `localization/localization_master.xlsx` shows as modified from an earlier session. It is human-reviewed source data: never overwrite or revert it.

## 2. What changed this session (all verified live with a real owner login unless noted)

### 2.1 Root-cause fixes that affect all future frontend work
- **CSS layers.** `src/styles/global.css`'s universal reset is now `@layer legacy-reset { … }`. Unlayered, it beat every Tailwind v4 utility (Tailwind puts utilities in `@layer`), so all Admin padding and margin were silently 0. Keep it layered.
- **`.hidden` gotcha.** `src/style.css:737` has `.hidden { display:none !important }`, which the public JS toggles, so it can't be removed. It overrides `hidden md:block`-style Tailwind patterns. In React code, never use the bare `hidden` class; write `max-md:hidden`.
- **No Tailwind preflight.** Preflight would reset the whole public site once loaded. `src/admin/layout/styles/globals.css` instead has a scoped `@layer legacy-reset` rule on `.admin-react-root`: `ol,ul {list-style:none}`, plus `font/color: inherit` on form controls.
- **tsconfig.** Removed `baseUrl`, because the installed TypeScript rejects it. Added `allowJs: true` and `types: ["vite/client"]`. `npx tsc --noEmit -p tsconfig.json` is clean and works as the check for `src/admin/layout/**`. Vite build does not typecheck.
- **Session change event.** `refreshSession()` (`src/app/auth/session.js`) dispatches the window event `whmx:session-change`, and `appNav.js` re-syncs the Đăng nhập/Quản trị entry on it. Non-React UI that shows auth state should listen to this event.
- **Router admin view.** `parseHash()` returns `{view:'admin'}` for `#/admin*`. `updateAppNavHighlights` activates `#app-nav-admin-link` (matched by id, not tooltip). `handleRoute` then returns, so public views no longer render behind Admin.

### 2.2 Data layer and bug fixes (Admin)
- New `src/admin/preview/previewApi.js` and `src/admin/users/usersApi.js` hold all Preview/Users fetch and mutation calls. The old `previewWorkspace.js` / `usersPanel.js` now call them with identical behaviour; list, detail, save, state, 409 and create were verified.
- **Fixed a pre-existing bug:** creating a Preview threw `Cannot read properties of null (reading 'closest')`. The handler used `event.currentTarget` after an `await`; it now uses the captured `form`.
- **Phase 5 CSS relocation** (earlier in the session): `.character-cms-*` moved to `src/admin/styles/characterSkinAdmin.css` (a byte-identical move), and 7 dead `.admin-character-workspace-active` rules were removed.

### 2.3 Live database cleanup (Neon, owner-approved)
- **A0001:** the junk `name_vi` override was reverted through `updateCharacter` (revision 26, audit row by the owner).
- **Fixture accounts:** `d2-proof-…` (editor) and `d0c-api-…` (**active owner** whose password is hard-coded in `scripts/db-preview-admin-api-test.mjs`) were deleted, with all their rows, including the orphan "Untitled Preview".
- **DB now:** exactly one user (Siro, owner) and zero preview characters. Every temp review account created this session was deleted.
- **Root cause still open:** several `scripts/db-*-proof/test.mjs` create users with fixed passwords and swallow cleanup errors (`.catch(() => undefined)`). A separate task was suggested to harden them. **Check `users` after running any proof script.**

### 2.4 Admin redesign (huashu 3-direction process)
- The critique of the old UI (3.5/10) and the shared spec are in `admin-redesign/critique-and-spec.md`.
- Three directions were built in `src/admin/layout/_design-exploration/{a-ledger-spine,b-accession-split,c-accession-register}/`. They are dev-only: `mount.tsx` mounts one with `/?direction=a|b|c#/admin` behind `import.meta.env.DEV`, so production bundles contain none of it (verified).
- Temporary: `@source "../_design-exploration"` in `globals.css`. An already-running dev server wasn't scanning the new folder. Remove both with the folder.
- **Owner picked B** (Linear-derived split view) and B's login. B's login is now a card with a 2px gold border glow near the cursor and no fill spotlight. The component is `src/admin/layout/components/magicui/magic-card.tsx`, **written without dependencies**. The owner asked for magicui's card, but `shadcn add @magicui/magic-card` would pull in `motion` + `next-themes`; `motion` was installed briefly, then uninstalled, and is not in `package.json`.
- The app is **dark-only.** The owner removed theme switching, and `src/app/settings/theme.js` forces `data-theme="dark"`.
- **Naming:** the character area is "Khí Giả" everywhere.

## 3. Environment gotchas (read before debugging the same things)
- **`vercel dev` crashes** (CLI 59.25.4, Node 24.15, Windows): exit `0xC0000409`, twice, on two separate instances. It's not caused by running two at once. If it keeps happening, try Node 22 LTS. The owner sometimes runs their own `vercel dev` on :3000; check `Get-NetTCPConnection -LocalPort 3000` before starting another. The `launch.json` entry `whmxcalc-vercel-dev` uses :3003.
- **`npm install` hangs or gets killed:** run it alone in the background with no short timeout. A killed shadcn install left a half-installed package once. Never run two npm commands at the same time.
- **Browser pane screenshots:** they are often stale or scaled wrong, and can time out if the pane is hidden. Use Playwright MCP (`browser_run_code_unsafe` with `page.screenshot({path, clip})`) for real screenshots and `getComputedStyle` for facts.
- **Authenticated testing needs a real login** (HttpOnly cookies). Pattern:
  1. Write a one-off `scripts/_tmp-*.mjs` that calls `provisioningAuth.api.signUpEmail` with a **random** password, then sets `role='owner'` directly in the DB.
  2. Run it with `node --env-file=.env --env-file=.env.local`.
  3. Log in through the real form.
  4. Delete the account and anything it seeded, in FK order: `character_publication_states` → `edit_history` → `preview_characters` → `managed_entities` → `admin_account_audits` → `users`.
  5. Delete the script.

## 4. What's next
Follow the status table in `plans/WHMX_ADMIN_PLAN_2026-09-23.md`:
1. **Part C: promote B.** Move B into `AdminApp.tsx`; delete A/C, the dev switch, the temporary `@source`, MoltenMetal/StarBorder and `ogl`; add plain-language field labels with editor/owner disclosure; make the nav a data array; add a collapsible list pane. The Vue Khí Giả island stays untouched.
2. **Part E: mobile bottom dock**, owner-requested, s1n.gg style. It must add the missing mobile Đăng nhập/Quản trị entry and replace the overflowing `.top-nav`.
3. **Part F: Khí Giả admin brainstorm.** Resume at open question 1, "who translates lore, and is there a review step?". Settle the localization-authority decision before building Lore.
4. **Then:** test Admin with real data updates, then Lore. Skills (Part D) come later.
