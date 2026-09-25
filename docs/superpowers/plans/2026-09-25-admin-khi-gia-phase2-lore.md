# Admin Khí Giả — Phase 2 (known-bug fixes + Lore module + Lore terms + seeds) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 9 known bugs left by phase 1, then let owners/editors translate every character's lore (intro, reports, relic, timeline) and the shared lore terms in the React Khí Giả, with saves reaching the public site through the existing R2 lore publish ~30 s later.

**Architecture:** Server: pure planners in `server/profile/lore-edit.mjs` (tested with `node:test`) decide what a save writes; a thin DB layer `server/profile/lore-admin.mjs` applies them in one transaction (revision check → 409, one `edit_history` row per unit, `lore_publish_state.last_edit_at`); routes go through the existing `api/admin/[...].js` dispatcher (no new Vercel function). Client: the phase-1 editor stack (`useEditor`, drafts, 409, SaveBar) is reused; a Lore module (direction B workbench + C pairs) and a terms page are added under `src/admin/characters/`; a small publish scheduler debounces `POST /api/admin/lore/publish`.

**Tech Stack:** React 19 + TypeScript (`.tsx`/`.mts`), Tailwind v4 with `src/styles/tokens.css` colours, lucide-react, drizzle-orm (postgres-js) on Neon, `node:test`, Playwright/Browser pane for UI checks.

**Spec:** `docs/superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md` (§3 structure, §4 data/API, §5 UI, §7 testing). Visual direction: `docs/admin-redesign/khi-gia-direction.md` (§3 unit list ↔ editor sync, scroll-spy, phone back-to-top). Phase 1 plan (context): `docs/superpowers/plans/2026-09-25-admin-khi-gia-phase1.md`. Handoff: `docs/WHMX_CURRENT_STATE_FINAL_2026-09-25_v2.md` §2 (API facts learned in phase 1).

## Global Constraints

