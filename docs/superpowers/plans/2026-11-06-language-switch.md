# Language Switch VI / CN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site-wide VI / CN switch to the public site. Each language renders on its own, instead of CN being interleaved with VI.

**Architecture:**
- One tiny module, `src/i18n/lang.mts`, owns the current language and the field pickers.
- `src/i18n/strings.ts` holds the UI strings.
- Changing the language dispatches `whmx:lang`. The router re-renders the current route, and React islands subscribe with a hook.
- No data format changes.

**Tech Stack:** Vite, vanilla JS views, React + TS islands, and `node --test` for `*.test.mts`.

**Spec:** `docs/superpowers/specs/2026-11-06-language-switch-design.md`

## Global Constraints
- Two modes, `'vi' | 'cn'`. The default is `'vi'`.
- localStorage key: `whmx.lang`. URL param: `?lang=vi|cn`. The URL wins and is written back.
- **VI mode:** use the `*_vi` value. If it is empty, fall back to `*_cn` and keep the existing untranslated styling (dot, `lore-cn`, `build-cn`, `ctile-cn`). Add no new label.
- **CN mode:** use `*_cn` everywhere. Never show the untranslated dot.
- In VI mode, the small Han name under the character header title stays. Every other "VI + CN beside it" pair shows only the active language.
- No i18n library. Do not touch Admin (`src/admin/**`), the workbook, `tools/`, the DB or R2.
- UI code is React + TS for anything new. Styles use tokens only and the dark theme only.
- Do not commit the workbook. Push and deploy only with the owner's approval.

## Review Focus
- A broken URL param (`?lang=en`, `?lang=`): fall back to the stored choice or `vi`, and never crash. Test in Task 1.
- localStorage is unavailable (private mode throws): `getLang` still returns a value. Test in Task 1.
- Language switch while a popup or modal is open: the re-render closes it cleanly, with no stale overlay. Manual check in Task 3.
- The URL param must survive hash navigation (`?lang=cn#/characters/x`): changing hash keeps the query. Test in Task 1 (`langUrl`).
- CN mode on a field where `*_cn` is empty but `*_vi` exists (rare data): show VI rather than blank. Test in Task 1.

---

### Task 1: `lang.mts` core

**Files:**
- Create: `src/i18n/lang.mts`
- Test: `src/i18n/lang.test.mts`

**Interfaces:**
- Produces:
  - `type Lang = 'vi' | 'cn'`
  - `type Unit = { text: string; untranslated: boolean }`
  - `getLang(): Lang`
  - `setLang(l: Lang): void`, which writes storage and the URL, sets `<html lang>`, and dispatches `window` event `whmx:lang`
  - `resolveLang(search: string, stored: string | null): Lang`, pure
  - `langUrl(href: string, l: Lang): string`, pure
  - `pickText(vi?: string | null, cn?: string | null, l?: Lang): Unit`
  - `pick(obj: Record<string, any> | null | undefined, field: string, l?: Lang): Unit`, which reads `${field}_vi` and `${field}_cn`
  - `txt(obj, field, l?): string`, a shorthand for `pick(...).text`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLang, langUrl, pickText, pick, txt } from './lang.mts';

test('resolveLang: url > stored > vi, junk ignored', () => {
  assert.equal(resolveLang('?lang=cn', 'vi'), 'cn');
  assert.equal(resolveLang('', 'cn'), 'cn');
  assert.equal(resolveLang('', null), 'vi');
  assert.equal(resolveLang('?lang=en', 'cn'), 'cn');
  assert.equal(resolveLang('?lang=', null), 'vi');
});

test('langUrl keeps hash and other params', () => {
  assert.equal(langUrl('https://x.app/?a=1#/characters/y', 'cn'), 'https://x.app/?a=1&lang=cn#/characters/y');
  assert.equal(langUrl('https://x.app/?lang=cn#/', 'vi'), 'https://x.app/?lang=vi#/');
});

test('pickText', () => {
  assert.deepEqual(pickText('Kiếm', '剑', 'vi'), { text: 'Kiếm', untranslated: false });
  assert.deepEqual(pickText('', '剑', 'vi'), { text: '剑', untranslated: true });
  assert.deepEqual(pickText('Kiếm', '剑', 'cn'), { text: '剑', untranslated: false });
  assert.deepEqual(pickText('Kiếm', '', 'cn'), { text: 'Kiếm', untranslated: false });
  assert.deepEqual(pickText(null, null, 'vi'), { text: '', untranslated: false });
});

