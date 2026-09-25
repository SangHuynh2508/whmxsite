# WHMX Admin — Bug fixes + real from-scratch redesign exploration

> Moved into the repo on 2026-09-23 (was a Claude-local plan file). This copy is authoritative.

## Status (keep this table current)

| Part | What | Status |
|---|---|---|
| A | Bug fixes: fixture data, nav label, nav highlight | ✅ Done 2026-09-23, verified live |
| B | 3 from-scratch directions → owner picked **B** | ✅ Done. B's login also got the MagicCard border-glow card (see C2) |
| C | Promote B into production files + plain-language fields | ✅ Done 2026-09-23, verified live (owner + editor login). Accepted (in production since 2026-09-25); MoltenMetal/StarBorder/ogl leftovers already removed |
| E | Mobile bottom dock (public + admin), incl. mobile login entry | ✅ Built 2026-09-24, now React (`src/app/layout/AppNav.tsx` = desktop rail + mobile dock). Owner tested logged-in (the sheet bug was fixed). **Agent-unverified:** the logged-in admin icon column at 768–1279 px. See "E result" |
| F | Brainstorm: Khí Giả admin redesign (Vue island) | ✅ Superseded: built as P4 (React Khí Giả + Lore, live 2026-09-26; plans in `docs/superpowers/plans/2026-09-25-*`). Original note: Q1 answered (no review). Q2 answered by the pipeline plan (DB is the authority for lore). Lore work continues in `plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` (P4 = Admin Lore module); remaining questions Q3–Q5 are asked when P4 starts |
| D | Skill translation frame | Deferred. Lore comes first, after Admin is tested |


## Context

Session `2026-09-23` fixed a real root-cause CSS bug (Tailwind spacing utilities
silently zeroed by an unlayered legacy reset — `src/styles/global.css`'s
`@layer legacy-reset` fix) and retuned the login page's WebGL background
(`MoltenMetal.tsx`) from whole-page mouse-drift to a localized cursor glow.
While verifying that fix live (real provisioned account, real login), the
owner flagged 4 more problems from live screenshots:

1. Leftover fixture/test data pollutes real Admin data — 2 orphaned test
   accounts in the Users table, and one of them left a garbage `override` on
   a **real** character's (`A0001`) Vietnamese name field.
2. The global nav rail's Admin entry gets stuck showing "Quản trị" after
   logging out (should revert to "Đăng nhập").
3. The nav rail's active-route highlight gets stuck on whatever public route
   was last visited when navigating into `#/admin` — never switches to (or
   ever had) an Admin-specific highlight state.