- Code with the `ponytail` skill: reuse before writing, no speculative abstractions, shortest correct diff. Run `ponytail:ponytail-review` after Task 8 and after Task 10.
- TDD: every behaviour change starts with a failing test that you watch fail. Evidence before "done".
- New UI is React + TypeScript; never the bare `hidden` class (use `max-md:hidden` / conditional render); colours only from `src/styles/tokens.css` (as `bg-(--token)` etc.); dark-only; VI text rendered as React text (never `innerHTML`).
- Motion: CSS transitions / View Transitions only (already in place); respect `prefers-reduced-motion`. No GSAP.
- No new file under `api/` (Vercel counts every file as a function; 4 of 12 used). Tests never under `api/`.
- DB: development branch (`.env.local`) for all development and checks. Anything against production runs with `--env-file=.env.production.local` and **only after the owner sees the exact row list and says yes**. Never print secrets.
- Workbook untouched in this plan. Never stage `localization/*`, root scratch files or other people's changes.
- Commit own files when a task is verified; push the branch after each task; push `main` only in Task 11 when the merged result is error-free.
- Scratch files on drive D (`D:\BaiTapCode\WHMX\_claude_scratch\`); delete `%LOCALAPPDATA%\Temp\claude\bash-edit-diff` at the end of each work block.
- Vietnamese UI copy; reply to the owner in Vietnamese (tôi/bạn).
- Local browser checks: `preview_start whmxcalc-vercel-dev` (port 3003; may crash with `0xC0000409` → restart; first API calls take 8–15 s). In the embedded pane set `document.startViewTransition = undefined` and stub `window.confirm` when the pane is not painting (see handoff §4).

## Review Focus

1. **Legacy / source-changed text saved unchanged:** clicking "Dùng bản này" (legacy) or "Giữ bản dịch" (CN changed) and saving must make the unit official (`viOrigin = admin`, `state = ok`) even though the text is identical; saving *without* the click must not (Task 4 test `same text makes a legacy or changed unit official`, Task 7 test `a confirmed field is a change even when the text is identical`).
2. **Emptying a lore unit:** must store `vi = null` and `viOrigin = null` (back to "chưa dịch"; the DB check `profile_texts_vi_origin_pairing` rejects anything else), never `''` (Task 4 test `empty text clears vi and origin`).
3. **Long multi-paragraph reports (≈1,800 chars):** inner line breaks survive save → reload → publish; only leading/trailing whitespace is trimmed; `\r\n` becomes `\n` (Task 4 test `keeps inner line breaks`).
4. **An edit that lands while a publish is running** must still show as unpublished and be published by the next run; a publish whose content is unchanged must clear the "chưa xuất bản" hint (Task 6 tests).
5. **Two people on the same character's lore, different units:** the second save gets 409; after "Tải bản mới" + restore, only the user's own units are dirty, the colleague's text is kept (phase-1 draft logic; Task 8 browser check step, plus Task 1 test `never offers a draft identical to the record`).

---

## File map

| File | Responsibility |
|---|---|
| `src/admin/characters/lib/route.mts` (modify) | + `lore` module, `terms` view (`#/admin/characters/terms[/CODE]`), safe decode |
| `src/admin/characters/lib/shortcut.mts` (+ test) | Ctrl/⌘+S only while Khí Giả is the visible area |
| `src/admin/layout/lib/leaveGuard.mts` (+ test) | when a hash change must ask first |
| `src/admin/characters/lib/fields.mts` (modify) | + `draftToRestore`, `conflictRows`, `confirmed` support in `changesFor` |
| `src/admin/characters/lib/editorState.mts` (modify) | + `edited`, `confirmed`, "saved but stale" |
| `src/admin/characters/useEditor.ts` (modify) | deferred restore prompt, stale-draft clear, reload-failure path, shortcut, `peek` + diff |
| `src/admin/characters/components/ConflictDiff.tsx` | "Xem khác biệt" panel |
| `src/admin/characters/components/Pair.tsx` | shared `PairRow` + `ViCell` (extracted from `OverridableField`) |
| `src/admin/characters/components/BilingualText.tsx` | one lore unit (badges, confirm, fullscreen) |
| `src/admin/characters/components/FullscreenEditor.tsx` | `<dialog>` editor for long reports |
| `src/admin/characters/lib/loreUnits.mts` (+ test) | structure → grouped, labelled unit list |
| `src/admin/characters/lib/listFilter.mts` (+ test) | list search + lore filters |
| `src/admin/characters/lib/publishScheduler.mts` (+ test) | debounced publish with status |
| `src/admin/characters/lorePublish.ts` | the one scheduler instance + `usePublishStatus()` |
| `src/admin/characters/loreApi.js` | lore/terms/progress/publish client |
| `src/admin/characters/modules/LoreModule.tsx` | the Lore module |
| `src/admin/characters/LoreTermsView.tsx` | the terms page |
| `server/profile/lore-edit.mjs` (+ test) | pure planners: unit edit, term edit, progress, usage, previous CN, record shape, archive images |
| `server/profile/lore-admin.mjs` | DB reads/writes for the lore admin API |
| `server/admin-api-routes/lore.mjs` (modify) | lore character / terms / term / progress routes |
| `api/admin/[...].js` (modify) | dispatch the new lore paths |
| `server/profile/lore-repository.mjs`, `lore-publisher.mjs` (+ test) (modify) | REPEATABLE READ; "unchanged" updates state |
| `scripts/lib/lore-seed.mjs` (+ test), `scripts/seed-lore-admin-vi.mjs` | one-time seeds (report titles, organisation names) |
| `server/profile/shape-character-profile.mjs` (+ test) (modify) | v2 department = admin VI else CN (after the seed) |

Run JS tests: `npm test` (globs `scripts/lib/*.test.mjs`, `server/profile/*.test.mjs`, `server/*.test.mjs`, `src/**/*.test.mts`). Typecheck: `node_modules/.bin/tsc -p tsconfig.json --noEmit`. Build: `npm run build` (one npm command at a time, background).

---

### Task 1: Phase-1 known bugs — route, shortcut, drafts, reload failure, restore timing

**Files:** Modify `src/admin/characters/lib/{route,fields,editorState,saveError}.mts` + their tests, `src/admin/characters/useEditor.ts`; Create `src/admin/characters/lib/shortcut.mts` + `shortcut.test.mts`.

**Interfaces — Produces:** `isSaveShortcut(event: {ctrlKey,metaKey,key}, hash: string) → boolean`; `draftToRestore(stored, record, keys) → Record<string,string> | null`; `EditorState` gains `edited: boolean`; `saveFail` with `{ savedButStale: true }` → status `conflict`.

Bugs covered: (1) malformed `%` hash crashed the admin root; (2) Ctrl+S saved the hidden Khí Giả editor from Preview/Accounts, Caps Lock `S` ignored; (3) save OK + reload failed showed "Không thể lưu" and the retry got 409; (4) typing then undoing by hand left a draft → pointless "Khôi phục?"; (7) the restore prompt could fire inside a view-transition update (page frozen on the old snapshot); plus a draft identical to the record is never offered.

- [x] **Step 1: Failing tests**

```ts
// append to src/admin/characters/lib/route.test.mts
test('a malformed %-escape falls back to the list instead of throwing', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters/%E0'), { view: 'list' });
});
```

```ts
// src/admin/characters/lib/shortcut.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSaveShortcut } from './shortcut.mts';

const key = (k: string, mod: 'ctrl' | 'meta' | '' = 'ctrl') => ({ key: k, ctrlKey: mod === 'ctrl', metaKey: mod === 'meta' });
test('Ctrl/⌘+S saves only while Khí Giả is the visible admin area', () => {
  assert.equal(isSaveShortcut(key('s'), '#/admin/characters/A0001'), true);
  assert.equal(isSaveShortcut(key('S'), '#/admin/characters/A0001/lore'), true); // Caps Lock
  assert.equal(isSaveShortcut(key('s', 'meta'), '#/admin/characters'), true);
  assert.equal(isSaveShortcut(key('s'), '#/admin'), false); // Preview open, Khí Giả hidden
  assert.equal(isSaveShortcut(key('s'), '#/admin/accounts'), false);
  assert.equal(isSaveShortcut(key('s', ''), '#/admin/characters/A0001'), false);
});
```

```ts
// append to src/admin/characters/lib/fields.test.mts (add draftToRestore to the import)
test('never offers a draft identical to the record; merges a real one over current values', () => {
  const k = ['nameVi', 'tagsVi'];
  const rec = { nameVi: { value: 'a', source: 'a' }, tagsVi: { value: 't', source: 't' } };
  assert.equal(draftToRestore({ nameVi: 'a' }, rec, k), null);
  assert.equal(draftToRestore(null, rec, k), null);
  assert.deepEqual(draftToRestore({ nameVi: 'mine' }, rec, k), { nameVi: 'mine', tagsVi: 't' });
});
```

```ts
// append to src/admin/characters/lib/editorState.test.mts
test('a save that succeeded but could not reload asks for the new version', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'b' });
  s = editorReducer(s, { type: 'saveFail', error: { savedButStale: true } });
  assert.equal(s.status, 'conflict');
  assert.match(s.message, /Đã lưu/);
  assert.equal(s.draft.nameVi, 'b');
});

test('edited is set by typing and reset by hydrate, saveOk and discard', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'b' });
  assert.equal(s.edited, true);
  assert.equal(editorReducer(s, { type: 'hydrate', draft: { nameVi: 'a' } }).edited, false);
  assert.equal(editorReducer(s, { type: 'saveOk', draft: { nameVi: 'b' } }).edited, false);
  assert.equal(editorReducer(s, { type: 'discard', draft: { nameVi: 'a' } }).edited, false);
});
```

- [x] **Step 2: Run** — `npm test` → the new tests fail (`URIError`, module not found, `draftToRestore` not exported, `edited` undefined, status `error`).

- [x] **Step 3: Implement**

```ts
// src/admin/characters/lib/route.mts — replace parseCharactersRoute's first line
export function parseCharactersRoute(hash: string): CharactersRoute {
  let parts: string[];
  try { parts = hash.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { return { view: 'list' }; }
  const [id, module] = parts;
  if (!id) return { view: 'list' };
  return { view: 'record', id, module: (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : 'overview' };
}
```

```ts
// src/admin/characters/lib/shortcut.mts
const AREA = '#/admin/characters';
// Khí Giả stays mounted (hidden) while Preview/Accounts is open; the shortcut must not save it from there.
export const isSaveShortcut = (e: { ctrlKey: boolean; metaKey: boolean; key: string }, hash: string) =>
  (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && (hash === AREA || hash.startsWith(`${AREA}/`));
```

```ts
// src/admin/characters/lib/fields.mts — append
// The stored draft merged over the record's current values, or null when it changes nothing.
export function draftToRestore(stored: Record<string, string> | null, record: Record<string, unknown>, keys: string[]) {
  if (!stored) return null;
  const merged = { ...Object.fromEntries(keys.map((k) => [k, fieldValue(record, k)])), ...stored };
  return Object.keys(changesFor(merged, record, keys)).length ? merged : null;
}
```

```ts
// src/admin/characters/lib/editorState.mts — state gains `edited`; saveFail knows "saved but stale"
export type EditorState = { draft: Record<string, string>; status: EditorStatus; message: string; source?: unknown; edited: boolean };
export const initialEditor = (draft: Record<string, string>, source?: unknown): EditorState => ({ draft, status: 'idle', message: '', source, edited: false });
// in editorReducer:
//   case 'edit': build `draft`, then return { ...(state.status === 'saved' ? { ...state, status: 'idle', message: '' } : state), draft, edited: true };
//   case 'hydrate': return state.status === 'saved' ? { ...state, draft: action.draft, source: action.source, edited: false } : initialEditor(action.draft, action.source);
//   case 'saveOk': return { ...state, draft: action.draft, status: 'saved', message: 'Đã lưu.', edited: false };
//   case 'saveFail': {
//     const e = action.error as { status?: number; savedButStale?: boolean };
//     const status = e?.status === 409 || e?.savedButStale ? 'conflict' : 'error';
//     return { ...state, status, message: saveErrorMessage(action.error) };
//   }
```

```ts
// src/admin/characters/lib/saveError.mts — first line of saveErrorMessage
if ((error as { savedButStale?: boolean })?.savedButStale) return 'Đã lưu, nhưng chưa tải lại được bản mới. Bấm "Tải bản mới" trước khi sửa tiếp.';
```

```ts
// src/admin/characters/useEditor.ts — the three effects/callbacks that change
import { isSaveShortcut } from './lib/shortcut.mts';
import { changedDraft, changesFor, draftToRestore, fieldValue } from './lib/fields.mts';

useEffect(() => {
  if (!record) return;
  dispatch({ type: 'hydrate', draft: valuesOf(record, keys), source: record });
  const restore = draftToRestore(loadDraft(localStorage, key), record, keys);
  if (!restore) { clearDraft(localStorage, key); return; }
  // Ask after this render has painted (never inside a view-transition update). StrictMode's
  // mount → unmount → mount cancels the first timer, so the question is asked once.
  const timer = setTimeout(() => {
    if (confirm('Có bản nháp chưa lưu. Khôi phục?')) dispatch({ type: 'hydrate', draft: restore, source: record });
    else clearDraft(localStorage, key);
  }, 0);
  return () => clearTimeout(timer);
}, [key, record]); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  if (!synced) return;
  if (dirtyCount) saveDraft(localStorage, key, changedDraft(state.draft, record ?? {}, keys));
  else if (state.edited) clearDraft(localStorage, key); // typed, then undone by hand: nothing to restore
}, [key, state.draft, state.edited, dirtyCount, synced, record, keys]);

const onSave = useCallback(async () => {
  if (!dirtyCount || state.status === 'saving') return;
  dispatch({ type: 'saveStart' });
  try { await save(changes); } catch (error) { dispatch({ type: 'saveFail', error }); return; }
  clearDraft(localStorage, key);
  try { dispatch({ type: 'saveOk', draft: valuesOf(await reload(), keys) }); }
  catch { dispatch({ type: 'saveFail', error: { savedButStale: true } }); }
}, [dirtyCount, state.status, changes, save, reload, key, keys]);

// in the keydown listener:
const onKey = (event: KeyboardEvent) => { if (isSaveShortcut(event, location.hash)) { event.preventDefault(); void onSave(); } };
```

- [x] **Step 4: Verify** — `npm test` all pass; `tsc` clean; `npm run build` passes. Browser (vercel dev, development): open `#/admin/characters/%E0` → list shows, no crash; on A0003 type in a field, open Preview (`#/admin`), press Ctrl+S → no PATCH in `read_network_requests`; type then delete what you typed → `localStorage` has no `whmx:admin-draft:character:A0003`; reload a record with a draft identical to the record → no prompt.
- [x] **Step 5: Commit** — `fix(admin): malformed hash, shortcut scope, stale drafts, reload-after-save failure, deferred restore prompt`.

### Task 2: Leave guard in one place (+ test), dock-collapsed save bar

**Files:** Create `src/admin/layout/lib/leaveGuard.mts` + `leaveGuard.test.mts`; Modify `src/admin/layout/AdminApp.tsx`, `src/admin/characters/CharactersView.tsx`, `src/admin/styles/adminShell.css`.

**Interfaces — Produces:** `mustAskBeforeLeaving(from: string, to: string, dirty: boolean) → boolean`.

Bugs covered: (6) cancelling "Rời trang?" towards a public page could still unmount the editor (AdminApp's listener ran first) and restoring the hash added a history entry (Back looped); (9) the leave guard had no test; (5) with the phone dock collapsed the ˄ tab covered the save bar and the safe-area inset was lost.

- [x] **Step 1: Failing test**

```ts
// src/admin/layout/lib/leaveGuard.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mustAskBeforeLeaving } from './leaveGuard.mts';

test('asks only when leaving a Khí Giả page with unsaved edits', () => {
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin/characters/A0001/skins', true), true);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin', true), true); // to Preview
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/characters', true), true); // to a public page
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin', false), false);
  assert.equal(mustAskBeforeLeaving('#/admin/characters/A0001', '#/admin/characters/A0001', true), false);
  assert.equal(mustAskBeforeLeaving('#/admin', '#/admin/accounts', true), false);
});
```

- [x] **Step 2: Run** — `npm test` → fails (module not found).
- [x] **Step 3: Implement**

```ts
// src/admin/layout/lib/leaveGuard.mts
const AREA = '#/admin/characters';
const inArea = (hash: string) => hash === AREA || hash.startsWith(`${AREA}/`);
// Khí Giả is the only admin area with unsaved editor state.
export const mustAskBeforeLeaving = (from: string, to: string, dirty: boolean) => dirty && from !== to && inArea(from);
```

In `AdminApp.tsx` add (once, at the top of the component's effects):

```tsx
useEffect(() => {
  let last = location.hash;
  // Capture listener on window: at the target, capture listeners run before every other hashchange
  // listener (AdminApp's own, CharactersView, the public router), so a "stay" leaves nothing half-switched.
  const guard = (event: HashChangeEvent) => {
    if (mustAskBeforeLeaving(last, location.hash, Boolean((window as { __whmxAdminDirty?: boolean }).__whmxAdminDirty))
      && !confirm('Có thay đổi chưa lưu. Rời trang?')) {
      event.stopImmediatePropagation();
      history.replaceState(null, '', last); // back, without a new history entry or another hashchange
      return;
    }
    last = location.hash;
  };
  addEventListener('hashchange', guard, { capture: true });
  return () => removeEventListener('hashchange', guard, { capture: true });
}, []);
```

In `CharactersView.tsx` delete the `confirm`/`location.hash = last` block (the guard owns it); the listener keeps only: ignore non-Khí-Giả hashes, parse, `startViewTransition`.

In `adminShell.css`:

```css
/* Collapsed dock: only the ˄ tab remains (32 px tall, 8 px above the bottom + safe area); keep the save bar above it. */
body.mobile-dock-collapsed .admin-react-root { --admin-dock: calc(48px + env(safe-area-inset-bottom, 0px)); }
```
(replaces the `--admin-dock: 0px` rule).

- [x] **Step 4: Verify** — `npm test`, `tsc`, build. Browser: dirty A0003 → click the rail's Characters link (public) → stub `confirm` to return false → hash back to the record, editor still mounted with the typed text, `history.length` unchanged; same with Preview; with `true` it leaves. Mobile preset: collapse the dock (˅) → save bar bottom = window height − 48 px, ˄ tab below it, not overlapping.
- [x] **Step 5: Commit** — `fix(admin): one capture-phase leave guard (tested); save bar above the collapsed dock`.

### Task 3: 409 "Xem khác biệt"

**Files:** Modify `src/admin/characters/lib/fields.mts` + test, `useEditor.ts`, `components/SaveBar.tsx`, `modules/OverviewModule.tsx`, `modules/SkinsModule.tsx`; Create `components/ConflictDiff.tsx`.

**Interfaces — Produces:** `conflictRows(draft, base, fresh, keys) → { key, base, theirs, yours }[]`; `useEditor` accepts `peek?: () => Promise<Rec | null>` and returns `diff`, `onShowDiff`, `onHideDiff`; `SaveBar` accepts `onShowDiff?`, `diff?`, `labels?`, `onHideDiff?`.

Spec §5: "409 keeps what the user typed and offers 'load the new version (yours stays in the draft)' or 'show differences'" — the second option was missing.

- [x] **Step 1: Failing test**

```ts
// append to fields.test.mts (add conflictRows to the import)
test('after a 409, lists each field you changed with what the other person saved', () => {
  const k = ['nameVi', 'tagsVi'];
  const base = { nameVi: { value: 'a', source: 'a' }, tagsVi: { value: 't', source: 't' } };
  const fresh = { nameVi: { value: 'theirs', source: 'a' }, tagsVi: { value: 't2', source: 't' } };
  assert.deepEqual(conflictRows({ nameVi: 'mine', tagsVi: 't' }, base, fresh, k), [{ key: 'nameVi', base: 'a', theirs: 'theirs', yours: 'mine' }]);
});
```

- [x] **Step 2: Run** — fails (not exported).
- [x] **Step 3: Implement**

```ts
// fields.mts — append
// For a 409: every field the user changed, with the value they started from and what is saved now.
export const conflictRows = (draft: Record<string, string>, base: Record<string, unknown>, fresh: Record<string, unknown>, keys: string[]) =>
  Object.keys(changesFor(draft, base, keys)).map((key) => ({ key, base: fieldValue(base, key), theirs: fieldValue(fresh, key), yours: draft[key] ?? '' }));
```

```ts
// useEditor.ts — new arg `peek`, local state for the diff
const [diff, setDiff] = useState<ReturnType<typeof conflictRows> | null>(null);
const onShowDiff = peek ? async () => setDiff(conflictRows(state.draft, record ?? {}, (await peek()) ?? {}, keys)) : undefined;
// clear it whenever the record changes (inside the hydrate effect): setDiff(null);
// return { ..., diff, onShowDiff, onHideDiff: () => setDiff(null) };
```

```tsx
// components/ConflictDiff.tsx
type Row = { key: string; base: string; theirs: string; yours: string };
export function ConflictDiff({ rows, labels, onClose }: { rows: Row[]; labels: Record<string, string>; onClose: () => void }) {
  return (
    <section aria-label="Khác biệt" className="max-h-[50vh] overflow-y-auto border-t border-(--border-color) bg-(--bg-elevated) px-4 py-3 text-[13px] md:px-5">
      <div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Khác biệt với bản vừa được lưu</h3><button type="button" onClick={onClose} className="text-(--text-muted) hover:text-(--text-main)">Đóng</button></div>
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1 border-t border-(--border-color) py-2 first:border-t-0 md:grid-cols-[160px_1fr_1fr] md:gap-4">
          <span className="text-(--text-muted)">{labels[r.key] ?? r.key}{r.theirs !== r.base && <span className="ml-2 text-(--rarity-ssr-text)">cả hai cùng sửa</span>}</span>
          <p className="whitespace-pre-line"><span className="block text-xs text-(--text-subtle)">Đang lưu trên máy chủ</span>{r.theirs || '∅'}</p>
          <p className="whitespace-pre-line"><span className="block text-xs text-(--text-subtle)">Bạn đang gõ</span>{r.yours || '∅'}</p>
        </div>
      ))}
    </section>
  );
}
```

`SaveBar`: when `status === 'conflict' && onShowDiff`, add a `Button` "Xem khác biệt" next to "Tải bản mới"; render `diff && <ConflictDiff rows={diff} labels={labels ?? {}} onClose={onHideDiff} />` directly above the bar (wrap bar + panel in one element that carries the fixed/static positioning). Overview passes `peek={() => getCharacter(id).then((d) => d.character)}` and labels from `FIELDS`; Skins passes `peek={() => getSkin(skinId).then((d) => d.skin)}` and its labels.

- [x] **Step 4: Verify** — tests/tsc/build. Browser (development): make a 409 as in phase 1 (concurrent `PATCH` via `fetch` on another field and on the same field) → "Xem khác biệt" lists only your field; same-field case shows "cả hai cùng sửa". Clean up the test values afterwards (send source values).
- [x] **Step 5: Commit** — `feat(admin): 409 shows the differences`. Update `docs/WHMX_CURRENT_STATE_FINAL_2026-09-25_v2.md` §3 item 5 ("Deferred minors") → "fixed in phase 2 Tasks 1–3".

### Task 4: Lore server planners (pure)

**Files:** Create `server/profile/lore-edit.mjs`, `server/profile/lore-edit.test.mjs`.

**Interfaces — Produces:**
- `cleanVi(value) → string | null` (CRLF→LF, trim ends, empty → null)
- `planLoreTextEdit(units, texts) → { writes: {id, unitKey, before, after}[] } | { error: 'UNKNOWN_UNIT', unknown: string[] }`
- `planTermEdit(term, { nameVi, detailVi }) → { write: {before, after} | null }`
- `loreProgress(rows) → Record<characterId, { total, done, legacy, changed }>`
- `termUsage(profiles) → Record<code, characterId[]>`
- `previousCnByUnit(history) → Record<unitKey, string>`
- `archiveImagesFor(manifest, characterId) → { url, width, height }[]`
- `shapeLoreRecord({ characterId, revision, profile, texts, terms, history, archiveImages }) → LoreRecord` (see code)

- [x] **Step 1: Failing tests**

```js
// server/profile/lore-edit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveImagesFor, cleanVi, loreProgress, planLoreTextEdit, planTermEdit, previousCnByUnit, shapeLoreRecord, termUsage } from './lore-edit.mjs';

const unit = (unitKey, vi = null, viOrigin = null, state = 'ok') => ({ id: `id-${unitKey}`, unitKey, vi, viOrigin, state });

test('keeps inner line breaks; trims ends; CRLF becomes LF; empty is null', () => {
  assert.equal(cleanVi('  a\r\n\r\nb  '), 'a\n\nb');
  assert.equal(cleanVi('   '), null);
  assert.equal(cleanVi(null), null);
});

test('an unknown unit key is rejected, nothing is written', () => {
  assert.deepEqual(planLoreTextEdit([unit('card_intro')], { nope: 'x' }), { error: 'UNKNOWN_UNIT', unknown: ['nope'] });
});

test('new text becomes an official admin translation', () => {
  const { writes } = planLoreTextEdit([unit('card_intro')], { card_intro: ' Xin chào ' });
  assert.deepEqual(writes, [{ id: 'id-card_intro', unitKey: 'card_intro', before: { vi: null, viOrigin: null, state: 'ok' }, after: { vi: 'Xin chào', viOrigin: 'admin', state: 'ok' } }]);
});

test('same text makes a legacy or changed unit official; an official unit with the same text is skipped', () => {
  const units = [unit('a', 'x', 'legacy_workbook'), unit('b', 'y', 'admin', 'source_changed'), unit('c', 'z', 'admin')];
  const { writes } = planLoreTextEdit(units, { a: 'x', b: 'y', c: 'z' });
  assert.deepEqual(writes.map((w) => [w.unitKey, w.after.viOrigin, w.after.state]), [['a', 'admin', 'ok'], ['b', 'admin', 'ok']]);
});

test('empty text clears vi and origin (back to "chưa dịch")', () => {
  const { writes } = planLoreTextEdit([unit('a', 'x', 'admin')], { a: '' });
  assert.deepEqual(writes[0].after, { vi: null, viOrigin: null, state: 'ok' });
  assert.deepEqual(planLoreTextEdit([unit('a')], { a: null }).writes, []);
});

test('term edit: both empty clears the origin; same official values are skipped', () => {
  const term = { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' };
  assert.deepEqual(planTermEdit(term, { nameVi: ' Thanh ', detailVi: '' }).write.after, { nameVi: 'Thanh', detailVi: null, viOrigin: 'admin', state: 'ok' });
  const official = { nameVi: 'Thanh', detailVi: null, viOrigin: 'admin', state: 'ok' };
  assert.equal(planTermEdit(official, { nameVi: 'Thanh', detailVi: null }).write, null);
  assert.deepEqual(planTermEdit(official, { nameVi: '', detailVi: '' }).write.after, { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' });
});

test('progress counts done, legacy and CN-changed per character', () => {
  const rows = [
    { characterId: 'A1', vi: 'x', viOrigin: 'admin', state: 'ok' },
    { characterId: 'A1', vi: 'y', viOrigin: 'legacy_workbook', state: 'ok' },
    { characterId: 'A1', vi: 'z', viOrigin: 'admin', state: 'source_changed' },
    { characterId: 'A1', vi: null, viOrigin: null, state: 'ok' },
  ];
  assert.deepEqual(loreProgress(rows), { A1: { total: 4, done: 1, legacy: 1, changed: 1 } });
});

test('term usage covers organisation, relic codes and affinity levels', () => {
  const p = { characterId: 'A1', organisationCode: '3', relicTypeCode: 'K1', eraCode: 'T2', museumCode: null, eraRangeCode: null,
    structure: { reports: [{ kind: 'basic', unlock: { type: 2, elementId: '4' } }, { kind: 'special', unlock: { type: 3, elementId: '9' } }] } };
  assert.deepEqual(termUsage([p, { ...p, characterId: 'A2', relicTypeCode: null }]), {
    ORG_3: ['A1', 'A2'], K1: ['A1'], T2: ['A1', 'A2'], AFFINITY_4: ['A1', 'A2'],
  });
});

test('previous CN comes from the newest source import of that unit', () => {
  const h = [
    { fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: 'new-old' }, editedAt: '2026-09-25T10:00:00Z' },
    { fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: 'old-old' }, editedAt: '2026-09-20T10:00:00Z' },
    { fieldName: 'card_intro', eventType: 'human_edit', oldValue: { vi: 'x' }, editedAt: '2026-09-26T10:00:00Z' },
  ];
  assert.deepEqual(previousCnByUnit(h), { card_intro: 'new-old' });
});

test('archive images come from the publish manifest, main image first', () => {
  const manifest = { public_base_url: 'https://cdn.example', assets: {
    'characters/a0001/archives/head_a0001.webp': { key: 'characters/a0001/archives/head_a0001.webp', character_id: 'A0001', category: 'archive', width: 128, height: 124 },
    'characters/a0001/archives/a0001.webp': { key: 'characters/a0001/archives/a0001.webp', character_id: 'A0001', category: 'archive', width: 505, height: 481 },
    'characters/a0001/cards/a0001.webp': { key: 'characters/a0001/cards/a0001.webp', character_id: 'A0001', category: 'card', width: 1, height: 1 },
  } };
  assert.deepEqual(archiveImagesFor(manifest, 'A0001'), [
    { url: 'https://cdn.example/characters/a0001/archives/a0001.webp', width: 505, height: 481 },
    { url: 'https://cdn.example/characters/a0001/archives/head_a0001.webp', width: 128, height: 124 },
  ]);
});

test('the lore record lists present units with previous CN only for changed ones, and resolves terms', () => {
  const terms = new Map([['K1', { code: 'K1', kind: 'relic_type', nameCn: '金银器', nameVi: null, viOrigin: null, state: 'ok' }]]);
  const profile = { organisationCode: null, relicTypeCode: 'K1', eraCode: null, museumCode: null, eraRangeCode: null,
    legacyRelicFields: { hasEntry: true }, structure: { reports: [], timeline: [] } };
  const texts = [
    { unitKey: 'card_intro', sourceCn: '新', vi: 'x', viOrigin: 'admin', state: 'source_changed', sourcePresent: true },
    { unitKey: 'relic_intro', sourceCn: '甲', vi: null, viOrigin: null, state: 'ok', sourcePresent: true },
    { unitKey: 'gone', sourceCn: '乙', vi: null, viOrigin: null, state: 'ok', sourcePresent: false },
  ];
  const history = [{ fieldName: 'card_intro', eventType: 'source_import', oldValue: { sourceCn: '旧' }, editedAt: '2026-09-25T00:00:00Z' }];
  const r = shapeLoreRecord({ characterId: 'A1', revision: 3, profile, texts, terms, history, archiveImages: [] });
  assert.deepEqual(r.units.map((u) => [u.unitKey, u.previousCn]), [['card_intro', '旧'], ['relic_intro', null]]);
  assert.deepEqual(r.relic.type, { code: 'K1', kind: 'relic_type', nameCn: '金银器', nameVi: null, official: false });
  assert.equal(r.relic.era, null);
  assert.equal(r.revision, 3);
});
```

- [x] **Step 2: Run** — `node --test server/profile/lore-edit.test.mjs` → fails (module not found).
- [x] **Step 3: Implement**

```js
// server/profile/lore-edit.mjs
// Pure: what a lore or lore-term save writes, and the shapes the lore admin API returns.
// The DB layer (lore-admin.mjs) applies these inside one transaction.

// Inner line breaks are part of the text (reports are multi-paragraph); only the ends are trimmed.
export function cleanVi(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n?/g, '\n').trim();
  return text || null;
}

const official = (row) => row.viOrigin === 'admin' && row.state === 'ok';

export function planLoreTextEdit(units, texts) {
  const byKey = new Map(units.map((u) => [u.unitKey, u]));
  const unknown = Object.keys(texts).filter((k) => !byKey.has(k));
  if (unknown.length) return { error: 'UNKNOWN_UNIT', unknown };
  const writes = [];
  for (const [unitKey, raw] of Object.entries(texts)) {
    const row = byKey.get(unitKey);
    const vi = cleanVi(raw);
    // The same text is still a write when it makes a legacy or CN-changed unit official.
    if (vi === row.vi && (vi === null || official(row))) continue;
    writes.push({
      id: row.id, unitKey,
      before: { vi: row.vi, viOrigin: row.viOrigin, state: row.state },
      after: { vi, viOrigin: vi === null ? null : 'admin', state: 'ok' },
    });
  }
  return { writes };
}

export function planTermEdit(term, input) {
  const nameVi = cleanVi(input.nameVi);
  const detailVi = cleanVi(input.detailVi);
  const empty = nameVi === null && detailVi === null;
  if (nameVi === term.nameVi && detailVi === term.detailVi && (empty || official(term))) return { write: null };
  return {
    write: {
      before: { nameVi: term.nameVi, detailVi: term.detailVi, viOrigin: term.viOrigin, state: term.state },
      after: { nameVi, detailVi, viOrigin: empty ? null : 'admin', state: 'ok' },
    },
  };
}

export function loreProgress(rows) {
  const out = {};
  for (const r of rows) {
    const p = (out[r.characterId] ??= { total: 0, done: 0, legacy: 0, changed: 0 });
    p.total += 1;
    if (r.state === 'source_changed') p.changed += 1;
    else if (r.viOrigin === 'admin' && r.vi) p.done += 1;
    else if (r.viOrigin === 'legacy_workbook') p.legacy += 1;
  }
  return out;
}

export function termUsage(profiles) {
  const usage = new Map();
  const add = (code, id) => { if (code) usage.set(code, (usage.get(code) ?? new Set()).add(id)); };
  for (const p of profiles) {
    add(p.organisationCode ? `ORG_${p.organisationCode}` : null, p.characterId);
    for (const code of [p.relicTypeCode, p.eraCode, p.museumCode, p.eraRangeCode]) add(code, p.characterId);
    for (const r of p.structure?.reports ?? []) if (r.kind === 'basic' && r.unlock?.type === 2) add(`AFFINITY_${r.unlock.elementId}`, p.characterId);
  }
  return Object.fromEntries([...usage].map(([code, ids]) => [code, [...ids].sort()]));
}

export function previousCnByUnit(history) {
  const out = {};
  const imports = history.filter((h) => h.eventType === 'source_import' && h.oldValue?.sourceCn != null)
    .sort((a, b) => String(b.editedAt).localeCompare(String(a.editedAt)));
  for (const h of imports) out[h.fieldName] ??= h.oldValue.sourceCn;
  return out;
}

export function archiveImagesFor(manifest, characterId) {
  const base = String(manifest.public_base_url || '').replace(/\/$/, '');
  return Object.values(manifest.assets || {})
    .filter((a) => a.category === 'archive' && a.character_id === characterId)
    .sort((a, b) => Number(a.key.includes('/head_')) - Number(b.key.includes('/head_')) || a.key.localeCompare(b.key))
    .map((a) => ({ url: `${base}/${a.key}`, width: a.width, height: a.height }));
}

const termView = (terms, code) => {
  const t = code ? terms.get(code) : null;
  return t ? { code: t.code, kind: t.kind, nameCn: t.nameCn, nameVi: t.nameVi, official: official(t) } : null;
};

export function shapeLoreRecord({ characterId, revision, profile, texts, terms, history, archiveImages }) {
  const previous = previousCnByUnit(history);
  const basicUnlocks = profile.structure.reports.filter((r) => r.kind === 'basic' && r.unlock?.type === 2);
  return {
    characterId,
    revision,
    structure: profile.structure,
    units: texts.filter((t) => t.sourcePresent).map((t) => ({
      unitKey: t.unitKey, sourceCn: t.sourceCn, vi: t.vi, viOrigin: t.viOrigin, state: t.state,
      previousCn: t.state === 'source_changed' ? previous[t.unitKey] ?? null : null,
    })),
    organisation: termView(terms, profile.organisationCode ? `ORG_${profile.organisationCode}` : null),
    relic: profile.legacyRelicFields?.hasEntry ? {
      type: termView(terms, profile.relicTypeCode), era: termView(terms, profile.eraCode),
      museum: termView(terms, profile.museumCode), eraRange: termView(terms, profile.eraRangeCode),
    } : null,
    affinity: Object.fromEntries(basicUnlocks.map((r) => [r.unlock.elementId, termView(terms, `AFFINITY_${r.unlock.elementId}`)])),
    archiveImages,
    history,
  };
}
```

- [x] **Step 4: Run** — `npm test` → all pass.
- [x] **Step 5: Commit** — `feat(lore): pure planners for lore/term saves, progress, usage and the admin record`.

### Task 5: Lore admin API (DB layer + routes)

**Files:** Create `server/profile/lore-admin.mjs`; Modify `server/admin-api-routes/lore.mjs`, `api/admin/[...].js`.

**Interfaces — Consumes:** Task 4. **Produces (HTTP):**
- `GET /api/admin/lore/characters/:id` → `LoreRecord` (Task 4 `shapeLoreRecord`); 404 if the character has no present profile.
- `PATCH /api/admin/lore/characters/:id` body `{ expectedRevision: number, texts: Record<unitKey, string|null>, requestId?: uuid }` → `{ revision, changed }`; 409 `VERSION_CONFLICT`; 422 `UNKNOWN_UNIT` / `VALIDATION_ERROR`.
- `GET /api/admin/lore/terms` → `{ terms: { code, kind, nameCn, detailCn, nameVi, detailVi, viOrigin, state, revision, usedBy: string[] }[] }` (sorted by kind, code).
- `PATCH /api/admin/lore/terms/:code` body `{ expectedRevision, nameVi: string|null, detailVi: string|null, requestId? }` → `{ revision, changed }`; 409; 404.
- `GET /api/admin/lore/progress` → `{ progress: Record<characterId, {total, done, legacy, changed}> }`.

- [x] **Step 1: Implement the DB layer** (DB code is verified against the development branch in Step 3; its decisions are the Task 4 planners)

```js
// server/profile/lore-admin.mjs
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';

import manifest from '../../asset-publish-manifest.json' with { type: 'json' };
import { characters } from '../../db/schema/character-skin.mjs';
import { editHistory, managedEntities } from '../../db/schema/core.mjs';
import { characterProfiles, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { AdminApiError } from '../admin-api.mjs';
import { archiveImagesFor, loreProgress, planLoreTextEdit, planTermEdit, shapeLoreRecord, termUsage } from './lore-edit.mjs';
import { createLoreRepository } from './lore-repository.mjs';

async function profileOf(tx, characterId) {
  const [row] = await tx.select({ profile: characterProfiles, revision: managedEntities.revision })
    .from(characterProfiles)
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .innerJoin(managedEntities, eq(managedEntities.id, characterProfiles.entityId))
    .where(and(eq(characters.characterId, String(characterId || '')), eq(characterProfiles.sourcePresent, true)));
  if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'No lore for this character.');
  return row;
}

async function bumpRevision(tx, entityId, expectedRevision, actorUserId, now) {
  const [row] = await tx.update(managedEntities)
    .set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now, editedByUserId: actorUserId })
    .where(and(eq(managedEntities.id, entityId), eq(managedEntities.revision, expectedRevision)))
    .returning({ revision: managedEntities.revision });
  if (!row) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
  return row.revision;
}

export async function getLoreRecord(db, characterId) {
  const { profile, revision } = await profileOf(db, characterId);
  const texts = await db.select().from(profileTexts).where(eq(profileTexts.profileEntityId, profile.entityId));
  const terms = new Map((await db.select().from(loreTerms)).map((t) => [t.code, t]));
  const history = await db.select({ id: editHistory.id, fieldName: editHistory.fieldName, eventType: editHistory.eventType, oldValue: editHistory.oldValue, newValue: editHistory.newValue, actorUserId: editHistory.actorUserId, editedAt: editHistory.editedAt })
    .from(editHistory).where(eq(editHistory.entityId, profile.entityId)).orderBy(desc(editHistory.editedAt)).limit(200);
  return shapeLoreRecord({ characterId, revision, profile, texts, terms, history, archiveImages: archiveImagesFor(manifest, characterId) });
}

export async function saveLoreTexts(db, characterId, { expectedRevision, texts, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const { profile, revision } = await profileOf(tx, characterId);
    if (revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const units = await tx.select().from(profileTexts).where(and(eq(profileTexts.profileEntityId, profile.entityId), eq(profileTexts.sourcePresent, true)));
    const plan = planLoreTextEdit(units, texts);
    if (plan.error) throw new AdminApiError(422, plan.error, plan.unknown.join(', '));
    if (!plan.writes.length) return { revision, changed: false };
    for (const w of plan.writes) {
      await tx.update(profileTexts).set({ ...w.after, viUpdatedByUserId: actorUserId, viUpdatedAt: now, updatedAt: now }).where(eq(profileTexts.id, w.id));
    }
    const next = await bumpRevision(tx, profile.entityId, expectedRevision, actorUserId, now);
    await tx.insert(editHistory).values(plan.writes.map((w) => ({
      changeGroupId: requestId, requestId, entityId: profile.entityId, entityType: 'character_profile',
      fieldName: w.unitKey, eventType: 'human_edit', oldValue: w.before, newValue: w.after, actorUserId,
    })));
    await createLoreRepository(db).writeState(tx, { lastEditAt: now });
    return { revision: next, changed: true };
  });
}

export async function listLoreTerms(db) {
  const rows = await db.select({ term: loreTerms, revision: managedEntities.revision })
    .from(loreTerms).innerJoin(managedEntities, eq(managedEntities.id, loreTerms.entityId));
  const profiles = await db.select({ characterId: characters.characterId, organisationCode: characterProfiles.organisationCode, relicTypeCode: characterProfiles.relicTypeCode, eraCode: characterProfiles.eraCode, museumCode: characterProfiles.museumCode, eraRangeCode: characterProfiles.eraRangeCode, structure: characterProfiles.structure })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId)).where(eq(characterProfiles.sourcePresent, true));
  const usage = termUsage(profiles);
  return rows
    .map(({ term: t, revision }) => ({ code: t.code, kind: t.kind, nameCn: t.nameCn, detailCn: t.detailCn, nameVi: t.nameVi, detailVi: t.detailVi, viOrigin: t.viOrigin, state: t.state, revision, usedBy: usage[t.code] ?? [] }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code));
}

export async function saveLoreTerm(db, code, { expectedRevision, nameVi, detailVi, actorUserId, requestId = randomUUID(), now = new Date() }) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ term: loreTerms, revision: managedEntities.revision })
      .from(loreTerms).innerJoin(managedEntities, eq(managedEntities.id, loreTerms.entityId)).where(eq(loreTerms.code, String(code || '')));
    if (!row) throw new AdminApiError(404, 'NOT_FOUND', 'Unknown term.');
    if (row.revision !== expectedRevision) throw new AdminApiError(409, 'VERSION_CONFLICT', 'Someone else saved first.');
    const { write } = planTermEdit(row.term, { nameVi, detailVi });
    if (!write) return { revision: row.revision, changed: false };
    await tx.update(loreTerms).set({ ...write.after, viUpdatedByUserId: actorUserId, viUpdatedAt: now, updatedAt: now }).where(eq(loreTerms.entityId, row.term.entityId));
    const next = await bumpRevision(tx, row.term.entityId, expectedRevision, actorUserId, now);
    await tx.insert(editHistory).values({ changeGroupId: requestId, requestId, entityId: row.term.entityId, entityType: 'lore_term', fieldName: 'name_detail_vi', eventType: 'human_edit', oldValue: write.before, newValue: write.after, actorUserId });
    await createLoreRepository(db).writeState(tx, { lastEditAt: now });
    return { revision: next, changed: true };
  });
}

export async function getLoreProgress(db) {
  const rows = await db.select({ characterId: characters.characterId, vi: profileTexts.vi, viOrigin: profileTexts.viOrigin, state: profileTexts.state })
    .from(profileTexts)
    .innerJoin(characterProfiles, eq(characterProfiles.entityId, profileTexts.profileEntityId))
    .innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .where(and(eq(profileTexts.sourcePresent, true), eq(characterProfiles.sourcePresent, true)));
  return loreProgress(rows);
}
```

Routes (append to `server/admin-api-routes/lore.mjs`; same pattern as `lorePublish`):

```js
const textsBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), texts: z.record(z.string(), z.string().max(20_000).nullable()), requestId: z.string().uuid().optional() });
const termBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), nameVi: z.string().max(500).nullable(), detailVi: z.string().max(20_000).nullable(), requestId: z.string().uuid().optional() });

async function withAdmin(request, response, methods, handle) {
  if (!methods.includes(request.method)) {
    response.setHeader('Allow', methods.join(', '));
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [api, { getDb }, lore, { z }] = await Promise.all([import('../admin-api.mjs'), import('../../db/client.mjs'), import('../profile/lore-admin.mjs'), import('zod')]);
    const user = await api.authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    return await handle({ api, db: getDb(), lore, z, user });
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export const loreCharacter = (request, response) => withAdmin(request, response, ['GET', 'PATCH'], async ({ api, db, lore, z, user }) => {
  const id = request.query.characterId;
  if (request.method === 'GET') return response.status(200).json(await lore.getLoreRecord(db, id));
  const body = textsBody(z).parse(await api.requestBody(request));
  return response.status(200).json(await lore.saveLoreTexts(db, id, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
});
export const loreTerms = (request, response) => withAdmin(request, response, ['GET'], async ({ db, lore }) =>
  response.status(200).json({ terms: await lore.listLoreTerms(db) }));
export const loreTerm = (request, response) => withAdmin(request, response, ['PATCH'], async ({ api, db, lore, z, user }) => {
  const body = termBody(z).parse(await api.requestBody(request));
  return response.status(200).json(await lore.saveLoreTerm(db, request.query.code, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
});
export const loreProgress = (request, response) => withAdmin(request, response, ['GET'], async ({ db, lore }) =>
  response.status(200).json({ progress: await lore.getLoreProgress(db) }));
```

Dispatcher `case 'lore'` in `api/admin/[...].js`:

```js
case 'lore': {
  const lore = await import('../../server/admin-api-routes/lore.mjs');
  if (rest.length === 1 && rest[0] === 'publish') return lore.lorePublish(request, response);
  if (rest.length === 1 && rest[0] === 'progress') return lore.loreProgress(request, response);
  if (rest.length === 1 && rest[0] === 'terms') return lore.loreTerms(request, response);
  if (rest.length === 2 && rest[0] === 'terms') { request.query.code = rest[1]; return lore.loreTerm(request, response); }
  if (rest.length === 2 && rest[0] === 'characters') { request.query.characterId = rest[1]; return lore.loreCharacter(request, response); }
  return response.status(404).json({ error: { code: 'NOT_FOUND' } });
}
```

- [x] **Step 2: Unit check** — `npm test` still green; `node -e "import('./server/profile/lore-admin.mjs').then(()=>console.log('ok'))"` with `.env.local` loaded (`node --env-file=.env.local -e ...`) → `ok` (the JSON import attribute works on Node 24).
- [x] **Step 3: Integration on the development branch** (`vercel dev`, owner signed in; in the page console):
  - `await (await fetch('/api/admin/lore/characters/A0144')).json()` → 14 units, `relic.type.nameCn === '金银器'`, `archiveImages[0].url` ends `/archives/a0144.webp` and loads (200).
  - PATCH `card_intro` with a two-paragraph text (`'Dòng 1\n\nDòng 2'`) → `{changed:true}`; GET → `vi` keeps `\n\n`; `GET /api/admin/lore/publish` → `hasUnpublishedChanges: true`.
  - PATCH again with the old `expectedRevision` → 409; PATCH `{ nope: 'x' }` → 422 `UNKNOWN_UNIT`.
  - PATCH `card_intro: ''` → back to `vi: null, viOrigin: null`. Restore the unit's original value (legacy units: send their legacy text only if the owner wants it official — otherwise leave it as found; note what you changed in the log).
  - `GET /api/admin/lore/terms` → 139 terms, `ORG_*` with `usedBy` lengths summing to the characters that have an organisation; `GET /api/admin/lore/progress` → 133 keys.
  - Anonymous (other browser/incognito) `GET /api/admin/lore/progress` → 401.
- [x] **Step 4: Commit** — `feat(lore): lore admin API — record, unit save, terms, term save, progress (no new function)`. Log in the pipeline plan.

Ruling carried from phase-1 review item #7 (import plan computed outside the transaction): not changed — the importer's patches never include `vi`/`viOrigin` (see `scripts/lib/profile-import-plan.mjs`), so a concurrent Admin save is never overwritten.

### Task 6: Publishing — consistent snapshot, "unchanged" clears the hint, client scheduler

**Files:** Modify `server/profile/lore-repository.mjs`, `server/profile/lore-publisher.mjs` + `lore-publisher.test.mjs`; Create `src/admin/characters/lib/publishScheduler.mts` + test, `src/admin/characters/lorePublish.ts`, `src/admin/characters/loreApi.js`.

**Interfaces — Produces:** `createPublishScheduler({ delayMs, publish, onStatus, timers? }) → { schedule(): void; now(): void }`; `PublishStatus = { state: 'idle'|'waiting'|'publishing'|'done'|'error'; message: string }`; `lorePublisher` (singleton) + `usePublishStatus(): PublishStatus`; `loreApi`: `getLore(id)`, `patchLore(id, { expectedRevision, texts })`, `getLoreProgress()`, `getLoreTerms()`, `patchLoreTerm(code, { expectedRevision, nameVi, detailVi })`, `publishLore()`.

- [x] **Step 1: Failing tests**

```js
// lore-publisher.test.mjs — replace the 'unchanged content writes only the backup' test
test('unchanged content writes the backup and marks the live file current (clears the unpublished hint)', async () => {
  const first = fakes();
  const { file } = await publishLore({ repo: first.repo, storage: first.storage, now });
  const f = fakes({ publishedHash: first.getState().publishedHash, livePointerFile: file });
  assert.equal((await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u2', now })).status, 'unchanged');
  assert.deepEqual(f.writes.map((w) => w[0]), ['backup', 'state']);
  assert.equal(f.getState().publishedAt, now);
});
```

```ts
// src/admin/characters/lib/publishScheduler.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublishScheduler, type PublishStatus } from './publishScheduler.mts';

function fakeTimers() {
  const pending = new Map<number, () => void>(); let id = 0;
  return { set: (fn: () => void) => { pending.set(++id, fn); return id; }, clear: (t: unknown) => void pending.delete(t as number), flush: async () => { const fns = [...pending.values()]; pending.clear(); for (const fn of fns) fn(); await new Promise((r) => setImmediate(r)); } };
}

test('debounces saves into one publish and reports status', async () => {
  const timers = fakeTimers(); const seen: PublishStatus['state'][] = []; let calls = 0;
  const s = createPublishScheduler({ delayMs: 30_000, publish: async () => { calls += 1; }, onStatus: (st) => seen.push(st.state), timers });
  s.schedule(); s.schedule();
  await timers.flush();
  assert.equal(calls, 1);
  assert.deepEqual(seen, ['waiting', 'waiting', 'publishing', 'done']);
});

test('a busy publish (409) is retried after the delay; other failures report an error', async () => {
  const timers = fakeTimers(); const seen: string[] = []; let calls = 0;
  const s = createPublishScheduler({ delayMs: 30_000, publish: async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('busy'), { status: 409 }); if (calls === 2) throw new Error('R2'); }, onStatus: (st) => seen.push(st.state), timers });
  s.now(); await timers.flush(); await timers.flush();
  assert.equal(calls, 2);
  assert.deepEqual(seen, ['publishing', 'waiting', 'publishing', 'error']);
});
```

- [x] **Step 2: Run** — `npm test` → the three tests fail.
- [x] **Step 3: Implement**

```js
// lore-publisher.mjs — the unchanged branch
if ((await storage.readPointerFile()) === doc.fileName) {
  await repo.writeState(tx, { publishedAt: now, publishedByUserId: actorUserId }); // the live file is current
  return { status: 'unchanged', file: doc.fileName };
}
```

```js
// lore-repository.mjs — withPublishLock: one snapshot for every read of the document
return db.transaction(async (tx) => { /* unchanged body */ }, { isolationLevel: 'repeatable read' });
```
(`publishedAt` stays the time the publish *started* (`now` default), so an edit committed during the run has `lastEditAt > publishedAt` and stays "unpublished" until the next run — Review Focus 4.)

```ts
// src/admin/characters/lib/publishScheduler.mts
export type PublishStatus = { state: 'idle' | 'waiting' | 'publishing' | 'done' | 'error'; message: string };
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void };

// Saves call schedule(); the publish runs once, delayMs after the last save. A publish already
// running on the server (409 busy) is retried after the delay.
export function createPublishScheduler({ delayMs, publish, onStatus, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t as number) } }:
  { delayMs: number; publish: () => Promise<unknown>; onStatus: (s: PublishStatus) => void; timers?: Timers }) {
  let timer: unknown = null;
  const run = async () => {
    timer = null;
    onStatus({ state: 'publishing', message: 'Đang xuất bản…' });
    try {
      await publish();
      onStatus({ state: 'done', message: 'Đã lên site.' });
    } catch (error) {
      if ((error as { status?: number })?.status === 409) return schedule(delayMs);
      onStatus({ state: 'error', message: 'Chưa xuất bản. Bản dịch đã lưu; lưu lại hoặc bấm "Xuất bản ngay".' });
    }
  };
  function schedule(ms: number) {
    if (timer !== null) timers.clear(timer);
    timer = timers.set(() => void run(), ms);
    if (ms > 0) onStatus({ state: 'waiting', message: `Sẽ xuất bản sau ${Math.round(ms / 1000)} giây…` });
  }
  return { schedule: () => schedule(delayMs), now: () => schedule(0) };
}
```

```ts
// src/admin/characters/lorePublish.ts — one scheduler for the whole Admin
import { useSyncExternalStore } from 'react';
import { createPublishScheduler, type PublishStatus } from './lib/publishScheduler.mts';
import { publishLore } from './loreApi.js';

let status: PublishStatus = { state: 'idle', message: '' };
const listeners = new Set<() => void>();
export const lorePublisher = createPublishScheduler({ delayMs: 30_000, publish: publishLore, onStatus: (s) => { status = s; listeners.forEach((l) => l()); } });
export const usePublishStatus = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);
```

```js
// src/admin/characters/loreApi.js
import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
export const getLore = (id) => api(`/api/admin/lore/characters/${enc(id)}`);
export const patchLore = (id, { expectedRevision, texts }) => api(`/api/admin/lore/characters/${enc(id)}`, json('PATCH', { expectedRevision, texts, requestId: requestId() }));
export const getLoreProgress = () => api('/api/admin/lore/progress').then((d) => d.progress);
export const getLoreTerms = () => api('/api/admin/lore/terms').then((d) => d.terms);
export const patchLoreTerm = (code, { expectedRevision, nameVi, detailVi }) => api(`/api/admin/lore/terms/${enc(code)}`, json('PATCH', { expectedRevision, nameVi, detailVi, requestId: requestId() }));
export const publishLore = () => api('/api/admin/lore/publish', json('POST', {}));
```

- [x] **Step 4: Verify** — `npm test`, `tsc`, build. Development: `POST /api/admin/lore/publish` twice → second `unchanged`, then `GET` → `hasUnpublishedChanges: false`. Measure the POST (expect 7–9 s as before).
- [x] **Step 5: Commit** — `feat(lore): repeatable-read publish, unchanged clears the hint, debounced client publisher`.

### Task 7: Client lore libs — routes, confirm-as-is, unit groups, list filter

**Files:** Modify `src/admin/characters/lib/{route,fields,editorState}.mts` + tests, `useEditor.ts`; Create `src/admin/characters/lib/{loreUnits,listFilter}.mts` + tests.

**Interfaces — Produces:**
- `MODULE_IDS = ['overview','lore','skins','source','history']`; `CharactersRoute` adds `{ view: 'terms'; code?: string }`; `TERMS_HREF = '#/admin/characters/terms'`; `termHref(code) → string`.
- `changesFor(draft, record, keys, confirmed?: string[])`: a key in `confirmed` whose field has `official === false` is a change even with identical text.
- Reducer action `{ type: 'confirm'; key }`, state `confirmed: string[]` (reset by hydrate/saveOk/discard); `useEditor` returns `confirm(key)` and `confirmed`.
- `loreUnitGroups(structure, unitKeys, affinity) → { group: string; items: { unitKey, label, extra? }[] }[]`.
- `filterCharacters(items, progress, { query, filter }) → items` with `filter: 'all'|'unfinished'|'legacy'|'changed'`.

- [x] **Step 1: Failing tests**

```ts
// route.test.mts — append
test('terms page and lore module routes', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters/terms'), { view: 'terms' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/terms/K12'), { view: 'terms', code: 'K12' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0144/lore'), { view: 'record', id: 'A0144', module: 'lore' });
  assert.equal(termHref('ORG_3'), '#/admin/characters/terms/ORG_3');
});
```

```ts
// fields.test.mts — append
test('a confirmed field is a change even when the text is identical (legacy / CN changed)', () => {
  const rec = { a: { value: 'x', source: null, official: false }, b: { value: 'y', source: null, official: true } };
  assert.deepEqual(changesFor({ a: 'x', b: 'y' }, rec, ['a', 'b']), {});
  assert.deepEqual(changesFor({ a: 'x', b: 'y' }, rec, ['a', 'b'], ['a', 'b']), { a: 'x' });
});
```

```ts
// editorState.test.mts — append
test('confirm records a field; hydrate, saveOk and discard clear the confirmations', () => {
  let s = editorReducer(initialEditor({ a: 'x' }), { type: 'confirm', key: 'a' });
  s = editorReducer(s, { type: 'confirm', key: 'a' });
  assert.deepEqual(s.confirmed, ['a']);
  assert.deepEqual(editorReducer(s, { type: 'saveOk', draft: { a: 'x' } }).confirmed, []);
  assert.deepEqual(editorReducer(s, { type: 'hydrate', draft: { a: 'x' } }).confirmed, []);
  assert.deepEqual(editorReducer(s, { type: 'discard', draft: { a: 'x' } }).confirmed, []);
});
```

```ts
// src/admin/characters/lib/loreUnits.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loreUnitGroups } from './loreUnits.mts';

test('groups units in reading order with Vietnamese labels, numbering basic reports and naming secret ones', () => {
  const structure = { reports: [
    { fileId: 'f1', kind: 'basic', unlock: { type: 2, elementId: '1' } },
    { fileId: 'f2', kind: 'basic', unlock: { type: 0, elementId: '' } },
    { fileId: 's1', kind: 'special', unlock: { type: 3, elementId: '9' } },
  ], timeline: ['A'] };
  const keys = ['card_intro', 'report.f1.title', 'report.f1.content', 'report.f2.title', 'report.f2.content', 'report.s1.title', 'report.s1.content', 'relic_intro', 'timeline.A.label', 'timeline.A.story'];
  const groups = loreUnitGroups(structure, keys, { 1: { nameCn: '感应', nameVi: null } });
  assert.deepEqual(groups.map((g) => g.group), ['Giới thiệu', 'Báo cáo', 'Hiện vật', 'Dòng thời gian']);
  assert.deepEqual(groups[1].items.map((i) => i.label), ['Tiêu đề 1', 'Báo cáo 1', 'Tiêu đề 2', 'Báo cáo 2', 'Tiêu đề mật', 'Báo cáo mật']);
  assert.equal(groups[1].items[0].extra, 'Mở khoá: thiện cảm 1 · 感应');
  assert.deepEqual(groups[3].items.map((i) => i.label), ['Mốc A', 'Câu chuyện A']);
});

test('units missing from the record are left out; empty groups disappear', () => {
  const groups = loreUnitGroups({ reports: [], timeline: [] }, ['card_intro'], {});
  assert.deepEqual(groups.map((g) => [g.group, g.items.length]), [['Giới thiệu', 1]]);
});
```

```ts
// src/admin/characters/lib/listFilter.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCharacters } from './listFilter.mts';

const c = (characterId: string, nameVi: string | null, nameCn: string) => ({ characterId, nameCn, nameVi: { value: nameVi }, fullnameVi: { value: null } });
const items = [c('A1', 'Lộc Giác', '鹿角'), c('A2', 'Thiên Cầu', '天球'), c('A3', null, '无名')];
const progress = { A1: { total: 4, done: 4, legacy: 0, changed: 0 }, A2: { total: 4, done: 1, legacy: 2, changed: 1 } };

test('search matches ID, VI and CN; filters use lore progress', () => {
  assert.deepEqual(filterCharacters(items, progress, { query: 'lộc', filter: 'all' }).map((x) => x.characterId), ['A1']);
  assert.deepEqual(filterCharacters(items, progress, { query: '天', filter: 'all' }).map((x) => x.characterId), ['A2']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'unfinished' }).map((x) => x.characterId), ['A2', 'A3']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'legacy' }).map((x) => x.characterId), ['A2']);
  assert.deepEqual(filterCharacters(items, progress, { query: '', filter: 'changed' }).map((x) => x.characterId), ['A2']);
});
```

- [x] **Step 2: Run** — `npm test` → new tests fail.
- [x] **Step 3: Implement**

```ts
// route.mts
export const MODULE_IDS = ['overview', 'lore', 'skins', 'source', 'history'] as const;
export type CharactersRoute = { view: 'list' } | { view: 'terms'; code?: string } | { view: 'record'; id: string; module: ModuleId };
export const TERMS_HREF = `${BASE}/terms`;
export const termHref = (code: string) => `${TERMS_HREF}/${encodeURIComponent(code)}`;
// in parseCharactersRoute, after `if (!id) ...`:
if (id === 'terms') return module ? { view: 'terms', code: module } : { view: 'terms' };
```

```ts
// fields.mts — changesFor gains `confirmed`
type Field = { value?: string | null; source?: string | null; official?: boolean };
export function changesFor(draft: Record<string, string>, record: Record<string, unknown>, keys: string[], confirmed: string[] = []) {
  const changes: Record<string, string | null> = {};
  for (const key of keys) {
    const field = record[key] as Field | undefined;
    const next = (draft[key] ?? '').trim() || (field?.source ?? '').trim();
    // "Dùng bản này" / "Giữ bản dịch": the shown text becomes official as it is.
    const accepted = confirmed.includes(key) && field?.official === false;
    if (next !== fieldValue(record, key).trim() || accepted) changes[key] = next || null;
  }
  return changes;
}
```

```ts
// editorState.mts — `confirmed: string[]` in state (initialEditor: []); action { type: 'confirm'; key: string }
case 'confirm': return state.confirmed.includes(action.key) ? state : { ...state, confirmed: [...state.confirmed, action.key] };
// hydrate / saveOk / discard return confirmed: []
```
`useEditor`: pass `state.confirmed` to `changesFor`; return `confirmed: state.confirmed` and `confirm: (k: string) => dispatch({ type: 'confirm', key: k })`. (A confirmation is a click, not text: it is not stored in the browser draft.)

```ts
// src/admin/characters/lib/loreUnits.mts
type Report = { fileId: string; kind: string; unlock?: { type: number; elementId: string } };
type Term = { nameCn: string; nameVi: string | null } | null;
export type LoreItem = { unitKey: string; label: string; extra?: string };

export function loreUnitGroups(structure: { reports: Report[]; timeline: string[] }, unitKeys: string[], affinity: Record<string, Term>) {
  const present = new Set(unitKeys);
  const reports: LoreItem[] = [];
  let n = 0;
  for (const r of structure.reports) {
    const basic = r.kind === 'basic';
    const suffix = basic ? String(++n) : 'mật';
    const level = basic && r.unlock?.type === 2 ? r.unlock.elementId : null;
    const term = level ? affinity[level] : null;
    const extra = level ? `Mở khoá: thiện cảm ${level}${term ? ` · ${term.nameVi || term.nameCn}` : ''}` : undefined;
    reports.push({ unitKey: `report.${r.fileId}.title`, label: `Tiêu đề ${suffix}`, extra }, { unitKey: `report.${r.fileId}.content`, label: `Báo cáo ${suffix}` });
  }
  const groups: { group: string; items: LoreItem[] }[] = [
    { group: 'Giới thiệu', items: [{ unitKey: 'card_intro', label: 'Đánh giá' }] },
    { group: 'Báo cáo', items: reports },
    { group: 'Hiện vật', items: [{ unitKey: 'relic_intro', label: 'Giới thiệu hiện vật' }] },
    { group: 'Dòng thời gian', items: structure.timeline.flatMap((s) => [{ unitKey: `timeline.${s}.label`, label: `Mốc ${s}` }, { unitKey: `timeline.${s}.story`, label: `Câu chuyện ${s}` }]) },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => present.has(i.unitKey)) })).filter((g) => g.items.length);
}
```

```ts
// src/admin/characters/lib/listFilter.mts
export type LoreFilter = 'all' | 'unfinished' | 'legacy' | 'changed';
type Item = { characterId: string; nameCn: string | null; nameVi: { value: string | null }; fullnameVi: { value: string | null } };
type Progress = Record<string, { total: number; done: number; legacy: number; changed: number }>;

export function filterCharacters<T extends Item>(items: T[], progress: Progress, { query, filter }: { query: string; filter: LoreFilter }) {
  const q = query.trim().toLowerCase();
  return items.filter((c) => {
    if (q && ![c.characterId, c.nameCn, c.nameVi.value, c.fullnameVi.value].some((v) => v?.toLowerCase().includes(q))) return false;
    const p = progress[c.characterId];
    if (filter === 'unfinished') return !p || p.done < p.total;
    if (filter === 'legacy') return Boolean(p?.legacy);
    if (filter === 'changed') return Boolean(p?.changed);
    return true;
  });
}
```

- [x] **Step 4: Run** — `npm test`, `tsc` → pass (CharacterRecord's `MODULES` gets `lore` in Task 8; until then `parseCharactersRoute` may return `lore` and `CharacterRecord` falls back to the first module — acceptable within this commit).
- [x] **Step 5: Commit** — `feat(lore): client libs — lore/terms routes, confirm-as-is, unit groups, list filters`.

### Task 8: Lore module + list progress

**Files:** Create `components/Pair.tsx`, `components/BilingualText.tsx`, `components/FullscreenEditor.tsx`, `modules/LoreModule.tsx`; Modify `components/OverridableField.tsx` (use `Pair.tsx`), `CharacterRecord.tsx` (`MODULES` + Lore), `CharacterList.tsx` (progress, filters, terms link), `components/SaveBar.tsx` (publish line).

**Interfaces — Consumes:** Task 6 (`getLore`, `patchLore`, `lorePublisher`, `usePublishStatus`), Task 7 (`loreUnitGroups`, `filterCharacters`, `termHref`, `TERMS_HREF`, `confirm`). **Produces:** `PairRow`, `ViCell` for Task 9.

- [x] **Step 1: Extract the shared pair pieces** (refactor, behaviour unchanged — phase-1 browser behaviour of Overview/Skins must stay identical)

```tsx
// components/Pair.tsx
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const fit = (el: HTMLTextAreaElement | null) => {
  if (!el || CSS.supports('field-sizing', 'content')) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// A bilingual row: caption across, CN left (serif, read-only), VI right.
export function PairRow({ id, label, extra, original, children }: { id: string; label: string; extra?: ReactNode; original: ReactNode; children: ReactNode }) {
  return (
    <div id={`pair-${id}`} data-unit={id} className="grid scroll-mt-12 grid-cols-1 gap-x-12 gap-y-3 border-t border-(--border-color) py-5 pl-7 pr-4 first:border-t-0 max-lg:scroll-mt-14 md:grid-cols-2 md:px-8 md:py-6">
      <div className="flex flex-wrap items-baseline gap-x-3.5 text-xs md:col-span-2">
        <label htmlFor={`vi-${id}`} className="font-medium tracking-wide text-(--text-muted)">{label}</label>
        {extra && <span className="text-(--text-subtle)">{extra}</span>}
      </div>
      <div id={`cn-${id}`} lang="zh" className="admin-cn min-w-0 whitespace-pre-line text-[15px] leading-8 text-(--text-muted)">{original || '—'}</div>
      {children}
    </div>
  );
}

// Borderless VI textarea; the hairline on its left is the focus/dirty indicator (gold on focus or when dirty).
export function ViCell({ id, value, dirty, placeholder, multiline, onChange, notes }: { id: string; value: string; dirty: boolean; placeholder: string; multiline?: boolean; onChange: (v: string) => void; notes: ReactNode }) {
  return (
    <div className={cn('relative min-w-0 before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-px before:bg-(--border-color) before:transition-colors md:before:-left-6 focus-within:before:bg-(--accent)', dirty && 'before:bg-(--accent)')}>
      <textarea
        id={`vi-${id}`} ref={fit} rows={1} value={value} placeholder={placeholder}
        aria-describedby={`cn-${id} note-${id}`}
        onChange={(event) => { onChange(event.target.value); fit(event.target); }}
        className={cn('block w-full resize-none border-0 bg-transparent p-0 text-base font-light leading-[1.9] text-(--text-main) outline-none [field-sizing:content] placeholder:italic placeholder:text-(--text-subtle) focus-visible:outline-none', multiline ? 'min-h-16' : 'min-h-8')}
      />
      <div id={`note-${id}`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--text-subtle)">{notes}</div>
    </div>
  );
}
```

Rewrite `OverridableField` as `PairRow` + `ViCell` with its existing notes ("Đang dùng bản sửa", "Gốc: …", "Trả về gốc", "Chưa dịch", count) and its `useId()`-based id; re-run the phase-1 browser check on Overview (edit/save/revert) to confirm no change.

- [x] **Step 2: `FullscreenEditor` and `BilingualText`**

```tsx
// components/FullscreenEditor.tsx — native <dialog>: Esc closes, focus is trapped by the browser.
import { useEffect, useRef } from 'react';

export function FullscreenEditor({ label, original, value, onChange, onClose }: { label: string; original: string; value: string; onChange: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={`${label} — phóng to`} className="m-0 h-dvh max-h-none w-screen max-w-none bg-(--bg-main) p-0 text-(--text-main) backdrop:bg-(--bg-main)">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-(--border-color) px-4 py-2.5 text-sm md:px-8">
          <span className="font-medium">{label}</span>
          <button type="button" onClick={() => ref.current?.close()} className="text-(--text-muted) hover:text-(--text-main)">Đóng (Esc)</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-6 md:grid-cols-2 md:gap-12 md:px-8">
          <p lang="zh" className="admin-cn whitespace-pre-line text-[15px] leading-8 text-(--text-muted)">{original}</p>
          <textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} — tiếng Việt`} className="min-h-[60vh] w-full resize-none border-0 bg-transparent p-0 text-base font-light leading-[1.9] outline-none focus-visible:outline-none" />
        </div>
        <div className="border-t border-(--border-color) px-4 py-2 text-right text-xs text-(--text-subtle) md:px-8">{value.length} ký tự</div>
      </div>
    </dialog>
  );
}
```

```tsx
// components/BilingualText.tsx
import { useState } from 'react';
import { PairRow, ViCell } from './Pair';
import { FullscreenEditor } from './FullscreenEditor';

export type LoreStatus = 'todo' | 'legacy' | 'changed' | 'done';
type Props = { unitKey: string; label: string; extra?: string; cn: string; previousCn: string | null; value: string; status: LoreStatus; dirty: boolean; confirmed: boolean; onChange: (v: string) => void; onConfirm: () => void };

export function BilingualText({ unitKey, label, extra, cn, previousCn, value, status, dirty, confirmed, onChange, onConfirm }: Props) {
  const [showOld, setShowOld] = useState(false);
  const [full, setFull] = useState(false);
  const long = cn.length > 200;
  return (
    <PairRow id={unitKey} label={label} extra={extra} original={showOld && previousCn ? <><span className="mb-1 block text-xs text-(--rarity-ssr-text)">Tiếng Trung trước đây</span>{previousCn}</> : cn}>
      <ViCell id={unitKey} value={value} dirty={dirty} multiline={long} placeholder="Viết bản tiếng Việt…" onChange={onChange} notes={<>
        {status === 'todo' && !value.trim() && <span>Chưa dịch</span>}
        {status === 'legacy' && <><span className="text-(--accent)">Bản cũ · chưa lưu</span>{!confirmed && <button type="button" onClick={onConfirm} className="hover:text-(--text-main)">Dùng bản này</button>}</>}
        {status === 'changed' && <><span className="text-(--rarity-ssr-text)">Tiếng Trung đã đổi</span>{previousCn && <button type="button" onClick={() => setShowOld((v) => !v)} className="hover:text-(--text-main)">{showOld ? 'Xem bản mới' : 'So bản cũ'}</button>}{!confirmed && <button type="button" onClick={onConfirm} className="hover:text-(--text-main)">Giữ bản dịch</button>}</>}
        {confirmed && <span className="text-(--accent)">Sẽ lưu thành bản chính thức</span>}
        {long && <button type="button" onClick={() => setFull(true)} className="hover:text-(--text-main)">Phóng to</button>}
        <span className="ml-auto tabular-nums">{value.length} ký tự</span>
      </>} />
      {full && <FullscreenEditor label={label} original={cn} value={value} onChange={onChange} onClose={() => setFull(false)} />}
    </PairRow>
  );
}
```

- [x] **Step 3: `LoreModule`** — layout per `khi-gia-direction.md` §3 (left unit list 260 px / middle pairs / right context 280 px at `xl`; phones: sticky chip strip, pairs stacked, fixed save bar):

```tsx
// modules/LoreModule.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Notice, SkeletonRows } from '../../layout/ui';
import { getLore, patchLore } from '../loreApi.js';
import { lorePublisher, usePublishStatus } from '../lorePublish';
import { useEditor } from '../useEditor';
import { loreUnitGroups } from '../lib/loreUnits.mts';
import { termHref } from '../lib/route.mts';
import { BilingualText, type LoreStatus } from '../components/BilingualText';
import { PairHead } from '../components/OverridableField';
import { SaveBar } from '../components/SaveBar';
import { HistoryList } from '../components/HistoryList';
import type { ModuleProps } from '../types';
import { useIsOwner } from '../useIsOwner';

type Unit = { unitKey: string; sourceCn: string; vi: string | null; viOrigin: 'admin' | 'legacy_workbook' | null; state: 'ok' | 'source_changed'; previousCn: string | null };
type TermView = { code: string; nameCn: string; nameVi: string | null; official: boolean } | null;
type Lore = { characterId: string; revision: number; structure: { reports: { fileId: string; kind: string; unlock?: { type: number; elementId: string } }[]; timeline: string[] }; units: Unit[]; organisation: TermView; relic: { type: TermView; era: TermView; museum: TermView; eraRange: TermView } | null; affinity: Record<string, TermView>; archiveImages: { url: string }[]; history: never[] };

const statusOf = (u: Unit): LoreStatus => (u.state === 'source_changed' ? 'changed' : u.viOrigin === 'legacy_workbook' ? 'legacy' : u.vi ? 'done' : 'todo');
const DOT: Record<LoreStatus, string> = { done: 'bg-(--text-muted)', legacy: 'bg-(--accent)', changed: 'bg-(--rarity-ssr-text)', todo: 'border border-(--text-subtle)' };

export function LoreModule({ data }: ModuleProps) {
  const id = data.character.characterId;
  const [lore, setLore] = useState<Lore | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => { const next: Lore = await getLore(id); setLore(next); return toRecord(next); }, [id]);
  useEffect(() => { reload().catch(() => setError(true)); }, [reload]);
  const record = useMemo(() => (lore ? toRecord(lore) : null), [lore]);
  const keys = useMemo(() => lore?.units.map((u) => u.unitKey) ?? [], [lore]);
  const save = useCallback((texts: Record<string, string | null>) => patchLore(id, { expectedRevision: lore?.revision, texts }).then(() => lorePublisher.schedule()), [id, lore?.revision]);
  const editor = useEditor({ scope: 'lore', id, record, keys, save, reload, peek: () => getLore(id).then(toRecord) });
  const publish = usePublishStatus();
  const isOwner = useIsOwner();
  const [active, setActive] = useScrollSpy(keys);
  if (error) return <Notice className="m-4">Không tải được lore của {id}.</Notice>;
  if (!lore || !record) return <SkeletonRows />;
  const byKey = new Map(lore.units.map((u) => [u.unitKey, u]));
  const groups = loreUnitGroups(lore.structure, keys, Object.fromEntries(Object.entries(lore.affinity).map(([k, t]) => [k, t && { nameCn: t.nameCn, nameVi: t.nameVi }])));
  const jump = (unitKey: string) => {
    document.getElementById(`pair-${unitKey}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    (document.getElementById(`vi-${unitKey}`) as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
    setActive(unitKey);
  };
  // … render (see requirements below)
}

// Units as editor fields: `value` is the shown text (legacy/changed text is pre-filled), `official` says whether it is published.
function toRecord(lore: Lore) {
  return Object.fromEntries(lore.units.map((u) => [u.unitKey, { value: u.vi ?? '', source: null, official: u.viOrigin === 'admin' && u.state === 'ok' }]));
}
```

Render requirements (write them out in JSX in this file; classes follow `khi-gia-direction.md`):
- **Left unit list** (`<nav aria-label="Các đoạn lore">`): per group a caption (11 px, uppercase, `--text-subtle`), per item a button with a status dot (`DOT[statusOf(u)]`, 7 px round), the label and the first 24 CN characters (serif, truncated); `aria-current` on `active`; clicking calls `jump`. Phones (`max-lg`): the list becomes a horizontal `sticky top-0` chip strip (`bg-(--bg-main)`, no captions, no CN preview, active chip gold underline), scrolling only its own `scrollLeft` to keep the active chip visible (never `scrollIntoView` on the chip — it cancels the page jump).
- **Middle:** `PairHead`, then for each group item a `BilingualText` with `status`, `previousCn`, `dirty={item.unitKey in editor.changes}`, `confirmed={editor.confirmed.includes(item.unitKey)}`, `onConfirm={() => editor.confirm(item.unitKey)}`; group captions between groups in gold (`--accent`, 13 px, `tracking-[.3em]`).
- **Right context (`xl` only):** relic image (`archiveImages[0]`, 1:1, `object-contain`, `bg-(--bg-elevated)`, max 280 px); a definition list Loại / Triều đại / Bảo tàng / Giai đoạn / Trực thuộc, each value = `nameVi` when `official`, else the CN + "(chưa dịch)", linked with `termHref(code)`; a line "Sửa ở đây sẽ đổi cho mọi nhân vật dùng thuật ngữ này"; progress (`done / total`, legacy, changed — computed from `lore.units` with `statusOf`); recent history (`HistoryList` with labels from the group items, newest 5).
- **SaveBar:** `hint` line shows `publish.message` when `publish.state !== 'idle'`; owners see a `Button` "Xuất bản ngay" (`lorePublisher.now()`) in the record header area of this module.
- **Scroll-spy** (`useScrollSpy(keys)` in this file): an `IntersectionObserver` over `[data-unit]` rows (root = the middle pane on `lg+`, the viewport on phones; `rootMargin: '-48px 0px -60% 0px'`) sets the active key to the topmost intersecting row; focusing a textarea also sets it (`onFocus` on the middle pane, read `closest('[data-unit]')`).
- `useIsOwner()` (new tiny hook, `src/admin/characters/useIsOwner.ts`): `getSession()` from `src/app/auth/session.js` → `role === 'owner'`.

Register in `CharacterRecord.tsx`: `{ id: 'lore', label: 'Lore', Component: LoreModule }` after Tổng quan.

- [x] **Step 4: List progress + filters** — `CharacterList.tsx`: load `getLoreProgress()` once (module cache like the list); filter buttons Tất cả / Chưa xong / Có bản cũ / Tiếng Trung đã đổi (state; `aria-pressed`), a link "Thuật ngữ lore →" to `TERMS_HREF`; use `filterCharacters`; each entry's right column shows `done / total` and, when > 0, `N bản cũ` (gold) and `N đổi CN` (`--rarity-ssr-text`). Invalidate the progress cache after a lore save (`lorePublisher.schedule` call site also calls `invalidateLoreProgress()`).

- [x] **Step 5: Browser check (development)** — A0144 Lore: 14 units in groups; legacy units pre-filled with "Bản cũ · chưa lưu"; click "Dùng bản này" on one → SaveBar "1 thay đổi" → Ctrl+S → unit becomes done (dot), list progress +1 after returning, publish line "Sẽ xuất bản sau 30 giây…" → "Đã lên site." and the R2 file for `lore/development/` changes (`GET /api/admin/lore/publish`). Scroll the middle pane → the left list follows. Phone preset: chip strip sticky, tapping a chip jumps and focuses, back-to-top visible, "Phóng to" opens the full-screen dialog and edits reflect in the row. Two tabs (or a concurrent `fetch` PATCH on another unit) → 409 → "Tải bản mới" → restore → only your unit dirty (Review Focus 5). Revert every test change afterwards (send the original texts; for units that were legacy, the owner decides whether to leave them official — note it in the log). Console: no errors.
- [x] **Step 6: Commit** — `feat(lore): Lore module (workbench + pairs, scroll-spy, fullscreen, auto-publish) and list progress`. Then run `ponytail:ponytail-review` on the diff since Task 4's base; apply with tests green; commit `refactor(lore): ponytail review`.

### Task 9: Lore terms page

**Files:** Create `src/admin/characters/LoreTermsView.tsx`; Modify `src/admin/characters/CharactersView.tsx` (render it for `view === 'terms'`).

**Interfaces — Consumes:** `getLoreTerms`, `patchLoreTerm`, `lorePublisher`, `useEditor`, `PairRow`, `ViCell`, `SaveBar`, `termHref`.

- [x] **Step 1: Implement** — requirements:
  - Header (C style): kicker "KHÍ GIẢ", title "Thuật ngữ lore", lead "Sửa ở đây đổi cho mọi nhân vật dùng thuật ngữ." and a back link to the list; a borderless search (focus = gold underline, no box) over code / CN / VI.
  - Groups by `kind` in this order with these headings: `organisation` Tổ chức, `relic_type` Loại hiện vật, `era` Triều đại, `museum` Bảo tàng, `era_range` Giai đoạn, `affinity_level` Mức thiện cảm.
  - Each term row: CN name (serif), VI name or "chưa dịch", status (bản cũ never occurs for terms; "Tiếng Trung đã đổi" when `state === 'source_changed'`), "đang dùng bởi N nhân vật" as a `<details>` listing the IDs as links (`recordHref(id, 'lore')`).
  - Clicking a row opens its editor in place (one open at a time; switching with unsaved changes asks "Có thay đổi chưa lưu. Rời thuật ngữ này?"): `useEditor({ scope: 'term', id: code, record: { nameVi: { value: t.nameVi ?? '', source: null, official: t.viOrigin === 'admin' && t.state === 'ok' }, detailVi: { value: t.detailVi ?? '', source: null, official: … } }, keys: ['nameVi', 'detailVi'], save: (c) => patchLoreTerm(code, { expectedRevision: t.revision, nameVi: c.nameVi !== undefined ? c.nameVi : t.nameVi, detailVi: c.detailVi !== undefined ? c.detailVi : t.detailVi }).then(() => lorePublisher.schedule()), reload, peek })`; `PairRow` + `ViCell` for name and (when `detailCn`) detail; "Giữ bản dịch" (confirm) for `source_changed`; `SaveBar` with the publish line.
  - `#/admin/characters/terms/CODE` opens that term and scrolls it into view.
- [x] **Step 2: Browser check (development)** — open from a Lore module's relic term link → the right term is open; translate `K`-code "金银器" → save → the Lore module of A0144 shows the VI (after reload) and `usedBy` count matches; 409 via a concurrent `fetch`; phone width usable, no horizontal scroll. Revert the test term afterwards (empty both fields → back to "chưa dịch").
- [x] **Step 3: Commit** — `feat(lore): lore terms page`.

### Task 10: One-time seeds (report titles, organisation names) + v2 department from lore_terms

**Files:** Create `scripts/lib/lore-seed.mjs` + `lore-seed.test.mjs`, `scripts/seed-lore-admin-vi.mjs`; Modify `server/profile/shape-character-profile.mjs` + test, `server/profile/profile-code-maps.mjs` (comment).

**Interfaces — Consumes:** `saveLoreTexts`, `saveLoreTerm` (Task 5), `DEPARTMENT_VI`.

- [x] **Step 1: Failing tests**

```js
// scripts/lib/lore-seed.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_TITLE_VI, planOrgSeed, planTitleSeed } from './lore-seed.mjs';

const t = (characterId, unitKey, sourceCn, vi = null, viOrigin = null, state = 'ok') => ({ characterId, unitKey, sourceCn, vi, viOrigin, state });

test('report titles: exact CN only; official admin text is never overwritten; legacy is listed as replaced', () => {
  const rows = [
    t('A1', 'report.f1.title', '观察报告1'),
    t('A1', 'report.f2.title', '观察报告2', 'Cũ', 'legacy_workbook'),
    t('A1', 'report.f3.title', '观察报告3', 'Của người dịch', 'admin'),
    t('A1', 'report.f4.title', '观察报告4', 'Báo cáo quan sát 4', 'admin'),
    t('A1', 'report.s1.title', '加密报告A'),
    t('A1', 'report.f5.title', '特别报告'),
    t('A1', 'report.f1.content', '观察报告1'),
  ];
  const plan = planTitleSeed(rows);
  assert.deepEqual(plan.writes, [
    { characterId: 'A1', unitKey: 'report.f1.title', vi: 'Báo cáo quan sát 1' },
    { characterId: 'A1', unitKey: 'report.f2.title', vi: 'Báo cáo quan sát 2' },
    { characterId: 'A1', unitKey: 'report.s1.title', vi: 'Báo cáo mật A' },
  ]);
  assert.deepEqual(plan.replacedLegacy.map((r) => r.unitKey), ['report.f2.title']);
  assert.deepEqual(plan.keptAdmin.map((r) => r.unitKey), ['report.f3.title']);
  assert.deepEqual(plan.unknownCn.map((r) => r.sourceCn), ['特别报告']);
  assert.equal(REPORT_TITLE_VI['加密报告A'], 'Báo cáo mật A');
});

test('organisations: ORG_* terms get the current VI names; official ones and unmapped CN are reported', () => {
  const terms = [
    { code: 'ORG_1', nameCn: '资料部', nameVi: null, viOrigin: null, state: 'ok' },
    { code: 'ORG_2', nameCn: '技术部', nameVi: 'Bộ Kỹ Thuật', viOrigin: 'admin', state: 'ok' },
    { code: 'ORG_9', nameCn: '未知', nameVi: null, viOrigin: null, state: 'ok' },
    { code: 'K1', nameCn: '金银器', nameVi: null, viOrigin: null, state: 'ok' },
  ];
  const plan = planOrgSeed(terms, { 资料部: 'Bộ Tư Liệu', 技术部: 'Bộ Kỹ Thuật' });
  assert.deepEqual(plan.writes, [{ code: 'ORG_1', nameVi: 'Bộ Tư Liệu' }]);
  assert.deepEqual(plan.alreadyOfficial, ['ORG_2']);
  assert.deepEqual(plan.unmapped, ['ORG_9']);
});
```

```js
// server/profile/shape-character-profile.test.mjs — append (use the file's existing fixture helpers)
test('v2 department: admin VI of the organisation term, else the CN (no JS name map)', () => {
  // build one profile with organisationCode '3'; terms ORG_3 { nameCn: '技术部', nameVi: 'Bộ Kỹ Thuật', viOrigin: 'admin', state: 'ok' }
  // → department 'Bộ Kỹ Thuật'; the same term with viOrigin null → department '技术部'
});
```
(Write the second test with the file's existing `profile`/`terms` fixture builders; assert both cases.)

- [x] **Step 2: Run** — `npm test` → fail.
- [x] **Step 3: Implement the planners**

```js
// scripts/lib/lore-seed.mjs
// One-time seeds approved in spec §4 (2026-09-25). Pure: the script prints the plan and applies it
// through the normal save path (history rows, revision, last_edit_at).
export const REPORT_TITLE_VI = Object.freeze({
  观察报告1: 'Báo cáo quan sát 1', 观察报告2: 'Báo cáo quan sát 2', 观察报告3: 'Báo cáo quan sát 3', 观察报告4: 'Báo cáo quan sát 4',
  加密报告A: 'Báo cáo mật A',
});

export function planTitleSeed(rows) {
  const plan = { writes: [], replacedLegacy: [], keptAdmin: [], unknownCn: [] };
  for (const r of rows) {
    if (!/^report\..+\.title$/.test(r.unitKey)) continue;
    const vi = REPORT_TITLE_VI[r.sourceCn.trim()];
    if (!vi) { plan.unknownCn.push(r); continue; }
    if (r.viOrigin === 'admin' && r.state === 'ok') { if (r.vi !== vi) plan.keptAdmin.push(r); continue; }
    if (r.viOrigin === 'legacy_workbook') plan.replacedLegacy.push(r);
    plan.writes.push({ characterId: r.characterId, unitKey: r.unitKey, vi });
  }
  return plan;
}

export function planOrgSeed(terms, names) {
  const plan = { writes: [], alreadyOfficial: [], unmapped: [] };
  for (const t of terms) {
    if (!t.code.startsWith('ORG_')) continue;
    if (t.viOrigin === 'admin' && t.state === 'ok') { plan.alreadyOfficial.push(t.code); continue; }
    const nameVi = names[t.nameCn];
    if (nameVi) plan.writes.push({ code: t.code, nameVi }); else plan.unmapped.push(t.code);
  }
  return plan;
}
```

- [x] **Step 4: The script** — `scripts/seed-lore-admin-vi.mjs --part=titles|orgs [--apply]`:
  - loads rows (`selectProfileTextsWithCharacterId` + `lore_terms` + revisions), builds the plan, prints counts and **every** write / replaced-legacy / kept-admin / unknown row (IDs + CN + VI) — this printout is what the owner approves;
  - without `--apply` it never writes; with `--apply` it finds the single active owner (`users.role = 'owner' and status = 'active'`, abort if not exactly one) as actor and applies per character with `saveLoreTexts(db, id, { expectedRevision, texts, actorUserId })` (titles) or per term with `saveLoreTerm` (orgs, `detailVi` kept as is), then prints `{ written, conflicts }` (a 409 is skipped and reported, never retried blindly).
- [x] **Step 5: Run on development** — `node scripts/seed-lore-admin-vi.mjs --part=titles` (plan) → show the printout to the owner → **OWNER GATE** → `--apply` → re-run plan: 0 writes. Same for `--part=orgs`. `POST /api/admin/lore/publish` (or wait for the next UI publish) and check a public character page on the local site shows "Báo cáo quan sát 1" titles.
- [x] **Step 6: v2 department** — implement: in `shape-character-profile.mjs` v2 → `publishableVi(org, 'nameVi') ?? cn`; legacy shape keeps `map(DEPARTMENT_VI, cn)` (parity gate 1 compares with the Python build, which keeps its map — spec Q7). Update the `profile-code-maps.mjs` comment ("used only by the legacy shape"). `npm test` green. **Do not push this commit before the production seed (Step 7) is applied**, or production would show CN organisation names until then.
- [x] **Step 7: Production (OWNER GATE for each part)** — `node --env-file=.env.production.local scripts/seed-lore-admin-vi.mjs --part=titles` → owner reviews the printout → yes → `--apply`; same for `orgs`; then `LORE_PUBLISH_PREFIX=lore/production/ node --env-file=.env --env-file=.env.production.local scripts/publish-lore.mjs` (owner yes). Verify on whmxsite.vercel.app: a character page shows the VI titles and the organisation name.
- [x] **Step 8: Commit** — `feat(lore): one-time seeds (report titles, organisations); v2 department from lore_terms`. Run `ponytail:ponytail-review` on Tasks 9–10; commit any simplifications.

### Task 11: Review, release, docs

- [x] **Step 1:** Final whole-branch review (fresh reviewer, most capable model) with this plan's Review Focus and the ledger's rulings; fix every Critical/Important with a failing test first. Findings the reviewer calls "minor" are re-graded by effect: anything that crashes, loses or silently changes data, saves the wrong thing, or misleads the user is a bug and is fixed in this pass (owner, 2026-09-25); only pure polish may be deferred, and it is listed as such in the handoff.
- [x] **Step 2:** Merge safety: `git fetch`; `origin/main` is an ancestor of HEAD; export the committed tree into `.superpowers/sdd/<plan>/tree` (`git archive HEAD | tar -x -C …`), run `npm test`, `tsc`, `vite build` there; delete the folder.
- [x] **Step 3:** Push the branch and `main`; after the production deploy: `#/login` → owner signs in → Khí Giả → A0144 → Lore renders; terms page renders; no console errors (owner performs the signed-in check if the agent has no session).
- [x] **Step 4:** Docs: pipeline plan log; new `docs/WHMX_CURRENT_STATE_FINAL_<date>.md`; `WHMX_NEXT_STEPS.md` header and read-first list; skills used. Delete `%LOCALAPPDATA%\Temp\claude\bash-edit-diff`.