test('pick / txt read *_vi / *_cn', () => {
  const o = { name_vi: '', name_cn: '剑', desc_vi: 'Mô tả', desc_cn: '描述' };
  assert.deepEqual(pick(o, 'name', 'vi'), { text: '剑', untranslated: true });
  assert.equal(txt(o, 'desc', 'cn'), '描述');
  assert.equal(txt(undefined, 'name', 'vi'), '');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test src/i18n/lang.test.mts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
export type Lang = 'vi' | 'cn';
export type Unit = { text: string; untranslated: boolean };
const KEY = 'whmx.lang';
const valid = (v: unknown): v is Lang => v === 'vi' || v === 'cn';

export function resolveLang(search: string, stored: string | null): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (valid(q)) return q;
  return valid(stored) ? stored : 'vi';
}

export function langUrl(href: string, l: Lang): string {
  const u = new URL(href);
  u.searchParams.set('lang', l);
  return u.toString();
}

function stored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

let current: Lang | null = null;
export function getLang(): Lang {
  if (current) return current;
  if (typeof window === 'undefined') return 'vi';
  current = resolveLang(location.search, stored());
  document.documentElement.lang = current === 'cn' ? 'zh' : 'vi';
  return current;
}

export function setLang(l: Lang): void {
  if (l === getLang()) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode: URL still carries it */ }
  history.replaceState(history.state, '', langUrl(location.href, l));
  document.documentElement.lang = l === 'cn' ? 'zh' : 'vi';
  window.dispatchEvent(new CustomEvent('whmx:lang', { detail: l }));
}

export function pickText(vi?: string | null, cn?: string | null, l: Lang = getLang()): Unit {
  if (l === 'cn') return { text: cn || vi || '', untranslated: false };
  return vi ? { text: vi, untranslated: false } : { text: cn || '', untranslated: !!cn };
}

export const pick = (o: Record<string, any> | null | undefined, field: string, l?: Lang): Unit =>
  pickText(o?.[`${field}_vi`], o?.[`${field}_cn`], l);
export const txt = (o: Record<string, any> | null | undefined, field: string, l?: Lang): string => pick(o, field, l).text;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test src/i18n/lang.test.mts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/lang.mts src/i18n/lang.test.mts
git commit -m "feat(i18n): language state and field pickers"
```

---

### Task 2: UI strings + React hook

**Files:**
- Create: `src/i18n/strings.ts`
- Create: `src/i18n/useLang.ts`
- Test: `src/i18n/strings.test.mts`

**Interfaces:**
- Consumes: `getLang`, `Lang` from Task 1.
- Produces:
  - `strings: Record<Lang, Record<StringKey, string>>`
  - `type StringKey`
  - `s(key: StringKey, l?: Lang): string`
  - `useLang(): Lang`, a React hook that re-renders on `whmx:lang`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { strings, s } from './strings.ts';

test('every vi key has a non-empty cn key and vice versa', () => {
  assert.deepEqual(Object.keys(strings.cn).sort(), Object.keys(strings.vi).sort());
  for (const [k, v] of Object.entries(strings.cn)) assert.ok(v, `cn.${k} empty`);
});

test('s() returns the requested language', () => {
  assert.equal(s('navCharacters', 'vi'), 'Khí Giả');
  assert.equal(s('navCharacters', 'cn'), '器者');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test src/i18n/strings.test.mts`
Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement**

`strings.ts` starts with the nav keys. Later tasks append keys as they convert views, adding each to both `vi` and `cn`. Mark every CN string that Claude drafted (no in-game source) with `// draft`.

```ts
import { getLang, type Lang } from './lang.mts';

const vi = {
  navCharacters: 'Khí Giả', navTier: 'Tier List', navSkins: 'Trang Phục', navInfo: 'Thông tin', navTools: 'Công cụ',
  navAdmin: 'Quản trị', navLogin: 'Đăng nhập', navLang: 'Ngôn ngữ',
};
export type StringKey = keyof typeof vi;
const cn: Record<StringKey, string> = {
  navCharacters: '器者', navTier: '强度榜', // draft
  navSkins: '装束', navInfo: '资料', // draft
  navTools: '工具', // draft
  navAdmin: '管理', navLogin: '登录', navLang: '语言', // draft
};
export const strings: Record<Lang, Record<StringKey, string>> = { vi, cn };
export const s = (key: StringKey, l: Lang = getLang()) => strings[l][key];
```

`useLang.ts`:

```ts
import { useSyncExternalStore } from 'react';
import { getLang } from './lang.mts';
const sub = (cb: () => void) => { window.addEventListener('whmx:lang', cb); return () => window.removeEventListener('whmx:lang', cb); };
export const useLang = () => useSyncExternalStore(sub, getLang, () => 'vi' as const);
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --test src/i18n/strings.test.mts`
Expected: PASS. If `node --test` cannot load `.ts`, rename the file to `strings.mts` and update the imports; the existing tests already import `.mts`.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/strings.ts src/i18n/useLang.ts src/i18n/strings.test.mts
git commit -m "feat(i18n): UI string table and useLang hook"
```

---

### Task 3: Toggle in the nav + re-render (Phase 1 shell)

**Files:**
- Modify: `src/app/layout/AppNav.tsx`
  - desktop footer, around lines 122-135;
  - mobile menu, around lines 245-266;
  - `PUBLIC_LINKS` labels.
- Modify: `src/app/router/router.js`, around line 404 (next to the `hashchange` listener).
- Modify: the nav stylesheet that holds `.app-nav-footer` (`grep -rn "app-nav-footer" src/styles src/style.css`).

**Interfaces:**
- Consumes: `getLang`, `setLang` (Task 1); `s`, `useLang` (Task 2); `handleRoute` (router).
- Produces: a `LangToggle` component (local to `AppNav.tsx`), and a router that re-renders on `whmx:lang`.

- [ ] **Step 1: Re-render on language change.** In `router.js`, next to `window.addEventListener('hashchange', handleRoute);`, add:

```js
window.addEventListener('whmx:lang', handleRoute);
```

- [ ] **Step 2: Add the toggle.** In `AppNav.tsx`:
  - Call `const lang = useLang();`.
  - Change labels: `PUBLIC_LINKS` labels resolve through `s(...)` at render time, and `adminLabel` uses `s(authorized ? 'navAdmin' : 'navLogin')`.
  - Inside `.app-nav-footer`, **before** the admin `<a>`, add:

```tsx
<div className="app-nav-lang" role="group" aria-label={s('navLang')} data-tooltip={lang === 'vi' ? 'VI' : '中'}>
  {(['vi', 'cn'] as const).map((l) => (
    <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? 'is-active' : undefined} onClick={() => setLang(l)}>
      {l === 'vi' ? 'VI' : '中'}
    </button>
  ))}