4. **The deeper issue**: the owner only picked "Direction 2" (the currently
   live top-bar/full-width layout) in a prior session because it was *the
   least bad of 3 options*, not because it's genuinely well-designed. They
   also observed — correctly — that every redesign pass since (including
   this session's CSS-relocation work) only ever reapplied huashu's *rules*
   (no new colors, reuse tokens, no gradients) to the **existing skeleton**,
   never did real creative visual exploration. They provided an explicit
   "act as a Senior UI/UX Designer, throw out the old structure, design
   3 genuinely new directions from scratch" brief and want it followed
   literally this time, not just referenced.

This plan has two independent parts: **Part A** (4 concrete, low-risk bug
fixes — bounded, same session) and **Part B** (a real, from-scratch visual
redesign exploration — bigger, its own gate, executed via the huashu-design
skill's actual Fallback 3-direction mechanism, adapted for this production
React/Tailwind/shadcn app).

---

## Part A — Bug fixes (bounded, low risk)

### A1. Clean up leftover fixture data

Two accounts left over from *earlier* (pre-this-session) test/proof scripts
are polluting the real Users table: `d2-proof-7a465288-f2d2-4208-b853-c6054c69c26d@d2.invalid`
and `d0c-api-94373965-4ca3-4db4-ab09-7048407ca75d@d0c.invalid`. The `d2-proof-...`
account also left an active field-override on real character `A0001`
(`nameVi` = the garbage string `d2-proof-7a465288-...override`).

- **Revert the bogus override** by reusing the existing domain function
  `updateEntity('character', 'A0001', { expectedRevision, changes: { nameVi: <source value> }, actorUserId, requestId })`
  in `server/character-skin-admin-domain.mjs:337`. Setting the field back to
  its source value is already-existing logic (line 365-368) that detects the
  match and flips the override row's `state` to `'cleared'` — this is the
  exact same code path the real "Chỉnh sửa override" UI action uses, so it
  preserves revision/audit history correctly instead of a raw SQL patch.
  The source value comes from `row[config['nameVi'].sourceKey]` on the same
  file — need to read that config to get the exact source column name before
  writing the one-off script.
- **Census first, read-only (review correction — the earlier "neither has
  other rows, just delete audits then users" claim was unverified and is
  wrong):** ~15 FK columns reference `users.id`, most `onDelete: 'restrict'`
  (`db/schema/core.mjs` — `edit_history.actor_user_id`,
  `managed_entities.edited_by_user_id`; `db/schema/character-skin.mjs:200,358,362`
  — `field_overrides` created/updated-by; `db/schema/preview-character-assets.mjs`
  — several; `db/schema/auth.mjs:116,119` — `admin_account_audits`). The
  `d2-proof` account at minimum owns the A0001 `field_overrides` row and its
  `edit_history` row, so a plain `delete from users` will fail. Step 1 is a
  read-only query counting rows in **every** one of those columns per fixture
  user id, shown to the owner before anything is mutated. Also confirm this
  session's own temp account (`design-check-8637d33c-...`, visible in the
  owner's screenshot) is already gone — it was deleted earlier this session.
- **Then delete, in RESTRICT-safe order**, only rows the census attributes
  to the 2 fixture accounts (they are test junk; erasing their own audit
  rows is acceptable) → finally the `users` rows. If the census shows a
  fixture account touched any *real* entity beyond A0001's override, stop
  and ask instead — fallback is soft-disable (`users.status` +
  `disabled_by_user_id` already exist in `db/schema/auth.mjs:35`), which
  keeps audit history intact.
- **This mutates the live Neon database** — print the exact row list and
  get an explicit owner "yes" in chat before the delete script runs, even
  though the plan is approved.
- One-off scripts under `scripts/_tmp-*.mjs`, run with
  `node --env-file=.env --env-file=.env.local`, deleted after running (same
  discipline as this session's earlier temp-account script). Actor for the
  A0001 `updateEntity` call = the real owner's user id (Siro), since the
  owner is the one requesting the revert.

### A2. Nav "Đăng nhập"/"Quản trị" label stuck after logout

Root cause (confirmed by reading `src/app/layout/appNav.js:31`): `syncAdminNavEntry()`
runs exactly once, at `initAppNav()` boot time. `AdminApp.tsx`'s
`handleLogin`/`handleLogout` already call `refreshSession()` (`src/app/auth/session.js`)
which updates the shared session cache, but nothing tells the already-rendered
global nav rail (separate legacy DOM, outside React) to re-read it.

**Fix (review correction — fix at the shared point, not per caller):** in
`src/app/auth/session.js`, have `refreshSession()` dispatch a
`window` event (`whmx:session-change`) once its fetch resolves; in
`appNav.js`'s `initAppNav()`, listen for that event and re-run
`syncAdminNavEntry()`. This fixes every current and future caller of
`refreshSession()` (AdminApp login/logout, `characterInlineEdit.js` later)
without the React Admin shell importing legacy nav internals. `AdminApp.tsx`
needs no change for A2.

### A3. Sidebar keeps the previous public route's highlight on `/admin`

Root cause (review correction — the earlier "bails at the `gameData`
guard" diagnosis was wrong; verified by reading `src/app/router/router.js:54-159`):
`parseHash()` has no `/admin` case, so `#/admin` falls through to the final
`return { view: 'catalog' }`. `handleRoute()` then calls
`updateAppNavHighlights('catalog')`, which **actively highlights the
Characters ("Khí Giả") item** — and also renders the public catalog view
behind the Admin screen (hidden only by `body.admin-route-active > #app
{display:none}` in `adminShell.css`), which is wasted work.

**Fix (all inside `router.js`, no AdminApp coupling):**
1. `parseHash()`: return `{ view: 'admin' }` for `/admin` and `/admin/*`.
2. `updateAppNavHighlights()`: toggle `.active` on the Admin item by
   `#app-nav-admin-link` id (not by tooltip — its tooltip text flips between
   "Đăng nhập"/"Quản trị" at runtime, see `index.html:125`), active iff
   `activeView === 'admin'`. Every other branch already turns itself off
   for any non-matching view, so Characters un-highlights automatically.
3. `handleRoute()`: right after `updateAppNavHighlights(route.view)`, return
   early when `route.view === 'admin'` so the public views aren't rendered
   behind Admin (the React shell owns that route entirely).

### A1-A3 verification

Rebuild, then repeat this session's already-proven live-verification
technique: provision a temp owner account, log in for real through the
browser (`vercel dev` via `preview_start "whmxcalc-vercel-dev"`), confirm:
Users table no longer shows the 2 fixture rows, A0001's override is cleared
(shows source value, not the garbage string), nav label correctly reverts to
"Đăng nhập" after clicking "Đăng xuất", nav highlight correctly shows the
Admin entry active while on `#/admin*` and correctly clears when navigating
back to a public route. Clean up the temp account afterward (same pattern as
this session).

---

## Part B — Real from-scratch redesign exploration

Runs via the `WhmxCalc:huashu-design` skill's actual Fallback mechanism (3
independent, non-consulting design logics), adapted for a real
React/Tailwind/shadcn production app instead of a throwaway HTML mockup —
this is **not** decided by more chat/text, it produces 3 real, running,
authenticated directions the owner compares visually before anything is
promoted to production. This is a separate, bigger gate from Part A; Part A
can ship first independently.

**Scope decision (owner-confirmed):** directions are free to redesign
**both** the shell (`AdminApp.tsx`: login, header, top-nav) **and** the
actual markup/layout inside `previewWorkspace.js` / `usersPanel.js` — not
CSS-only restyle of the existing DOM. Data-fetching/mutation logic (the
`fetch`/PATCH calls, revision handling, 409-conflict logic) is reused
as-is (it's stable and unrelated to visual design, per
`WHMX_ENGINEERING_PRINCIPLES.md`'s "isolate the decision that might
change" rule) — only the render/DOM layer is up for reinvention. This is a
materially bigger, higher-risk piece of work than a CSS-only pass: each
direction is now a real alternate implementation of 2-3 files, not a
stylesheet swap. Character/Skin CMS (the Vue island,
`characterSkinAdminWorkspace.js`) stays **shell-level only** as before —
its own internal render/CRUD logic is never touched, in any direction, per
the standing "no big-bang rewrite" lock in `WHMX_APP_ARCHITECTURE.md` §13.

### Step 0 — Shared critique + spec (done once, by whoever runs Part B, not per-direction)

A short senior-designer critique of the **current, already-spacing-fixed**
live app (screenshotted via real authenticated login, not the old vanilla
shell) covering whitespace rhythm, type hierarchy, color usage, and
density. **It is shown to the owner as its own deliverable** (the owner's
brief item 1: "đánh giá nhanh những điểm tệ nhất của giao diện cũ"), not
just fed to subagents. It is also written to
`docs/admin-redesign/critique-and-spec.md` so it survives the session. It
then becomes the shared "known problems to fix" section inside
huashu's Phase-3 design spec (≥500 words, per the skill's own process) that
all 3 direction subagents receive identically. Divergence between the 3
directions should come from *design logic*, not from re-debating whether
the type scale is bad — redoing the critique 3× independently would waste
effort without adding creative range.

The spec also carries the **locked constraints** every direction must
respect regardless of how different its structure is: only existing
`src/styles/tokens.css` custom properties for color (no new hex values,
per the dark-charcoal/antique-gold identity locked in
`WHMX_APP_ARCHITECTURE.md` §10); Better Auth session/login network logic
ported verbatim, not re-derived (re-deriving it 3× risks reintroducing the
exact Tailwind-cascade-layer bug this session just fixed); shadcn/Tailwind
is the intended toolchain (only `adminShell.css`'s own legacy hand-rolled
classes are what's being discarded, not Tailwind itself).

**reactbits.dev (owner asked explicitly — was missing from the plan):**
each direction may pull components from reactbits via the already-configured
registry (`npx shadcn@latest add @react-bits/<Name>-TS-TW --yes`,
`components.json` has the `@react-bits` entry). Rules, same anti-slop bar
as the rest: a component must earn its place (a button hover/border
treatment, a list/card reveal, a background for the login screen only) —
no decorative effects on dense data screens; props must be fed WHMX token
values, never the component's default palette; note each added npm dep and
its gzip weight in the direction writeup (`ogl` for `MoltenMetal` is the
precedent, ~50 KB). The current login `MoltenMetal` + `StarBorder` are
**not** protected — a direction may keep, replace, or drop them. Only the
orchestrator runs `npx shadcn add` (sequentially — two concurrent npm
installs can corrupt the lockfile, see current-state doc §5 item 3);
subagents list the components they want and the orchestrator installs them
before they write code against them.

### Step 1 — 3 parallel, independent design subagents

Each subagent works from the shared spec, doesn't see the other two's
output, and follows one distinct logic (huashu Fallback Phase 4, adapted):

1. **Style-roulette** — pick a structural/typographic aesthetic from
   huashu's real style library, reinterpreted strictly through WHMX's
   existing tokens.
2. **Real-world reference** — `WebSearch`-verify one real, well-regarded
   premium admin/dashboard product (e.g. Linear, Vercel dashboard, Stripe
   Dashboard, Attio) and dissect its structural DNA (nav placement,
   density, list/detail pattern) — not its colors.
3. **Best-designer thought experiment** — "if budget were unlimited, which
   studio/designer would you hire for WHMX's 'guarded antique treasury'
   identity?" — design from that reasoning.

Each produces a real, running, authenticated variant — not a static
mockup. **Division of labour (review correction):** the 3 subagents only
*write code* into their own isolated files — they cannot each run a server
or log in, because there is one `vercel dev` (port 3003) and one Browser
pane. The orchestrator then, sequentially and with **one** temp owner
account (`provisioningAuth.api.signUpEmail` + DB role update, same as
Part A's verification): starts `whmxcalc-vercel-dev`, logs in for real,
switches through the 3 directions, takes authenticated screenshots of
login + Preview/Users + Character CMS shell for each, and checks computed
styles for off-token colors.

**Files per direction** (new, isolated, never touching production files
until one is chosen): `src/admin/layout/_design-exploration/DirectionX.tsx`
(+ `.css` as needed) for the shell, and — only for directions that choose a
different Preview/Users layout — their own variant of the render logic
currently in `previewWorkspace.js`/`usersPanel.js` (e.g.
`DirectionX.previewWorkspace.js`), reusing the existing fetch/mutation
functions from those files rather than reimplementing them (if a fetch
function isn't exported today, export it — don't copy it). A tiny
dev-only switch (`#/admin?direction=a|b|c`) chooses which shell
`mount.tsx` renders; it is wrapped in `import.meta.env.DEV` so it is
tree-shaken out of production builds and can never ship, and it is written
by the orchestrator only (subagents never touch `mount.tsx`/`AdminApp.tsx`
— the only shared files). `docs/admin-redesign/direction-approved.md`
(huashu's Gate-file protocol) records the 3 screenshot paths and the
owner's literal decision; it lives in `docs/` so it survives the cleanup of
`_design-exploration/`.

### Step 2 — Decision and promotion

Owner reviews all 3 live, authenticated directions (screenshots + the
toggle to click through them live) and picks one, or asks for a
hybrid/another pass — same as the prior session's Attempt-4 gate. Once
chosen: the winning direction's files get **promoted by rename** into the
real paths (`AdminApp.tsx`, `previewWorkspace.js`/`usersPanel.js` if
markup changed); its CSS **replaces** the legacy `adminShell.css` rules it
supersedes (delete the superseded rules — merging the new CSS on top of the
old would keep exactly the classes the brief says to discard; keep only the
still-needed `body.admin-route-active` global-nav hiding rules), the 2 rejected directions'
files are deleted (not archived), the `_design-exploration/` directory and
its dev-only route are removed, and the temp account + any seeded rows are
cleaned up via the FK-chain order already documented in
`WHMX_ADMIN_REDESIGN_HISTORY_PLAN_2026-09-22.md`'s Attempt-4 section.

### Effort/risk

This is real, multi-file work per direction now that markup is in scope —
sized closer to 3 independent feature passes than 3 CSS variants. Named
risks: (1) re-deriving session/login logic 3× — mitigated by "port
verbatim" instruction in the shared spec; (2) a direction's new
Preview/Users markup accidentally breaking the D2.4.1-adjacent
save/discard/409-conflict UX contract if it restructures how state feeds
into the DOM — each direction must be checked against that contract before
being shown, not just visually reviewed; (3) since markup is now free,
verify each direction doesn't quietly drift into inventing new colors
outside `tokens.css` — check computed styles, not just eyeballing.

---

## Cross-cutting rules (both parts)

- **Order:** Part A first, verified live, reported; Part B starts only on a
  separate owner go-ahead (the owner has already said "chưa code liền" once
  — do not roll from A into B automatically).
- **No commits, no push, no branch merges** — `main` and
  `feat/postgres-admin-crud` are still diverged (current-state doc §2);
  everything stays uncommitted working-tree state unless the owner asks.
- **Docs:** after each part, update `docs/WHMX_NEXT_STEPS.md` item #7 in
  place (living doc) and add a short section to
  `docs/WHMX_CURRENT_STATE_FINAL_2026-09-23.md` for the A3 router
  correction and the A2 session-event seam, since both change how
  `session.js`/`router.js` behave for future work.
- **A1-A3 verification addendum:** besides the checks listed above, confirm
  in the Network/DOM that visiting `#/admin` no longer renders the public
  catalog view (A3 step 3), and that Characters is not `.active` there.

---

## Part C — Promote direction B (owner picked B, 2026-09-23) — ✅ DONE 2026-09-23 (result at the end of this Part)

Owner decisions (2026-09-23): B layout + B login; app is dark-only (theme toggle removed by owner, `src/app/settings/theme.js` forces dark); the character area is called **"Khí Giả"** everywhere (B's "Hiện vật" label → "Khí Giả", same as the public site).

### C1. Promotion (mechanical)
- `_design-exploration/b-accession-split/*` → `src/admin/layout/` (App.tsx becomes `AdminApp.tsx`; sub-components keep their names; `b.css` → `src/admin/styles/adminShell.css` replacing the legacy rules it supersedes; keep only `body.admin-route-active` nav-hiding rules).
- Delete `a-ledger-spine/`, `c-accession-register/`, the `mount.tsx` `?direction=` switch, the temporary `@source` line in `globals.css`. Keep the scoped list/font reset.
- Delete now-dead `previewWorkspace.js` / `usersPanel.js` markup modules (B uses `previewApi.js` / `usersApi.js` directly) — grep first that nothing else imports them.
- Dark-only: drop B's light-theme branches (e.g. on-gold text switching); leave `tokens.css` light values alone (harmless, public site uses the same file).

### C2. Login = minimum card — ✅ built in B already (2026-09-23), carry it over as-is
Built: a card with title "Đăng nhập", Email, Mật khẩu, error line, and the button in a footer with a divider (owner asked for the magicui `magic-card` look). Only the border lights up (2px, gold `--rarity-sr-text` → `--accent`) near the cursor; there is no fill spotlight, per the owner's follow-up. The component is `src/admin/layout/components/magicui/magic-card.tsx`, **written dependency-free**: the pointer position lives in `--mx`/`--my` CSS vars set on pointermove, so there's no `motion` and no `next-themes`. `shadcn add @magicui/magic-card` would install both, so don't run it. The card pins `--background`/`--color-background`/`--color-border` to WHMX tokens in its className because `@theme inline` may not emit them at runtime.
Still to do in C: delete `components/MoltenMetal.tsx`, `components/StarBorder.tsx`, their keyframes/`--animate-star-*` in `globals.css`, and `npm uninstall ogl` (only MoltenMetal imports it — re-grep before uninstalling).

### C3. Plain-language fields + progressive disclosure (editor vs owner)
Facts: `claimedRawIdEvidence` and `manualMetadata` are free JSON (`jsonValue`), stored and displayed only — no server/tool/public code consumes them.
| Now | Proposed (editor sees) |
|---|---|
| Raw ID khai nhận (claimed) | "Mã nhân vật trong game (nếu đã biết)" — hint "VD: A0213. Để trống nếu chưa chắc." |
| Bằng chứng cho raw ID (JSON) | Plain textarea "Căn cứ" — hint "Vì sao nghĩ là mã này: link, ảnh, nguồn…"; saved as `{"note": "..."}` so editors never type JSON |
| Metadata thủ công (JSON) | Hidden from editors; owner-only "Nâng cao" drawer (raw JSON) — nothing reads it |
| Ghi chú xuất xứ | "Nguồn thông tin" — hint "Thông báo chính thức, datamine, leak…" |
| manual_preview / manual_official / manual_placeholder | "Ảnh xem trước (chưa chính thức)" / "Ảnh chính thức" / "Ảnh tạm" |
| Finalize pending | "Duyệt ảnh đang chờ" |
| Reconciliation | "Đối chiếu với nhân vật chính thức" — hidden when empty |
| UUID, publicKey, actor IDs | Owner-only collapsed "Thông tin kỹ thuật" |
Existing JSON evidence values that aren't `{note}` must still round-trip (show in the owner drawer, don't overwrite).

### C4. Shell affordances needed later (small, do during promotion)
- Nav as a data array (one entry per domain) so Buff/Skill later = one line.
- Collapsible list pane ("focus mode") so a record can take full width — the future Skill editor needs CN | VI side by side.

### C5. Khí Giả (Character CMS) — NOT touched in Part C (owner decision)
The Vue 3 island stays exactly as is (no reskin). The owner wants to brainstorm and redesign it separately — see Part F. Part C only renames the nav entry to "Khí Giả" and keeps mounting the island.

### C verification
tsc + build; live owner login: list/filter/create/save/409/state/upload-intent path, editor-role view (advanced fields hidden, owner controls disabled with reason), accounts, Vue island mount; clean temp account.

### C result (2026-09-23)
**Files.** `AdminApp.tsx` = B's shell. B's views are in their owning Admin areas, following architecture §10 rather than this plan's "everything into `layout/`": `src/admin/preview/PreviewView.tsx`, `src/admin/preview/PreviewDetail.tsx`, `src/admin/users/AccountsView.tsx`, and shared primitives in `src/admin/layout/ui.tsx` (imported as `@/ui`). `b.css` is merged into `src/admin/styles/adminShell.css`. The temporary `b-*` names became `admin-*` (`--admin-gold-ink`, `.admin-serif`, `.admin-record`…); the architecture forbids milestone-named modules. The legacy `.admin-*` rules are gone, except `.admin-secondary`/`.admin-muted`, which the Vue island still uses. B's mini-preflight moved into the scoped `@layer legacy-reset` block in `globals.css`.
**Deleted.** `_design-exploration/` (A, B, C), the `mount.tsx` switch, `@source`, `previewWorkspace.js`, `usersPanel.js`, `MoltenMetal.tsx`, `StarBorder.tsx`, the star keyframes and `--animate-star-*`. `ogl` was uninstalled.
**C3.** Editors see "Mã nhân vật trong game", "Căn cứ" (plain text, stored as `claimedRawIdEvidence.note`) and "Nguồn thông tin". Owners also get a "Nâng cao" drawer with the other evidence keys and `manualMetadata` as JSON, plus a "Thông tin kỹ thuật" drawer with origin, publicKey, UUID and actor IDs. Editors don't send `manualMetadata`; evidence keys other than `note` round-trip untouched, and an unchanged save keeps the key order, so it returns `changed:false` without a spurious revision. That logic lives in `src/admin/preview/evidence.js`; check it with `node src/admin/preview/evidence.check.mjs`. Other changes: plain Vietnamese names for the image type, verification state and history events; "Duyệt ảnh đang chờ"; Reconciliation is hidden when empty; list rows show the claimed game ID instead of publicKey.
**C4.** `NAV` array in `AdminApp.tsx`: the section comes from the longest matching href, so a new domain is one entry plus its view. The collapse button in the record header hides the list pane at ≥1024px (`lg:hidden`, `aria-pressed`).
**Server bug found and fixed** in `server/preview-characters/preview-character-domain.mjs`. In zod 4, the patch schema's `jsonValue.optional()` still applied `.default({})`, so any PATCH that omitted `claimedRawIdEvidence`/`manualMetadata` wiped it to `{}`. The old UI always resent both fields, so this never showed. The editor form exposed it: `manualMetadata` `{"k":1}` became `{}`. Patch fields now use `jsonPatchValue` (no default). Re-verified that an editor save keeps `{"k":1}`.
**Verified live** on `vercel dev` :3003 with a temp owner and a temp editor (the editor was provisioned through the Accounts UI):
- login shows dark text on gold;
- create: invalid advanced JSON is rejected with a message, valid JSON saves;
- an unchanged save returns `changed:false`;
- owner state change → rev 2;
- a stale save → 409, with the draft kept and the discard/reload path working;
- the nav label reverts to "Đăng nhập" after logout;
- editor view: no drawers, no UUID, owner controls disabled with a reason, provenance select disabled, Accounts shows "Chỉ dành cho owner";
- the editor's note edit keeps the other keys;
- focus mode;
- Khí Giả island loads 133/133 and its buttons keep their style;
- leaving to `#/` restores the public view.

All temp rows were deleted in one transaction: 2 users, 2 accounts, 1 account audit, 1 preview (with its entity, publication state and 5 history rows). The DB now holds only Siro, plus the "g/h" preview that Siro created earlier on 2026-09-23 (left untouched). The temp scripts were deleted.
**Not verified.** R2 upload/finalize (it would write real objects), mobile widths (Part E), and pixel screenshots (the pane's screenshots were cropped; checks were done through the DOM and computed styles).

---

## Part D — Skill translation frame (future, design notes only — NOT next)

Owner (2026-09-23): this is a translation frame WHMX builds for its editors (not an external CAT tool). Skill/Buff DB tables are not needed yet. Order: finish + test Admin (data updates working) → **character Lore next** (Part F) → skills later.

Grounding (read-only, 2026-09-23): skill `desc_raw` is Unity rich text — `<color=#158bdb>` wraps numbers/params, `<color=#ff6724>` wraps status names, `[Effect1Para,1]`/`[EffectParam,2]` are params, and `{Buff_ID}` markers are appended (not at the name's position). `tools/build_web_data.py` binds names→buff IDs (prefers `SKILL_BUFF_LINKS`; falls back to normalized CN name match; ambiguous names get no popup). Public `infoView.js` already renders bound buff keywords with `data-buff-id` + tooltips. `buff_registry` (1999 entries) holds per-buff name_cn/name_vi/desc.

Shape of the idea (owner's design is sound — it's the standard CAT-tool "inline placeholder" pattern):
1. Server tokenizes raw CN once, deterministically: text runs + atomic tokens `buff:Buff_A0001_4`, `param:Effect1Para,1`, `num:50%`. Stored structured, not re-parsed from display text.
2. CN pane renders tokens as coloured, clickable chips; clicking a buff chip opens that buff's own translation (Buff is its own domain — per localization rules BUFF_STATUS is separate from the skill that references it).
3. VI pane = free text + the same chips (showing each buff's VI name, or "chưa dịch"), draggable anywhere, so sentence order can change.
4. Saved as a template (`… {buff:Buff_A0001_4} …`); server rejects a save unless the VI token multiset equals the CN one (no lost/duplicated buff or param). Publish renders the template back to rich text.
5. Editor tech: a React rich-text framework with atomic inline nodes (Lexical or TipTap/ProseMirror) — don't hand-roll contenteditable. Decide when scheduled.

Prerequisites (each is its own decision/plan):
- **OPEN DECISION — localization authority** (`WHMX_APP_ARCHITECTURE.md` §12): skill text VI authority is `localization_master.xlsx` today. An Admin skill editor writing Postgres moves authority; owner must choose: DB becomes authority (import + reconcile + export), or Admin produces reviewed proposals exported back to the workbook.
- Port the tokenizer/binding logic from Python to one JS module shared by public renderer, admin editor and publish pipeline (engineering principles §2 / architecture §11 — resolvers in JS/Node).
- Skill/Buff data model in Postgres + importer (NEXT_STEPS #6).
- Publish pipeline (NEXT_STEPS #5) — otherwise edits never reach the public site.

Impact on Part C: none blocking. Only C4 (nav array, collapsible list/focus mode) prepares for it.

---

## Part E — Mobile bottom dock (s1n.gg pattern), public + admin — after Part C

Owner request: on mobile, every page (public and admin) uses the same bottom bar instead of a top bar: fixed over the content (stays while scrolling), buttons ☰ / 🔍 / ˅; ˅ collapses it to a small ˄ tab at bottom-centre; ☰ opens a full-height menu sheet above the bar.

**Owner-confirmed problems on the current public mobile site (screenshot, 2026-09-23):**
1. **There is no Đăng nhập / Quản trị entry on mobile at all.** The only login entry is `#app-nav-admin-link` in the desktop rail footer, and the rail is hidden ≤768px. The dock sheet must contain it, and it must re-sync on `whmx:session-change` like the rail does.
2. **The top bar overflows at ~375px:** "Máy Tính" is cut off at the right edge. The dock replaces `.top-nav`, which removes this.

Current state (read-only check): ≤768px the rail `.app-nav` is hidden and `index.html:147` `.top-nav` (brand + 4 links) shows at the top. On admin routes `.top-nav` is also hidden (`body.admin-route-active > .top-nav`), so mobile admin has **no** global nav — only B's own nav, which turns into a horizontal top strip below 1280px (`xl:` breakpoints in `Sidebar`, `src/admin/layout/AdminApp.tsx`).

Plan:
- One global `mobileDock` module in `src/app/layout/` (app-global chrome belongs there per architecture §10), plain JS so it works on public pages and around the React admin alike. Replaces `.top-nav` (remove its markup + CSS).
- Visible only <768px. Fixed bottom, `z-index` alongside the rail, `padding-bottom: env(safe-area-inset-bottom)`; page content gets matching bottom padding so the last row isn't hidden. Collapsed state remembered in `localStorage` (try/catch).
- ☰ sheet: a real dialog (Esc closes, focus moves in, `aria-expanded`), same items as the desktop rail: Khí Giả, Trang Phục, Vũ Khí, Máy Tính, then Đăng nhập/Quản trị. When signed in as editor/owner, also the admin areas (Hiện vật, Preview, Tài khoản, Đăng xuất). Auth state from `getSession()` + the existing `whmx:session-change` event; active item from the same route logic as `updateAppNavHighlights` (add a dock branch there).
- Admin widths (decided — owner unsure, default chosen): <768px no B nav, the dock replaces it; 768–1279px B sidebar collapses to an icon-only column (~56px, labels as tooltips, Linear-style) instead of the current horizontal top strip; ≥1280px full sidebar. No top strip at any width.
- Collisions to handle: `#whmx-feedback-btn` and the calculator picker are also bottom-anchored — move above the dock.
- 🔍 (owner agreed): focuses the current page's search box (character list / preview list), hidden when the page has none; a real global search is a separate feature.
- Verify: 375×812 public + admin, scroll with dock open/collapsed, sheet keyboard/Escape, no content hidden under the dock, desktop unchanged.

### E result (2026-09-24)
**Review cleanup first (ponytail review of Part C).**
- `globals.css` is down to the scoped reset. Deleted:
  - the whole shadcn colour theme: nothing used it after B;
  - the radius block: identical to the Tailwind defaults;
  - `tw-animate-css`: uninstalled.
- `magic-card.tsx` paints with WHMX tokens directly (no gradient props, no pinned vars).
- `AdminApp.tsx`:
  - `NAV.find`;
  - `LucideIcon`;
  - NavItem gets a `locked` boolean instead of a `trailing` slot.

**Dock.**
- **React (owner, 2026-09-24: "cứ sài react đi… chuyển dần sang react").** `src/app/layout/MobileDock.tsx` is mounted from `boot.js` into its own root; CSS sits in `src/style.css` at the old top-nav spots. It replaces a first plain-JS version, which has been deleted. The admin links come from `src/admin/layout/nav.ts` (`NAV`, shared with `AdminApp`); the active item comes from router.js `parseHash()`; the calculator link uses `calculatorHash()`, exported from router.js and shared with the rail.
- ☰ is in the middle. `<MorphIcon icon={open ? X : Menu} />` (`morphicons/react` + `lucide` icon data, owner-requested; `npm install morphicons`) sits both on the dock button and on the sheet's close button, which is at the same spot. Opening morphs ☰→✕ and closing morphs ✕→☰, and it reads as one button. `reducedMotion="user"`. When the page has no search box, a spacer keeps ☰ centred.
- Sheet open/close is CSS-only: the dialog fades over 0.22s (`@starting-style` + `transition-behavior: allow-discrete` on `display`/`overlay`, so closing fades instead of vanishing); the items rise 12px; the close row stays put so the morph is in place. `prefers-reduced-motion` turns it off. The dock icons use stroke 2.5 (`BAR_STROKE`, owner: "đậm hơn xíu").
- **Desktop rail moved to React too (2026-09-24).** The owner asked for the active highlight to slide between items instead of appearing in place.
  - `src/app/layout/AppNav.tsx` is one root holding the rail and the dock. They share `PUBLIC_LINKS`, the active-view rule (`parseHash().view`) and the session state.
  - Deleted: the static rail markup in `index.html`, `appNav.js` (`createIcons`, admin-entry sync) and router.js's `updateAppNavHighlights` plus the per-tooltip click wiring. The rail markup and classes are unchanged, so the existing CSS and the hover-expand still apply.
  - The highlight is one `.app-nav-indicator` (fill + gold bar) moved by `translateY` to the active item. It is placed without a slide on first paint and slides (0.32s) afterwards. It spans the 10px side padding, so it follows the 60↔170px expand by itself; the footer login/admin item is included; `prefers-reduced-motion` turns the slide off.
  - Verified at 1280: Khí Giả→Trang Phục moves the indicator 70→120px, and a screenshot caught it mid-slide; `#/admin` sends it to the footer item; the indicator width matches the item width; mobile is unchanged.
- `.top-nav` is gone (markup, CSS, router branch, the adminShell hide rule).
- Sheet links reuse the rail's `data-tooltip` keys, so `router.js` routes and highlights them.
- The ☰ sheet is a native modal `<dialog>`: Esc, focus and an inert page come with it. `aria-expanded` is synced on `close`.
- Signed out, the sheet shows "Đăng nhập". Signed in (editor/owner), it shows a "Quản trị" group instead: Khí Giả / Preview / Tài khoản / Đăng xuất. This group mirrors `NAV` in `AdminApp.tsx`.
- 🔍 focuses the first visible `input[placeholder^="Tìm"]` (`checkVisibility`). On `#calc` it opens the character drawer. Otherwise the button is hidden, re-checked via a rAF-throttled MutationObserver (`ponytail:` note in the file).
- ˅ collapses the dock to a ˄ tab, remembered in `localStorage` with try/catch.
- `body` gets `padding-bottom: var(--mobile-dock-h)` ≤768px. The feedback button sits above the dock.

**Shared sign-out.** `signOut()` in `src/app/auth/session.js`, used by the dock and the Admin sidebar. `AdminApp` listens to `whmx:session-change`, so a logout from the dock also updates Admin.

**Admin widths.**
- <768px: the Admin sidebar is `max-md:hidden`; the dock's "Quản trị" group replaces it.
- 768–1279px: a 56px sticky icon column; labels become `sr-only` + native `title` tooltips.
- ≥1280px: the full sidebar. There is no top strip at any width.

**Verified (375×812 and 1280, `vercel dev`, logged out).**
- Dock at the bottom, no horizontal overflow, no top bar.
- ☰ opens a full-height sheet: focus moves in, active item is gold, a link click navigates and closes, `close` resets `aria-expanded`.
- 🔍 focuses the catalog search, opens the drawer on `#calc`, and has nothing to focus on the character detail page.
- Collapse/expand works and is persisted.
- The last content row ends exactly 56px above the page end, so the dock never covers it.
- Admin login at mobile shows the dock and no rail margin.
- Desktop is unchanged: dock hidden, rail visible, no padding.
- In a hidden Browser pane the `close` event and rAF are deferred; the checks were confirmed after forcing a render.

**Owner feedback round (2026-09-24), fixed.**
1. Signed in, the sheet showed "Đăng nhập" and "Đăng xuất" together. Cause: `.mobile-dock-sheet a { display:flex }` beat the UA `[hidden]` rule. Fix: `.mobile-dock-sheet [hidden], .mobile-dock-bar [hidden] { display:none }`.
2. A sliver under the bar showed page content. Fixes:
   - `.mobile-dock-bar::after` extends the bar background 64px below the viewport;
   - the bar height is `56px + env(safe-area-inset-bottom)` (the global `border-box` reset was eating the inset);
   - `.mobile-dock` is `pointer-events:none` so the collapsed box doesn't block taps.
3. Collapse/expand is animated with CSS transitions only. The bar slides down (0.24s ease-in); the ˄ tab fades and rises in after 0.18s; expanding reverses it (0.28s ease-out). Visibility flips instantly on show so focus can move, and `prefers-reduced-motion` turns the animation off.
4. Character page inline edit (`characterInlineEdit.js`, `overviewView.js`): `fullname_vi`/`nickname_vi` cells are always rendered, with the global `.hidden` class when empty. Edit mode removes `.hidden`, so empty editable fields can be filled (placeholder "Chưa có — nhập để thêm"). Also fixed a pre-existing bug: inputs took their value from the rendered text, so an empty `name_vi` (which displays the CN name) got the CN name as its value, and a save would write it as the Vietnamese name. Inputs now read `char[field]`. Logged out, the page looks as before (verified: the empty nickname cell is hidden).

**Owner-verified 2026-09-24:** the inline edit on the public character page showed the empty "Tên thường gọi" field and saved it. D0183 Huyễn Hý Đồ has `field_overrides.nickname_vi = "cốt"` (active), revision 3, plus one `edit_history` row. `characters.nickname_vi` stays null by design, because that column is the workbook/source baseline. The value does not show on the public site after a reload, since public pages read `public/data.json` and no publish pipeline exists yet (NEXT_STEPS #5).

**Not verified yet.** Logged-in admin at 375 (sheet "Quản trị" group, dock logout) and at 768–1279 (icon column). This needs a temp owner account, i.e. a DB write that needs owner approval.

---

## Part F — Brainstorm: Khí Giả admin (redesign of the Vue Character/Skin CMS) — IN PROGRESS, no code

Classification: **architectural** (replaces a production module, changes how character sub-modules plug in, and is the home of Lore next). Path: questions → approaches → sectioned design → written spec → implementation plan. Currently at "approaches + open questions".

### What exists today (read-only facts)
- `src/admin/character-skin/characterSkinAdminWorkspace.js` — 364-line Vue 3 "god component": index grid of 133 characters → character record with 4 tabs (Tổng quan, Skins, Nguồn, Lịch sử); edits happen in a modal ("Chỉnh sửa override"), one save/discard bar ("Lưu thay đổi" / "Bỏ thay đổi"), optimistic revision + 409 handling; PATCH `/api/admin/characters/:id` and `/api/admin/skins/:id`.
- Editable today: Character `nameVi, fullnameVi, nicknameVi, tagsVi`; Skin `skinNameVi, descriptionVi, obtainVi`. Model = workbook/raw **source value** + optional **override** (`field_overrides`, state active/cleared) — every field shows which one is live.
- Public page also has contextual inline edit for 3 Character fields (`src/features/characters/components/characterInlineEdit.js`).

### What's coming into this workspace (why the design must scale)
- **Lore (next):** `char.profile` = `record_id`, `department`, `staff_status`, `entity_status`, `eval_intro` (long CN), `reports[]` ({id, title, content}, several long CN texts per character), `relic_info` ({relic_name K-code, dynasty T-code, museum S-code, intro long CN}). **0/133 characters have any VI profile text** — this is a large translation job, not a few field fixes. Archive ("hiện vật") images exist per character in `NeoArtifacts/Assets/characters/<ID>/archive/` (not wired anywhere yet; NEXT_STEPS #8 says reuse the managed-asset system).
- Later: skills (Part D translation frame with chips), talents, Hoán Chương, Trí Tri.

### Approaches
1. **Rebuild the current tabs in React (B styling).** Cheapest; parity-first. Weak: tabs don't scale past ~6 modules; modal editing is bad for long text (lore reports are paragraphs).
2. **Module workspace — recommended.** B's list (Khí Giả list, collapsible) + a character record whose left column lists modules (Hồ sơ, Lore, Trang phục, later Kỹ năng/Thiên phú…, Nguồn, Lịch sử). Each module is a self-contained component owned by the Characters domain (`src/features/characters/…` per architecture §5), registered in one array. Editing happens **in place** (no modal) with one dirty/save/409 bar per module. Built on a few shared primitives:
   - `OverridableField` — source value vs override, state, "revert to source" (today's model).
   - `BilingualText` — CN source read-only | VI editable side by side, per-segment status (chưa dịch / nháp / đã duyệt). Lore uses it now; the skill chip editor later is the same primitive plus atomic tokens — so Lore work directly prepares Part D.
   - Shared history + conflict banner.
3. **Translation queue view.** Organize by work item across characters ("12 báo cáo chưa dịch") instead of per character. Very useful for 133 × (intro + reports + relic intro). Best as a *later second view* over approach 2's primitives, deep-linking into the module — not a replacement.

### Decisions this depends on (not UI — must be settled before Lore is built)
- **OPEN DECISION — localization authority** (`WHMX_APP_ARCHITECTURE.md` §12): profile VI text is sourced from the workbook today (`tools/build_web_data.py` reads `profiles` from generated localization). If editors translate lore in Admin, Postgres becomes where lore VI is written → owner must choose: DB becomes the authority for lore (import existing + export/reconcile), or Admin edits are reviewed proposals exported back into the workbook.
- **Publish pipeline** (NEXT_STEPS #5, Hướng B): without it, lore saved in Admin never reaches the public site.
- **Shared renderer rule (LOCKED §6):** Admin preview of lore should reuse the public profile renderer, not a look-alike.
- K/T/S codes (relic name, dynasty, museum) need lookup tables from raw data — resolve from evidence, don't guess (localization evidence rule).

### Open questions (ask one at a time when the brainstorm resumes)
1. ~~Who translates lore, and is there a review step?~~ **Answered 2026-09-24 by the owner: no review step; a save goes straight to done.** Editors translate and save, so no draft/approved states are needed. Keep the plain revision/409 + history.
2. The authority decision above (DB vs workbook-proposals).
3. Granularity: translate each text as one block, or split into paragraphs/sentences with per-segment status?
4. Should archive images be managed inside the Lore module now, or stay a separate later item?
5. Keep the public-page inline edit as a quick-fix path alongside the Admin module?
