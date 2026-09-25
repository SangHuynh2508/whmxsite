# Admin Khí Giả — Phase 1 (React at parity + Admin on production) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vue Khí Giả workspace with a React module workspace at feature parity, redesigned with huashu, and run the Admin on the production site.

**Architecture:** Pure logic (routing, dirty tracking, drafts, error mapping, API client) lives in small `.mts`/`.js` modules with `node:test` tests. React components under `src/admin/characters/` consume them and follow the visual direction the owner picks in Task 2. The existing `/api/admin/characters` and `/api/admin/skins` endpoints are reused unchanged; no new Vercel function.

**Tech Stack:** React 19 + TypeScript (`.tsx`/`.mts`), Tailwind v4 with tokens from `src/styles/tokens.css`, lucide-react icons, `node:test`, Playwright (MCP) for browser checks, Neon MCP for branch operations.

**Spec:** `docs/superpowers/specs/2026-09-25-admin-khi-gia-lore-design.md` (§3 structure, §5 UI behaviour, §6 infrastructure, §7 testing, §9 order). Phase 2 (Lore) gets its own plan after Task 2's design is chosen.

## Global Constraints

- Code with the `ponytail` skill: reuse before writing, no speculative abstractions, shortest correct diff; run `ponytail:ponytail-review` after Task 6 and Task 8.
- New UI is React + TypeScript; never the bare `hidden` class (use `max-md:hidden` etc.); colours only from `src/styles/tokens.css`; dark-only.
- No new Vercel function: nothing new under `api/`; tests never under `api/`.
- Any write to a Neon branch, any Vercel env change, any account removal: show the exact action, owner says yes first. Secrets are pasted by the owner, never by the agent.
- Scratch files on drive D; delete `%LOCALAPPDATA%\Temp\claude\bash-edit-diff` at the end of each work block.
- One npm command at a time, in the background.
- After each task: update `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` log, commit (own files only), push the branch; push `main` only at the end of the phase (owner allowed pushing main when the merged result is error-free).
- Vietnamese UI copy; reply to the owner in Vietnamese (tôi/bạn).

## Review Focus

1. **Stale revision while typing:** saving after someone else saved returns 409; the typed values must stay on screen and in the draft (Task 4 test `keeps typed values on 409`).
2. **Emptying a field:** an empty VI field must send `null` (revert to source), never an empty-string override (Task 3 test `empty string becomes null`).
3. **Leaving with unsaved changes:** switching module, switching character, browser Back and closing the tab must ask first (Task 4 test for the guard; Task 7 Playwright check).
4. **Phone width (375 px):** list and record usable with no horizontal page scroll and the save bar reachable (Task 7 Playwright check at mobile preset).
5. **Session expired mid-edit (401):** show "phiên đăng nhập hết hạn", keep the draft, no data loss (Task 3 test for the message mapping; Task 4 keeps draft on any save failure).

---

## File map

| File | Responsibility |
|---|---|
| `src/admin/lib/api.js` (new, moved from `previewApi.js`) | `api(path, options)`, `json(method, body)`, `requestId()` shared by all admin areas |
| `src/admin/preview/previewApi.js` (modify) | import the shared helpers instead of its private copies |
| `src/admin/characters/charactersApi.js` | list/get/patch character and skin |
| `src/admin/characters/lib/route.mts` (+ test) | parse/build `#/admin/characters…` hashes |
| `src/admin/characters/lib/fields.mts` (+ test) | field values, dirty set, `changesFor` (empty → null) |
| `src/admin/characters/lib/draft.mts` (+ test) | browser draft save/load/clear with injected storage |
| `src/admin/characters/lib/saveError.mts` (+ test) | status/code → Vietnamese message |
| `src/admin/characters/components/OverridableField.tsx` | one VI field: source vs override, revert-to-source |
| `src/admin/characters/components/SaveBar.tsx` | dirty count, Lưu / Bỏ thay đổi, Ctrl+S, status |
| `src/admin/characters/components/HistoryList.tsx` | edit history rows |
| `src/admin/characters/useEditor.ts` | per-module editor state: draft, dirty, save, 409, guard |
| `src/admin/characters/CharactersView.tsx` | route switch: list / record |
| `src/admin/characters/CharacterList.tsx` | search, list |
| `src/admin/characters/CharacterRecord.tsx` | header + module rail + active module |
| `src/admin/characters/modules/{Overview,Skins,Source,History}Module.tsx` | the four parity modules |
| `src/admin/layout/AdminApp.tsx` (modify) | mount `CharactersView` instead of the Vue island |
| delete `src/admin/character-skin/`, `src/admin/styles/characterSkinAdmin.css`, `vue` dependency | Task 7 |
| `docs/admin-redesign/khi-gia-direction.md` | Task 2 output: chosen direction, tokens used, motion intent |