</div>
```

  In the mobile menu, add the same block above the Quản trị / Đăng nhập section.

- [ ] **Step 3: CSS (tokens only).**
  - `.app-nav-lang` is a 2-segment pill with the same height as `.app-nav-item`, and `.is-active` uses the accent token.
  - When the rail is collapsed (reuse the existing collapsed selector that hides `.app-nav-label`), hide the inactive button so only the current code shows.

- [ ] **Step 4: Verify in the browser.**
  - Start a preview of the dev server.
  - Click 中: nav labels switch, the URL gains `?lang=cn`, and the page has no console errors.
  - Reload: it stays CN.
  - Open a skill popup, then switch: the popup is gone and there is no stale overlay.
  - Check the collapsed rail and a 390 px width (mobile menu).

- [ ] **Step 5: Run `npm test` and expect it to pass. Then commit:**

```bash
git add src/app/layout/AppNav.tsx src/app/router/router.js src/styles
git commit -m "feat(i18n): VI/中 toggle in the nav, re-render on change"
```

---

### Task 4: Character list + tiles (end of Phase 1)

**Files:**
- Modify: `src/features/characters/views/characterCatalogView.js` (lines 54, 76-77, 117, plus static UI text)
- Modify: `src/features/characters/components/CharacterTile.tsx`
- Modify: `src/ui/calcCharacterPicker.js`
- Modify: `src/i18n/strings.ts` (new keys)

**Interfaces:**
- Consumes: `pick`, `txt` (Task 1); `s` (Task 2).

Conversion rules (these are the same rules in Tasks 5-7):

| Before | After |
|---|---|
| `x.name_vi \|\| x.name_cn` | `txt(x, 'name')` |
| A `{name, untranslated}` prop built from vi/cn | `pick(x, 'name')` |
| A side CN span next to a VI value (`nameCn`, `*-cn` element) | render it only when `getLang() === 'vi'` **and** it is the character-header Han name; otherwise drop it |
| Hard-coded Vietnamese UI text | `s('key')`, with the key added to both `vi` and `cn` |
| `localeCompare(..., 'vi')` | `localeCompare(..., getLang() === 'cn' ? 'zh' : 'vi')` |

- [ ] **Step 1:** Apply the rules to the three files and add the new string keys.
- [ ] **Step 2:** Run `npm test`. Expect it to pass; the strings key-parity test catches a missing `cn` key.
- [ ] **Step 3:** Check in the browser that the list shows CN names in 中 mode, with no untranslated dot, sorting works, and the console has no errors.
- [ ] **Step 4:** Commit: `feat(i18n): character list follows language`.

---

### Task 5: Character detail tabs (Phase 2)

**Files:**
- Modify: `src/features/characters/components/characterHeader.js`
  - lines 78-79: keep `elNameCn` (the Han name) in VI mode, and hide it in CN mode because it would duplicate the title;
  - line 99: `txt(char, 'tags')`;
  - line 123.
- Modify: `src/features/characters/views/characterDetail.js` (242, 260, 267, 271: same Han-name rule)
- Modify: `src/features/characters/views/detail/overviewView.js` (41, 93, 126, plus static labels)
- Modify: `src/features/characters/views/detail/infoView.js`:
  - 156, 168, 181, 185: mechanic popups;
  - 513-518, 621-624: skills (drop the `nameCn` / `descCn` secondary lines);
  - 693-697: Hoán Chương (`buff_show`, `info`, `name`);
  - 732: materials.
- Modify: `src/features/characters/views/detail/talentsView.js` (154, 160, 267-269)
- Modify: `src/ui/talentGraph.js`
- Modify: `src/features/characters/views/detail/galleryView.js` (20-31, 99, 238)
- Modify: `src/features/characters/views/detail/buildView.js` (17)

Apply the Task 4 rules. Two special cases in `infoView.js`:
- In CN mode, the mechanic body is `binding.desc_cn`. Bypass the `canonical_vi_missing` logic, for example with `getLang() === 'cn' ? binding.desc_cn : <existing expression>`.
- The skill-level secondary CN line (`descCn`, `nameCn`) is removed in both modes.

- [ ] **Step 1:** Convert `characterHeader.js`, `characterDetail.js` and `overviewView.js`. Run `npm test` and check the Overview tab in both languages.
- [ ] **Step 2:** Convert `infoView.js`. Run `npm test`. Check the Thông tin tab in both languages on A0142 and on one older character: skills, levels, mechanic popups, Hoán Chương, materials.
- [ ] **Step 3:** Convert `talentsView.js`, `talentGraph.js`, `galleryView.js` and `buildView.js`. Run `npm test` and check those tabs in both languages.
- [ ] **Step 4:** Commit: `feat(i18n): character detail follows language`.

---

### Task 6: Skins (Phase 3a)

**Files:**
- Modify: `src/features/skins/views/skinGalleryView.js` (90, 191-214)
- Modify: `src/features/skins/views/skinDetailView.js` (48-80): use `txt(skin,'name')`, `txt(skin,'obtain')`, `txt(skin,'series_name')`, and `txt(skin,'story')`. When `story` is empty, keep the existing `description_cn` fallback.

- [ ] **Step 1:** Apply the Task 4 rules and drop the side CN name and series lines.
- [ ] **Step 2:** Run `npm test` and check the skin gallery and detail pages in both languages.
- [ ] **Step 3:** Commit: `feat(i18n): skins follow language`.

---

### Task 7: Home, banners, lore, tea, build (Phase 3b)

**Files:**
- Modify: `src/features/home/HomePage.tsx` (39, 57-86): names via `txt`. The `<Cn>` event names stay CN; there is no VI source, so they show CN in both modes. Event kind uses `kind.vi && lang === 'vi' ? kind.text : e.kind_cn`.
- Modify: `src/features/banners/BannersPage.tsx`, `BannerSlice.tsx`, `bannersData.mts` (`untranslated` must be false in CN mode).
- Modify: `src/features/characters/build/buildView.mts` line 25: `unit()` becomes `pickText(vi, cn)`.
- Modify: `src/features/characters/lore/LoreTab.tsx`; find where lore units are built with `grep -rn "untranslated:" src/features/profile src/features/characters/lore` and route them through `pickText`.
- Modify: `src/features/characters/tea/TeaTab.tsx` (29, 44, 64, 71): drop the `tea-*-cn` side spans and build units with `pickText`.
- Each React component calls `useLang()` so it re-renders on the event, even when the router does not remount it.
- Static UI strings go through `s()`.

- [ ] **Step 1:** Convert `buildView.mts`. Run `npm test`; the existing build view tests should still pass because VI behaviour is unchanged.
- [ ] **Step 2:** Convert the lore and tea units and components. Check the Lore and Tea room tabs in both languages.
- [ ] **Step 3:** Convert home and banners. Check the home page and the banners page in both languages.
- [ ] **Step 4:** Run `npm test` in full and `npm run build`. Expect both to succeed.
- [ ] **Step 5:** Commit: `feat(i18n): home, banners, lore, tea, build follow language`.

---

### Task 8: Final verification + owner review of CN drafts

- [ ] Run `grep -rn "_vi || " src --include=*.js --include=*.ts --include=*.tsx --include=*.mts | grep -v -e admin -e test -e i18n`. Expect no remaining public-site hits (or each one justified).
- [ ] Do a browser pass in both languages: home, list, detail (every tab), skins, banners, tier list. Check 390 px, reload persistence and a shared `?lang=cn` link.
- [ ] Gather every `// draft` CN string in `strings.ts` into a table for the owner to approve.
- [ ] Ask the owner about push and deploy. Do not push without approval.