Run JS tests: `npm test` (already globs `src/**/*.test.mts`).

---

### Task 1: Infrastructure — Neon branch swap, Vercel env, Admin on production

**Files:** `.env.production.local` (owner creates, git-ignored — verify `git check-ignore`), `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` (runbook N2 + migrate instructions).

- [x] **Step 1: Pre-check (read-only).** Neon MCP `list_branches` / `list_postgres_endpoints` for project `empty-smoke-82458354`: expect `production` (primary, idle) and `development` (endpoint `ep-rapid-dust-azdtb39r`). Confirm `.env.local` host is `ep-rapid-dust-azdtb39r` (print hostname only).
- [x] **Step 2: OWNER GATE — branch operations.** Show the four actions, then after "yes" run them with the Neon MCP:
  1. `create_branch` name `backup-2026-09-25`, parent = `development` branch id.
  2. `update_branch` `production` → name `production-old-empty`.
  3. `update_branch` `development` → name `production`; `set_default_branch` to it.
  4. `create_branch` name `development`, parent = new `production`, with a read-write endpoint.
  Verify with `list_branches`: names/parents as expected; the renamed `production` still uses endpoint `ep-rapid-dust-azdtb39r`.
- [x] **Step 3: Local env (owner pastes secrets).** Owner copies the current `.env.local` `DATABASE_URL`/`DATABASE_URL_UNPOOLED` lines into a new `.env.production.local`, then replaces them in `.env.local` with the new `development` branch strings from the Neon console. Verify (hostnames only): `node -e "for (const f of ['.env.local','.env.production.local']) { const t=require('fs').readFileSync(f,'utf8'); console.log(f, /DATABASE_URL=.*@([^/:]+)/.exec(t)?.[1]); }"` → `.env.production.local` → `ep-rapid-dust…`, `.env.local` → the new endpoint. `git check-ignore .env.production.local` prints the path.
- [x] **Step 4: Read-only DB smoke on both.** `node --env-file=.env.production.local scripts/import-character-profile.mjs` and `node scripts/import-character-profile.mjs` → both plans print `unchanged: 2532` (same data).
- [x] **Step 5: Vercel env (owner pastes secrets, type Secret).** Give the owner the table from spec §6 (Production: production branch strings from `.env.production.local`; Preview: development strings; new `BETTER_AUTH_SECRET` per environment generated with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` — owner runs it; `BETTER_AUTH_ALLOWED_HOSTS` Production = `whmxsite.vercel.app` plus the two alias domains shown in Vercel → Settings → Domains; Preview = the exact branch alias (see below); R2 vars copied from `.env`; `R2_MANAGED_ASSET_PREFIX` and `DB_HEALTHCHECK_SECRET` from `.env.local`). Check `server/admin-api.mjs` `isApprovedOrigin`: a `*.` prefix matches suffixes; `*-siro-da-bao.vercel.app` does **not** start with `*.` — if preview URLs cannot be expressed with `*.`, add the exact current preview alias `whmxsite-git-feat-postgres-admin-crud-siro-da-bao.vercel.app` instead (no code change).
- [x] **Step 6: OWNER GATE — test account.** Show the `design-review-…@design-review.invalid` owner account (users table, production branch); after yes, set `status = 'disabled'` through the existing accounts domain (Admin → Tài khoản) or a one-row update. Verify it cannot sign in.
- [x] **Step 7: Redeploy + go-live check.** Push the branch; after the Production deploy (owner triggers a redeploy in Vercel so env vars apply): on `https://whmxsite.vercel.app/#/admin` owner signs in; `GET /api/admin/session` → `authenticated: true`; Khí Giả (Vue) list loads; Preview list loads; one character field saved then reverted (history shows both). Measure `POST /api/admin/lore/publish` from the browser console (`performance.now()` around the fetch) → note the duration; if > 7 s add `"functions": {"api/admin/[...].js": {"maxDuration": 30}}` to `vercel.json`. On the Preview URL: sign in, edit+revert one field, then confirm with `node --env-file=.env.production.local` read of that field's history that production has no new rows.
- [x] **Step 8: Runbook + docs.** In the pipeline plan: N2 steps 6 and 8 use `--env-file=.env.production.local`; migrate line becomes `node --env-file=.env.production.local scripts/db-migrate.mjs --target=production` for production and `npm run db:migrate -- --target=development` for the copy. Log entry. Commit (`docs:` only; no env files).

### Task 2: Visual design with huashu (owner picks)

**Files:** Create `docs/admin-redesign/khi-gia-direction.md`; HTML prototypes under `docs/admin-redesign/khi-gia/` (not shipped).

- [x] **Step 1:** Invoke `WhmxCalc:huashu-design`. Brief: WHMX Admin "Khí Giả" — list of 133 characters (avatar, name VI/CN, ID, later lore progress), character record with module rail (Tổng quan · Lore · Trang phục · Nguồn · Lịch sử), in-place `OverridableField` (source vs override, revert), `BilingualText` (CN read-only | VI editable, badges chưa dịch / bản cũ / tiếng Trung đã đổi, fullscreen for 1,800-char multi-paragraph reports), SaveBar, 409 banner; equal priority desktop and 375 px phone; dark-only, tokens from `src/styles/tokens.css`; consistent with the approved Admin Direction B (Preview/Accounts). Include motion intent: button press, route/module change, save feedback; reduced-motion fallback.
- [x] **Step 2:** Present 3 directions (screenshots of list, record, bilingual field at desktop and phone). OWNER GATE: owner picks one (or mixes).
- [x] **Step 3:** Write `docs/admin-redesign/khi-gia-direction.md`: chosen direction, layout per breakpoint, which tokens/classes, component states, motion intent (what moves, duration, easing, reduced-motion behaviour). Screenshots with account emails are not committed (repo is public). Commit.

### Task 3: Shared API helper, characters API client, pure libs

**Files:** Create `src/admin/lib/api.js`, `src/admin/characters/charactersApi.js`, `src/admin/characters/lib/{route,fields,draft,saveError}.mts` + `.test.mts`; Modify `src/admin/preview/previewApi.js`.

**Interfaces — Produces:**
- `api(path: string, options?: RequestInit) → Promise<any>` throws `Error(code)` with `.status`, `.payload`; `json(method, body) → RequestInit`; `requestId() → string` (from `src/admin/lib/api.js`).
- `listCharacters()`, `getCharacter(id)`, `patchCharacter(id, { expectedRevision, changes })`, `getSkin(id)`, `patchSkin(id, { expectedRevision, changes })`.
- `parseCharactersRoute(hash) → { view: 'list' } | { view: 'record', id: string, module: ModuleId }`; `recordHref(id, module?) → string`; `MODULE_IDS = ['overview','skins','source','history'] as const`.
- `fieldValue(record, key) → string`; `changesFor(draft, record, keys) → Record<string, string | null>`; `isDirty(draft, record, keys) → boolean`.
- `draftKey(scope, id) → string`; `saveDraft(storage, key, value)`, `loadDraft(storage, key) → object | null`, `clearDraft(storage, key)` (never throw).
- `saveErrorMessage(error) → string`.

- [x] **Step 1: Write the failing tests**

```ts
// src/admin/characters/lib/route.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCharactersRoute, recordHref } from './route.mts';

test('parses list, record and module hashes', () => {
  assert.deepEqual(parseCharactersRoute('#/admin/characters'), { view: 'list' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001'), { view: 'record', id: 'A0001', module: 'overview' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001/skins'), { view: 'record', id: 'A0001', module: 'skins' });
  assert.deepEqual(parseCharactersRoute('#/admin/characters/A0001/nope'), { view: 'record', id: 'A0001', module: 'overview' });
  assert.equal(recordHref('A0001', 'history'), '#/admin/characters/A0001/history');
  assert.equal(recordHref('A0001'), '#/admin/characters/A0001');
});
```

```ts
// src/admin/characters/lib/fields.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesFor, fieldValue, isDirty } from './fields.mts';

const record = { nameVi: { value: 'Lộc', source: 'Lộc', override: null, state: 'none' }, tagsVi: { value: 'a', source: 'b', override: 'a', state: 'active' } };

test('changesFor sends only changed keys and turns empty into null (revert to source)', () => {
  assert.deepEqual(changesFor({ nameVi: 'Lộc', tagsVi: '  ' }, record, ['nameVi', 'tagsVi']), { tagsVi: null });
  assert.deepEqual(changesFor({ nameVi: 'Lộc Giác', tagsVi: 'a' }, record, ['nameVi', 'tagsVi']), { nameVi: 'Lộc Giác' });
  assert.equal(isDirty({ nameVi: 'Lộc', tagsVi: 'a' }, record, ['nameVi', 'tagsVi']), false);
  assert.equal(fieldValue(record, 'missing'), '');
});
```

```ts
// src/admin/characters/lib/draft.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft.mts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

test('round-trips a draft and never throws when storage is unavailable', () => {
  const s = memory();
  const key = draftKey('character', 'A0001');
  saveDraft(s, key, { nameVi: 'x' });
  assert.deepEqual(loadDraft(s, key), { nameVi: 'x' });
  clearDraft(s, key);
  assert.equal(loadDraft(s, key), null);
  assert.doesNotThrow(() => { saveDraft(broken, key, {}); clearDraft(broken, key); });
  assert.equal(loadDraft(broken, key), null);
});
```

```ts
// src/admin/characters/lib/saveError.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveErrorMessage } from './saveError.mts';

const err = (status: number) => Object.assign(new Error('X'), { status });
test('maps save failures to Vietnamese messages', () => {
  assert.match(saveErrorMessage(err(409)), /người khác vừa lưu/);
  assert.match(saveErrorMessage(err(401)), /hết hạn/);
  assert.match(saveErrorMessage(err(403)), /không có quyền/);
  assert.match(saveErrorMessage(err(422)), /không hợp lệ/);
  assert.match(saveErrorMessage(new TypeError('Failed to fetch')), /Không thể lưu/);
});
```

- [x] **Step 2: Run to verify they fail** — `npm test` → the four new files fail with `ERR_MODULE_NOT_FOUND`.

- [x] **Step 3: Implement**

```ts
// src/admin/characters/lib/route.mts
export const MODULE_IDS = ['overview', 'skins', 'source', 'history'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type CharactersRoute = { view: 'list' } | { view: 'record'; id: string; module: ModuleId };
const BASE = '#/admin/characters';

export function parseCharactersRoute(hash: string): CharactersRoute {
  const [id, module] = hash.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent);
  if (!id) return { view: 'list' };
  return { view: 'record', id, module: (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : 'overview' };
}

export const recordHref = (id: string, module?: ModuleId) => `${BASE}/${encodeURIComponent(id)}${module ? `/${module}` : ''}`;
```

```ts
// src/admin/characters/lib/fields.mts
type Field = { value?: string | null };
export const fieldValue = (record: Record<string, Field | unknown> | null | undefined, key: string) =>
  String((record?.[key] as Field | undefined)?.value ?? '');

// Empty input means "back to source": the API clears the override when it receives null.
export function changesFor(draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) {
  const changes: Record<string, string | null> = {};
  for (const key of keys) {
    const next = (draft[key] ?? '').trim();
    if (next !== fieldValue(record, key).trim()) changes[key] = next || null;
  }
  return changes;
}

export const isDirty = (draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) =>
  Object.keys(changesFor(draft, record, keys)).length > 0;
```

```ts
// src/admin/characters/lib/draft.mts
// Browser drafts are a convenience; storage can be blocked, so nothing here may throw.
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const draftKey = (scope: string, id: string) => `whmx:admin-draft:${scope}:${id}`;

export function saveDraft(storage: Storage, key: string, value: object) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function loadDraft(storage: Storage, key: string): Record<string, string> | null {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearDraft(storage: Storage, key: string) {
  try { storage.removeItem(key); } catch { /* storage unavailable */ }
}
```

```ts
// src/admin/characters/lib/saveError.mts
export function saveErrorMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 409) return 'Có người khác vừa lưu. Nội dung bạn đang gõ vẫn được giữ.';
  if (status === 401) return 'Phiên đăng nhập hết hạn. Đăng nhập lại để lưu; bản nháp vẫn được giữ.';
  if (status === 403) return 'Bạn không có quyền thực hiện thay đổi này.';
  if (status === 422) return 'Một hoặc nhiều trường không hợp lệ.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
```

```js
// src/admin/lib/api.js — shared by every admin area (moved from previewApi.js)
export function requestId() { return crypto.randomUUID(); }

// Throws Error(code) with .status (409 = VERSION_CONFLICT) and .payload.
export async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || 'REQUEST_FAILED');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
```

```js
// src/admin/characters/charactersApi.js
import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
export const listCharacters = () => api('/api/admin/characters');
export const getCharacter = (id) => api(`/api/admin/characters/${enc(id)}`);
export const patchCharacter = (id, { expectedRevision, changes }) =>
  api(`/api/admin/characters/${enc(id)}`, json('PATCH', { expectedRevision, changes, requestId: requestId() }));
export const getSkin = (id) => api(`/api/admin/skins/${enc(id)}`);
export const patchSkin = (id, { expectedRevision, changes }) =>
  api(`/api/admin/skins/${enc(id)}`, json('PATCH', { expectedRevision, changes, requestId: requestId() }));
```

In `src/admin/preview/previewApi.js`, delete the private `requestId`, `api` and `json` definitions and add `import { api, json, requestId } from '../lib/api.js';` plus `export { requestId };` (it was exported before; keep the export so callers are unchanged).

- [x] **Step 4: Verify** — `npm test` → all pass (previous 34 + 4 files). `grep -rn "requestId\|from './previewApi" src/admin/preview` shows callers unchanged; `npm run build` (background) passes.
- [x] **Step 5: Commit** — `feat(admin): shared admin api helper, characters API client, route/fields/draft/error libs`.

### Task 4: Editor primitives — useEditor, OverridableField, SaveBar, HistoryList

**Files:** Create `src/admin/characters/useEditor.ts`, `src/admin/characters/components/{OverridableField,SaveBar,HistoryList}.tsx`; Test `src/admin/characters/lib/editorState.test.mts` + `src/admin/characters/lib/editorState.mts` (pure reducer the hook wraps).

**Interfaces — Produces:**
- `editorReducer(state, action)` over `{ draft, saving, status: 'idle'|'saving'|'saved'|'error'|'conflict', message }` with actions `edit {key,value}`, `hydrate {draft}`, `saveStart`, `saveOk {draft}`, `saveFail {error}`, `discard {draft}`.
- `useEditor({ scope, id, record, keys, save: (changes) => Promise<void>, reload: () => Promise<void> })` → `{ draft, setField, dirtyCount, status, message, onSave, onDiscard }`; registers Ctrl+S, `beforeunload`, and `window.__whmxAdminDirty` guard used by in-app navigation.
- `<OverridableField label source override value onChange onRevert />`, `<SaveBar dirtyCount status message onSave onDiscard />`, `<HistoryList entries labels />`.

- [x] **Step 1: Failing test for the reducer (pins Review Focus 1 and 5)**

```ts
// src/admin/characters/lib/editorState.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorReducer, initialEditor } from './editorState.mts';

test('keeps typed values on 409 and on any failed save', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'typed' });
  s = editorReducer(s, { type: 'saveStart' });
  s = editorReducer(s, { type: 'saveFail', error: Object.assign(new Error('X'), { status: 409 }) });
  assert.equal(s.draft.nameVi, 'typed');
  assert.equal(s.status, 'conflict');
  s = editorReducer(s, { type: 'saveFail', error: Object.assign(new Error('X'), { status: 401 }) });
  assert.equal(s.draft.nameVi, 'typed');
  assert.equal(s.status, 'error');
  assert.match(s.message, /hết hạn/);
});

test('saveOk replaces the draft with the saved values; discard restores', () => {
  let s = editorReducer(initialEditor({ nameVi: 'a' }), { type: 'edit', key: 'nameVi', value: 'b' });
  s = editorReducer(s, { type: 'saveOk', draft: { nameVi: 'b' } });
  assert.deepEqual([s.draft.nameVi, s.status], ['b', 'saved']);
  s = editorReducer(s, { type: 'discard', draft: { nameVi: 'a' } });
  assert.deepEqual([s.draft.nameVi, s.status], ['a', 'idle']);
});
```

- [x] **Step 2: Run** — `npm test` → fails (module not found).
- [x] **Step 3: Implement**

```ts
// src/admin/characters/lib/editorState.mts
import { saveErrorMessage } from './saveError.mts';

export type EditorStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type EditorState = { draft: Record<string, string>; status: EditorStatus; message: string };
export type EditorAction =
  | { type: 'edit'; key: string; value: string }
  | { type: 'hydrate' | 'saveOk' | 'discard'; draft: Record<string, string> }
  | { type: 'saveStart' }
  | { type: 'saveFail'; error: unknown };

export const initialEditor = (draft: Record<string, string>): EditorState => ({ draft, status: 'idle', message: '' });

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'edit': return { ...state, draft: { ...state.draft, [action.key]: action.value }, status: state.status === 'saved' ? 'idle' : state.status };
    case 'hydrate': return initialEditor(action.draft);
    case 'saveStart': return { ...state, status: 'saving', message: '' };
    case 'saveOk': return { draft: action.draft, status: 'saved', message: 'Đã lưu.' };
    case 'discard': return initialEditor(action.draft);
    // The typed draft is never touched on failure (409, 401, network): nothing is lost.
    case 'saveFail': {
      const status = (action.error as { status?: number })?.status === 409 ? 'conflict' : 'error';
      return { ...state, status, message: saveErrorMessage(action.error) };
    }
  }
}
```

```ts
// src/admin/characters/useEditor.ts
import { useCallback, useEffect, useReducer } from 'react';
import { changesFor, fieldValue } from './lib/fields.mts';
import { clearDraft, draftKey, loadDraft, saveDraft } from './lib/draft.mts';
import { editorReducer, initialEditor } from './lib/editorState.mts';

type Args = { scope: string; id: string; record: Record<string, unknown> | null; keys: string[]; save: (changes: Record<string, string | null>) => Promise<void>; reload: () => Promise<void> };
const valuesOf = (record: Record<string, unknown> | null, keys: string[]) => Object.fromEntries(keys.map((k) => [k, fieldValue(record, k)]));

export function useEditor({ scope, id, record, keys, save, reload }: Args) {
  const key = draftKey(scope, id);
  const [state, dispatch] = useReducer(editorReducer, initialEditor(valuesOf(record, keys)));
  const changes = changesFor(state.draft, record ?? {}, keys);
  const dirtyCount = Object.keys(changes).length;

  useEffect(() => {
    const stored = loadDraft(localStorage, key);
    dispatch({ type: 'hydrate', draft: stored && confirm('Có bản nháp chưa lưu. Khôi phục?') ? stored : valuesOf(record, keys) });
  }, [key, record]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (dirtyCount) saveDraft(localStorage, key, state.draft); }, [key, state.draft, dirtyCount]);

  const onSave = useCallback(async () => {
    if (!dirtyCount || state.status === 'saving') return;
    dispatch({ type: 'saveStart' });
    try {
      await save(changes);
      clearDraft(localStorage, key);
      await reload();
      dispatch({ type: 'saveOk', draft: state.draft });
    } catch (error) {
      dispatch({ type: 'saveFail', error });
    }
  }, [dirtyCount, state, changes, save, reload, key]);

  const onDiscard = () => { clearDraft(localStorage, key); dispatch({ type: 'discard', draft: valuesOf(record, keys) }); };

  // Unsaved-change guards: Ctrl+S, tab close, and a flag read by in-app navigation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void onSave(); } };
    const onUnload = (event: BeforeUnloadEvent) => { if (dirtyCount) event.preventDefault(); };
    (window as unknown as { __whmxAdminDirty?: boolean }).__whmxAdminDirty = dirtyCount > 0;
    addEventListener('keydown', onKey);
    addEventListener('beforeunload', onUnload);
    return () => { removeEventListener('keydown', onKey); removeEventListener('beforeunload', onUnload); (window as unknown as { __whmxAdminDirty?: boolean }).__whmxAdminDirty = false; };
  }, [onSave, dirtyCount]);

  return { draft: state.draft, setField: (k: string, v: string) => dispatch({ type: 'edit', key: k, value: v }), dirtyCount, status: state.status, message: state.message, onSave, onDiscard };
}
```

`OverridableField`, `SaveBar`, `HistoryList`: build to `docs/admin-redesign/khi-gia-direction.md`. Required behaviour (not styling):
- `OverridableField`: `<label>` with the field name; shows the CN/source value read-only; a `<textarea>` or `<input>` bound to `value`; badge "Đang dùng bản sửa" when `override !== null`; button "Trả về gốc" (calls `onRevert`, which sets the draft to `''` so `changesFor` sends `null`); `aria-describedby` links the source text.
- `SaveBar`: hidden (`max-md:` / conditional render, never bare `hidden`) when `dirtyCount === 0 && status === 'idle'`; shows "N thay đổi chưa lưu", buttons Lưu (disabled while saving) and Bỏ thay đổi; `role="status"` region for `message`; stays reachable on phones (sticky bottom).
- `HistoryList`: rows newest first: field label (from `labels`), old → new, actor, `toLocaleString('vi-VN')`.

- [x] **Step 4: Verify** — `npm test` passes; `node_modules/.bin/tsc -p tsconfig.json` clean; `npm run build` (background) passes.
- [x] **Step 5: Commit** — `feat(admin): editor state, useEditor hook and field/save/history primitives`.

### Task 5: List + record shell, mounted in AdminApp

**Files:** Create `src/admin/characters/{CharactersView,CharacterList,CharacterRecord}.tsx`; Modify `src/admin/layout/AdminApp.tsx:54-69,140-145`.

**Interfaces — Consumes:** Task 3 (`parseCharactersRoute`, `recordHref`, `MODULE_IDS`, `listCharacters`, `getCharacter`), Task 4 primitives. **Produces:** `<CharactersView />` (no props; reads `location.hash`, listens to `hashchange`); `MODULES: { id: ModuleId; label: string; Component }[]` in `CharacterRecord.tsx` (Phase 2 adds `lore` here).

- [x] **Step 1: Implement `CharactersView`** — state `route = parseCharactersRoute(location.hash)`, updated on `hashchange`; renders `<CharacterList />` or `<CharacterRecord id module />`. In-app links go through a `navigate(href)` that asks `confirm('Có thay đổi chưa lưu. Rời trang?')` when `window.__whmxAdminDirty` and otherwise sets `location.hash`.
- [x] **Step 2: Implement `CharacterList`** — loads `listCharacters()` once (cache in a module-level promise so returning from a record is instant); search box filters on `characterId nameCn nameVi.value fullnameVi.value` (lower-case); each item: avatar `/assets/characters/avatars/${id}.png` with `loading="lazy"` and a text fallback on error, VI name, CN name, ID; click → `navigate(recordHref(id))`. States: loading, error with retry, empty search result.
- [x] **Step 3: Implement `CharacterRecord`** — loads `getCharacter(id)` (returns `{ character, skins, history }` as today); header (avatar, names, ID, back to list); module rail from `MODULES` (links with `recordHref(id, m.id)`, `aria-current="page"` on the active one; horizontal scroll on phones); renders the active module component with `{ data, reload }`.
- [x] **Step 4: Mount** — in `AdminApp.tsx` remove the Vue `useEffect` and `charRootRef`/`vueAppRef`; render `<CharactersView />` inside the existing characters `<div hidden={section !== 'characters'} …>` wrapper (keep `ViewHeader`). Keep it mounted after first visit like Preview so an unsaved draft survives switching areas.
- [x] **Step 5: Browser check** — `preview_start whmxcalc-vercel-dev` (needs DB: uses `.env.local` = development branch). Owner signs in (or approved temp account on the development branch). Open `#/admin/characters`: 133 items; search "Lộc" narrows; open A0061 → header + rail; switch modules via rail → hash changes; Back returns to list. `read_console_messages` onlyErrors → none.
- [x] **Step 6: Commit** — `feat(admin): React Khí Giả list and record shell replaces the Vue mount`.

### Task 6: Parity modules — Tổng quan, Trang phục, Nguồn, Lịch sử

**Files:** Create `src/admin/characters/modules/{OverviewModule,SkinsModule,SourceModule,HistoryModule}.tsx`; register them in `MODULES`.

**Interfaces — Consumes:** `useEditor`, `OverridableField`, `SaveBar`, `HistoryList`, `patchCharacter`, `patchSkin`, `getSkin`.

- [x] **Step 1: OverviewModule** — keys `['nameVi','fullnameVi','nicknameVi','tagsVi']`, labels `Tên tiếng Việt / Tên đầy đủ tiếng Việt / Biệt danh tiếng Việt / Thẻ tiếng Việt`, source CN from `character.nameCn / fullnameCn / — / tagsCn`; `useEditor({ scope: 'character', id, record: character, keys, save: (changes) => patchCharacter(id, { expectedRevision: character.revision, changes }), reload })`; fields in place; `SaveBar`.
- [x] **Step 2: SkinsModule** — grid/list of `skins` (image from the skin's asset URL or `/assets/characters/avatars/${skinId.toLowerCase()}.png`, VI/CN name); selecting a skin loads `getSkin(skinId)` and opens its editor inline under the list (keys `['skinNameVi','descriptionVi','obtainVi']`, `scope: 'skin'`), read-only series/acquisition/asset info as today; one `SaveBar` for the open skin.
- [x] **Step 3: SourceModule** — read-only: Character ID, source snapshot, workbook snapshot, raw rare/job/attack type/unlock date from `character.protected`.
- [x] **Step 4: HistoryModule** — `HistoryList` with labels for the 7 fields and event labels `source_baseline / source_import / admin_override / override_cleared / human_edit`.
- [x] **Step 5: Browser check (development branch)** — edit nameVi → SaveBar "1 thay đổi" → Ctrl+S → saved; History shows it; "Trả về gốc" + save → value back to source, history shows `override_cleared`; open a second tab, save there, save in the first → 409 banner and typed value still present; reload with an unsaved edit → "Khôi phục?" prompt restores it. Skin: edit description, save, revert.
- [x] **Step 6: Commit** — `feat(admin): overview, skins, source and history modules`. Then run `ponytail:ponytail-review` on the diff since Task 3's base; apply its deletions/simplifications with tests still green; commit `refactor(admin): ponytail review`.

### Task 7: Parity check, delete Vue

**Files:** Delete `src/admin/character-skin/`, `src/admin/styles/characterSkinAdmin.css`; Modify `package.json`/`package-lock.json` (remove `vue`), any import of `characterSkinAdmin.css`.

- [x] **Step 1: Parity checklist (Playwright, development branch)** — every Vue capability works in React: search; open character; edit/save/revert 4 character fields; skins list; open skin; edit/save/revert 3 skin fields; read-only series/acquisition/assets; source; history labels; 409; an editor account can edit (no owner-only actions here); plus new: drafts, leave-page prompt, module URLs. Record results in the pipeline plan log.
- [x] **Step 2: Phone check** — `resize_window` mobile preset: list and record, no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), SaveBar visible after editing; reset to desktop.
- [x] **Step 3: Delete** — `git rm -r src/admin/character-skin src/admin/styles/characterSkinAdmin.css`; `grep -rn "character-skin\|characterSkinAdmin\|from 'vue'" src index.html` → nothing; `npm uninstall vue` (background) — owner already approved removing Vue in the spec.
- [x] **Step 4: Verify** — `npm test`, `tsc`, `npm run build` all pass; bundle size before/after noted.
- [x] **Step 5: Commit** — `chore(admin): remove the Vue Khí Giả workspace and the vue dependency`.

### Task 8: Motion

**Files:** Modify the components from Tasks 4–6 and `src/admin/layout/styles/globals.css` per the motion intent in `khi-gia-direction.md`.

- [x] **Step 1:** Implement press/hover feedback with CSS transitions; module/record route changes with the View Transitions API (`document.startViewTransition?.(() => …)` around the hash-driven state update in `CharactersView`, feature-detected); save feedback per the direction. All wrapped in `@media (prefers-reduced-motion: no-preference)`.
- [x] **Step 2:** Only if an effect the owner asked for cannot be done with CSS/View Transitions: propose GSAP (dependency ~70 KB) to the owner first.
- [x] **Step 3: Verify** — browser: transitions run; with `emulate reduced motion` none run; `npm run build` passes.
- [x] **Step 4: Commit** — `feat(admin): Khí Giả motion`. Run `ponytail:ponytail-review` again on Tasks 4–8; commit any simplifications.

### Task 9: Review and release

- [x] **Step 1:** Final whole-branch review (fresh reviewer, most capable model) with this plan's Review Focus; fix Critical/Important with a failing test first.
- [x] **Step 2:** Merge-safety: `git fetch`; `origin/main` is an ancestor of HEAD; build the committed tree alone (in-project temp folder, deleted afterwards); `npm test`; validators unaffected (no data changes).
- [x] **Step 3:** Push branch, push `main`; after the production deploy: sign in on `whmxsite.vercel.app`, open Khí Giả, edit+revert one field, no console errors.
- [x] **Step 4:** Pipeline plan: P4 Phase 1 ✅; log; delete `bash-edit-diff`.
