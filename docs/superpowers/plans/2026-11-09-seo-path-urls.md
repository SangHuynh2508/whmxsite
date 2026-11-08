# SEO: path URLs + prerendered pages + sitemap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Owner's standing choice (state doc §9): **native** execution with `superpowers:executing-plans`, final review = self-review, no review subagents.

**Goal:** Public pages get real paths (`/characters/<slug>/build`) and a prerendered HTML file each with its own title/meta/OG and a short text block, plus `sitemap.xml` / `robots.txt`.

**Architecture:** One small location module turns "where am I" into the same `#/…`-shaped string every existing parser already reads, so the parsers stay as they are; navigation becomes `history.pushState` + one custom event `whmx:route`. A Node script after `vite build` copies `dist/index.html` into ~750 page files with page meta, using a pure, tested page builder.

**Tech Stack:** Vite 7, vanilla JS + React 19 islands, node:test, Vercel static hosting.

**Spec:** [`docs/superpowers/specs/2026-11-09-seo-path-urls-design.md`](../specs/2026-11-09-seo-path-urls-design.md)

## Global Constraints

- Site origin is one constant: `SITE_ORIGIN = 'https://whmxsite.vercel.app'` (in `tools/prerender-lib.mjs`).
- Admin stays on the hash: `#/admin…`, `#/login` (served at `/`). No file under `src/admin/` changes except where a task names it.
- No new npm dependency; no new Vercel function.
- Untranslated names show the Chinese original, never a guess (PRODUCT principle 1).
- All text written into HTML is escaped (`& < > " '`).
- No visual change to any page; dark only; no horizontal scroll at 390 px.
- No git commit/push and no deploy without the owner's yes (memory `whmx-working-rules`). "Commit" steps below = stage the listed files and ask.

## Review Focus

1. **A relative asset URL on a deep path** (`assets/items/…` on `/characters/x/build`) must still load → `<base href="/">` (Task 2) + browser check of Tea, Talents, calculator icons (Task 8).
2. **An old shared link** `#/characters/x/lore`, `#/tier-list/a/teams`, `#calc?char=W0182`, `#W0182` must open the same page → `legacyHashToPath` tests (Task 1).
3. **Ctrl/middle-click or a `target=_blank` link** must open a new tab, not navigate in place → interceptor test (Task 1).
4. **A Chinese-only name or a name with `"`/`<`** must not break the HTML → `renderPage` escaping test (Task 5).
5. **R2 down at build time** must not fail the deploy → `loadTierLists` returns `[]` test (Task 6).

---

## File map

| File | Change |
|---|---|
| `src/app/router/location.mts` (new) + `.test.mts` | `routeString`, `legacyHashToPath`, `navigate`, `shouldIntercept`, `ROUTE_EVENT` |
| `src/app/router/router.js` | read `routeString()`, listen to `ROUTE_EVENT`, redirects via `navigate`, `calculatorHash` → path |
| `src/app/router/characterHash.mts` (+test) | returns a path |
| `src/app/bootstrap/boot.js`, `src/app/analytics/pageRoute.mts` | analytics on `ROUTE_EVENT`; remove prerender block |
| `src/app/layout/AppNav.tsx`, `backToTopButton.js`, `src/features/music/MusicPage.tsx`, `src/features/banners/BannersPage.tsx`, `src/ui/calcCharacterPicker.js`, `src/data/state.js` | `location.hash`/`hashchange` → `routeString()`/`ROUTE_EVENT` |
| Link builders (list in Task 3) | `#/…` → `/…` |
| `src/app/router/noHashLinks.test.mjs` (new) | guards Task 3 |
| `index.html` | `<base href="/">`, `#prerender` slot |
| `vercel.json` | SPA fallback rewrite |
| `tools/prerender-lib.mjs` (new) + `tools/prerender-lib.test.mjs` | pure: pages, renderPage, sitemap, robots |
| `tools/prerender.mjs` (new) | I/O; `package.json` `build` |
| `public/robots.txt` | deleted (generated) |
| `src/app/router/pageMeta.mts` (new) + test | runtime `document.title` + calculator `noindex` |

---

### Task 1: Location module

**Files:**
- Create: `src/app/router/location.mts`, `src/app/router/location.test.mts`

**Interfaces:**
- Produces:
  - `ROUTE_EVENT = 'whmx:route'`
  - `routeString(loc = location): string` — `'#' + pathname + search` for public pages (e.g. `'#/characters/x/build'`, `'#/calculator?char=W0182'`); for an admin hash (`#/admin…`, `#/login`) returns `loc.hash`. Root `/` → `'#/'`.
  - `legacyHashToPath(hash: string): string | null` — public `#…` hash → path, `null` for admin/empty.
  - `navigate(path: string, opts?: { replace?: boolean }): void` — push/replaceState, then `dispatchEvent(new Event(ROUTE_EVENT))`; a path starting `/#/` (admin) also dispatches `new HashChangeEvent('hashchange')`.
  - `shouldIntercept(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }, a: { target: string; hasAttribute(n: string): boolean; getAttribute(n: string): string | null; origin: string }, origin: string): boolean`
  - `initLinkInterception(): void` — document click listener using `shouldIntercept` → `navigate(href)`; `popstate` and `hashchange` → if `legacyHashToPath(location.hash)` gives a path, `navigate(path, {replace:true})`, else dispatch `ROUTE_EVENT`.

- [ ] **Step 1: Write the failing test** `src/app/router/location.test.mts`

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyHashToPath, routeString, shouldIntercept } from './location.mts';

const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash }) as Location;

test('routeString: path pages look like the old hash, admin keeps its hash', () => {
  assert.equal(routeString(loc('/')), '#/');
  assert.equal(routeString(loc('/characters/sach-kells/build')), '#/characters/sach-kells/build');
  assert.equal(routeString(loc('/calculator', '?char=W0182')), '#/calculator?char=W0182');
  assert.equal(routeString(loc('/characters/')), '#/characters');
  assert.equal(routeString(loc('/', '', '#/admin/characters/A0001')), '#/admin/characters/A0001');
  assert.equal(routeString(loc('/', '', '#/login')), '#/login');
});

test('legacyHashToPath: every old public form', () => {
  assert.equal(legacyHashToPath('#/characters/x/lore'), '/characters/x/lore');
  assert.equal(legacyHashToPath('#/tier-list/a/teams'), '/tier-list/a/teams');
  assert.equal(legacyHashToPath('#/banners?char=A0184&type=limited'), '/banners?char=A0184&type=limited');
  assert.equal(legacyHashToPath('#/music/bgm_map?g=story'), '/music/bgm_map?g=story');
  assert.equal(legacyHashToPath('#/'), '/');
  assert.equal(legacyHashToPath('#calc?char=W0182'), '/calculator?char=W0182');
  assert.equal(legacyHashToPath('#calc'), '/calculator');
  assert.equal(legacyHashToPath('#W0182'), '/calculator?char=W0182');
  assert.equal(legacyHashToPath('#/data'), '/weapons');
  assert.equal(legacyHashToPath('#/gallery-demo'), '/gallery');
  assert.equal(legacyHashToPath('#/admin'), null);
  assert.equal(legacyHashToPath('#/admin/dictionary/weapons'), null);
  assert.equal(legacyHashToPath('#/login'), null);
  assert.equal(legacyHashToPath(''), null);
  assert.equal(legacyHashToPath('#'), null);
});

const ev = (o = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...o });
const a = (href: string, o: { target?: string; download?: boolean; origin?: string } = {}) => ({
  target: o.target ?? '', origin: o.origin ?? 'https://w.app',
  hasAttribute: (n: string) => n === 'download' && !!o.download, getAttribute: (n: string) => (n === 'href' ? href : null),
});

test('shouldIntercept: only plain same-origin path clicks', () => {
  assert.equal(shouldIntercept(ev(), a('/characters/x'), 'https://w.app'), true);
  assert.equal(shouldIntercept(ev({ ctrlKey: true }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ metaKey: true }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ button: 1 }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ defaultPrevented: true }), a('/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/x', { target: '_blank' }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/x', { download: true }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('https://other.site/x', { origin: 'https://other.site' }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/api/auth/signin'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/data.json'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/#/admin'), 'https://w.app'), true);
});
```

- [ ] **Step 2: Run** `node --test src/app/router/location.test.mts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/app/router/location.mts`

```ts
// Public pages route by path (/characters/<slug>/build, spec 2026-11-09). The parsers in router.js, staticRoutes,
// tierRoute and musicData still read a '#/…' string, so routeString() hands them one; the admin keeps its hash.
export const ROUTE_EVENT = 'whmx:route';

const isAdminHash = (hash: string) => /^#\/(admin|login)(?:[/?]|$)/.test(hash);

export function routeString(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = location): string {
  if (isAdminHash(loc.hash)) return loc.hash;
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  return `#${path}${loc.search}`;
}

export function legacyHashToPath(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h || isAdminHash(hash)) return null;
  const [pathPart, query = ''] = h.split('?');
  const qs = query ? `?${query}` : '';
  if (/^\/?(calc|calculator)$/.test(pathPart)) return `/calculator${qs}`;
  if (!pathPart.includes('/')) return `/calculator?char=${encodeURIComponent(pathPart)}`; // '#W0182'
  const path = pathPart.replace(/^\/?/, '/');
  if (path === '/data') return '/weapons';
  if (path === '/gallery-demo') return '/gallery';
  return `${path}${qs}`;
}

export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (`${location.pathname}${location.search}${location.hash}` !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  if (path.startsWith('/#/')) dispatchEvent(new HashChangeEvent('hashchange'));
  dispatchEvent(new Event(ROUTE_EVENT));
}

// Files and endpoints served by Vercel, never app routes.
const NOT_A_PAGE = /^\/(api|assets|src)\/|\.[a-z0-9]+$/i;

export function shouldIntercept(
  e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  a: { target: string; origin: string; hasAttribute(n: string): boolean; getAttribute(n: string): string | null },
  origin: string,
): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== origin) return false;
  const href = a.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('//') && !NOT_A_PAGE.test(href.split(/[?#]/)[0]);
}

export function initLinkInterception() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !shouldIntercept(e, a, location.origin)) return;
    e.preventDefault();
    navigate(a.getAttribute('href')!);
  });
  const onHistory = () => {
    const legacy = legacyHashToPath(location.hash);
    if (legacy) navigate(legacy, { replace: true });
    else dispatchEvent(new Event(ROUTE_EVENT));
  };
  addEventListener('popstate', onHistory);
  addEventListener('hashchange', onHistory); // a pasted or typed old '#/…' link
}
```

- [ ] **Step 4: Run** `node --test src/app/router/location.test.mts` — Expected: PASS.
- [ ] **Step 5: Commit** (owner yes) `src/app/router/location.mts src/app/router/location.test.mts` — `router: location module for path URLs`.

---

### Task 2: Switch the router and every listener to paths

**Files:**
- Modify: `src/app/router/router.js` (L65–168 `parseHash`, L240–250, L405–415), `src/app/router/characterHash.mts` (+ `characterHash.test.mts`), `src/app/bootstrap/boot.js` (L20–33, L57–62), `src/app/analytics/pageRoute.mts` (comment only), `src/app/layout/AppNav.tsx` (L26–63, L105, L114, L231, L253, L285), `src/app/layout/backToTopButton.js` (L27), `src/features/music/MusicPage.tsx` (L24, L306–307, L342), `src/features/banners/BannersPage.tsx` (L21, L44), `src/ui/calcCharacterPicker.js` (L67–72), `src/data/state.js` (L34–40), `index.html` (`<head>`)

**Interfaces:**
- Consumes: Task 1 (`routeString`, `navigate`, `ROUTE_EVENT`, `initLinkInterception`, `legacyHashToPath`).
- Produces: `calculatorHash()` keeps its name and now returns `'/calculator?char=<ID>'` or `'/calculator'`; `canonicalCharacterHash` returns `'/characters/<slug>[/<tab>]'`.

- [ ] **Step 1: Update the failing test** in `src/app/router/characterHash.test.mts`: every expected `'#/characters/…'` becomes `'/characters/…'`. Run `node --test src/app/router/characterHash.test.mts` → FAIL.
- [ ] **Step 2:** `characterHash.mts` L6: ``return `/characters/${char.slug}${subtab && subtab !== 'overview' ? `/${subtab}` : ''}`;`` → test PASS.
- [ ] **Step 3: `router.js`.**
  - import `{ routeString, navigate, ROUTE_EVENT, initLinkInterception, legacyHashToPath }` from `./location.mts`.
  - `parseHash()`: `const raw = routeString(); const hash = raw.replace('#', '').trim();` and pass `raw` to `staticView(raw)` and `parseTierListHash(raw)` (they strip `#` themselves).
  - L112 `window.location.hash = '#/weapons'` → `navigate('/weapons', { replace: true })`; L133 → `navigate('/gallery', { replace: true })`.
  - `handleRoute` L245: `history.replaceState(null, '', canonical)` stays (now a path).
  - `calculatorHash()`: ``return state.character ? `/calculator?char=${state.character.id}` : '/calculator';``
  - `initRouter()`:

```js
export function initRouter() {
  initLinkInterception();
  window.addEventListener('popstate', () => { isPopStateNav = true; }); // registered before the interception's own popstate handler fires the route
  window.addEventListener(ROUTE_EVENT, handleRoute);
  const legacy = legacyHashToPath(location.hash); // an old shared '#/…' link opens the same page
  if (legacy) history.replaceState(null, '', legacy);
  window.addEventListener('whmx:lang', () => (parseHash().view === 'calculator' && state.character ? notify() : handleRoute()));
}
```
  Note: `initLinkInterception` registers its `popstate` listener first; move the `isPopStateNav` listener **above** `initLinkInterception()` so it runs first.
- [ ] **Step 4: `boot.js` analytics** — `pageForHash(routeString())`, listen on `ROUTE_EVENT` instead of `hashchange`; calculator subscriber L60: `const hash = routeString();`. Update the L20 comment ("Path routing via pushState + whmx:route; Vercel's auto-track is off because the router rewrites URLs in place").
- [ ] **Step 5: AppNav.tsx** — hrefs `'/characters'`, `'/tier-list'`, `'/gallery'`, `'/info'`, `'/calculator'`, brand/home `'/'`; `linkClick`: `if (href === '/calculator') { event.preventDefault(); navigate(calculatorHash()); }`; state `useState(routeString())`, listener `ROUTE_EVENT` (keep `hashchange` too, for admin); L231 `navigate(results[0].href)`; admin links `'/#/admin'` / `'/#/login'`.
- [ ] **Step 6:** `backToTopButton.js` L27 → `ROUTE_EVENT`. `MusicPage.tsx`: L24 `musicTrackId(routeString())`, `musicFilter(routeString())`; L306–307 `ROUTE_EVENT`; L342 `else navigate(h)`; L345 selector `'a[href^="/music/"]'`. `BannersPage.tsx` L21 `readFilters(routeString())`; L44 `replaceState` unchanged (builder returns a path after Task 3).
- [ ] **Step 7: Calculator URL sync.** `calcCharacterPicker.js` L67–72 and `state.js` L34–40: replace the hash logic with

```js
if (!routeString().includes('/characters/')) {
  const target = char ? `/calculator?char=${char.id}` : '/calculator';
  if (`${location.pathname}${location.search}` !== target) history.replaceState(null, '', target);
}
```
  (import `routeString` from `src/app/router/location.mts`; `calcCharacterPicker` keeps its existing `handleRoute`/notify behaviour after the replace).
- [ ] **Step 8: `index.html`** — first line in `<head>` after `<meta charset>`: `<base href="/" />` with comment `<!-- path URLs: relative asset paths (assets/items/…) resolve from the root on /characters/x/build -->`.
- [ ] **Step 9:** `npm test` and `npx tsc --noEmit -p tsconfig.json` → PASS (existing router/static/tier/music tests unchanged: they take strings).
- [ ] **Step 10: Commit** (owner yes) — `router: path URLs, legacy hash redirect, whmx:route event`.

---

### Task 3: Every public link builder → path

**Files:**
- Create: `src/app/router/noHashLinks.test.mjs`
- Modify: `src/app/layout/siteSearch.mts:23,26`, `src/features/banners/bannersData.mts:135`, `src/features/banners/BannerSlice.tsx:44`, `src/features/characters/build/buildView.mts:93`, `src/features/characters/catalogCard.mts:21`, `src/features/characters/views/characterDetail.js:125,252,300–324`, `src/features/home/HomePage.tsx:43,78,103`, `src/features/info/InfoPage.tsx:52–54`, `src/features/music/musicData.mts:88`, `src/features/skins/views/skinDetailView.js:43,93,118,158`, `src/features/skins/views/skinGalleryView.js:338,355,776,1040,1046`, `src/features/tier-list/tierRoute.mts:14`, `src/features/tier-list/tierView.mts:64`; tests asserting those strings: `siteSearch.test.mts`, `bannersData.test.mts`, `musicData.test.mts`, `tierRoute.test.mts`, `tierView.test.mts`, `buildView.test.mts`, `catalogCard.test.mts` (whichever exist).

- [ ] **Step 1: Write the failing guard test** `src/app/router/noHashLinks.test.mjs`

```js
// Public links are paths since 2026-11-09 (spec seo-path-urls §3). A '#/' link would still work (legacy redirect)
// but costs a history entry and skips the prerendered page, so none may come back outside the admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (n === 'admin' ? [] : walk(p)) : [p];
});

test('no "#/" link outside src/admin', () => {
  const hits = walk('src')
    .filter((p) => /\.(js|mjs|mts|ts|tsx)$/.test(p) && !/\.test\./.test(p))
    .flatMap((p) => readFileSync(p, 'utf8').split('\n').map((l, i) => [p, i + 1, l]))
    .filter(([, , l]) => /(href=|`|'|")#\/(?!admin|login)/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.deepEqual(hits.map(([p, n]) => `${p}:${n}`), []);
});
```
- [ ] **Step 2:** `node --test src/app/router/noHashLinks.test.mjs` → FAIL listing the files above.
- [ ] **Step 3:** In every listed file replace the `#/` prefix with `/` (e.g. ``href="/characters/${slug}/build"``, ``return qs ? `/banners?${qs}` : '/banners';``, ``return `/music${id ? …}` ``, ``tierListHref = … `/tier-list${…}` ``). Update the doc comments on those lines too. Update the listed unit tests' expected strings the same way.
- [ ] **Step 4:** `npm test` → PASS (incl. the guard).
- [ ] **Step 5: Commit** (owner yes) — `links: public hrefs are paths`.

---

### Task 4: Vercel SPA fallback

**Files:** Modify `vercel.json`

- [ ] **Step 1:** Append to `rewrites` (after the two API rules):

```json
{ "source": "/((?!api/|assets/|.*\\.[a-z0-9]+$).*)", "destination": "/index.html" }
```
  Vercel serves an existing file (a prerendered `/characters/x/index.html`) before rewrites, so this only catches paths without a file (calculator, a skin added after the build).
- [ ] **Step 2:** `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` → no error.
- [ ] **Step 3: Commit** (owner yes) — `vercel: SPA fallback for path URLs`.

---

### Task 5: Prerender page builder (pure)

**Files:**
- Create: `tools/prerender-lib.mjs`, `tools/prerender-lib.test.mjs`
- Modify: `package.json` `test` script: add `"tools/*.test.mjs"`

**Interfaces:**
- Produces:
  - `SITE_ORIGIN`, `DEFAULT_IMAGE = SITE_ORIGIN + '/og-image.jpg'`
  - `type Page = { path: string; title: string; description: string; image: string; text: string[] }` (text = paragraphs for the visible block)
  - `buildPages({ data, music, tierLists }): Page[]`
  - `renderPage(template: string, page: Page): string`
  - `sitemap(pages: Page[]): string`, `robots(): string`
  - `escapeHtml(s: string): string`

- [ ] **Step 1: Write the failing test** `tools/prerender-lib.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPages, renderPage, sitemap, robots, escapeHtml, SITE_ORIGIN, DEFAULT_IMAGE } from './prerender-lib.mjs';

const char = {
  id: 'W0097', slug: 'sach-kells', name_vi: 'Sách Kells', name_cn: '凯尔特之书', rare: 4, job: 4, tags_vi: 'Viễn Chiến; Hỗ Trợ',
  cards: ['https://r2/characters/w0097/cards/w0097001.webp', 'https://r2/characters/w0097/cards/w0097002.webp'],
  skills: [{ levels: [{ name_vi: 'Kỳ Tích', name_cn: '奇迹' }] }, { levels: [{ name_vi: '', name_cn: '圣言' }] }],
  profile: { eval_intro_vi: 'Một bộ sách <cổ> "quý".', eval_intro: '中文' },
  skins: [{ skinID: 'W0097001', is_base: true, name_vi: 'Tạo Hình', name_cn: '肖形' },
          { skinID: 'W0097002', is_base: false, name_vi: '', name_cn: '写照', obtain_vi: '', obtain_cn: '通过器者考核解锁' }],
};
const data = { characters: { W0097: char } };
const music = { tracks: [{ id: 'Bgm_Map', name_vi: 'Bản đồ', name_cn: '地图' }] };
const tierLists = [{ slug: 'tong-hop', status: 'published', doc: { title: 'Tổng hợp', author: '新月' } },
                   { slug: 'cu', status: 'archived', doc: { title: 'Cũ', author: 'x' } }];
const pages = buildPages({ data, music, tierLists });
const byPath = Object.fromEntries(pages.map((p) => [p.path, p]));

test('buildPages: the page set', () => {
  for (const p of ['/', '/characters', '/characters/sach-kells', '/characters/sach-kells/build', '/characters/sach-kells/lore',
    '/skins/W0097002', '/gallery', '/tier-list', '/tier-list/tong-hop', '/music', '/music/Bgm_Map', '/banners', '/info']) assert.ok(byPath[p], p);
  assert.equal(byPath['/skins/W0097001'], undefined, 'base skin has no page');
  assert.equal(byPath['/tier-list/cu'], undefined, 'archived list has no page');
});

test('buildPages: character meta, CN fallback, card image', () => {
  const p = byPath['/characters/sach-kells'];
  assert.equal(p.title, 'Sách Kells (凯尔特之书) — Vật Hoa Di Tân Wiki');
  assert.match(p.description, /Kỳ Tích/);
  assert.match(p.description, /圣言/); // untranslated skill shows the Chinese name
  assert.equal(p.image, char.cards[0]);
  assert.equal(byPath['/characters/sach-kells/build'].title, 'Build Sách Kells — Vật Hoa Di Tân Wiki');
  assert.match(byPath['/characters/sach-kells/lore'].description, /Một bộ sách/);
  assert.equal(byPath['/skins/W0097002'].title, '写照 — Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(byPath['/skins/W0097002'].image, char.cards[1]);
  assert.equal(byPath['/'].image, DEFAULT_IMAGE);
});

const template = `<html><head><base href="/" /><title>Vật Hoa Di Tân Wiki</title>
<meta name="description" content="x" />
<meta property="og:title" content="x" />
<meta property="og:description" content="x" />
<meta property="og:url" content="${SITE_ORIGIN}/" />
<meta property="og:image" content="${DEFAULT_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
</head><body><div id="prerender" class="prerender"></div></body></html>`;

test('renderPage: meta replaced, canonical added, text escaped', () => {
  const html = renderPage(template, byPath['/characters/sach-kells/lore']);
  assert.match(html, /<title>Hồ sơ Sách Kells — Vật Hoa Di Tân Wiki<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE_ORIGIN}/characters/sach-kells/lore" />`));
  assert.match(html, new RegExp(`og:url" content="${SITE_ORIGIN}/characters/sach-kells/lore"`));
  assert.match(html, /og:image" content="https:\/\/r2\/characters\/w0097\/cards\/w0097001.webp"/);
  assert.doesNotMatch(html, /og:image:width/); // card size is not 1200×630
  assert.match(html, /&lt;cổ&gt; &quot;quý&quot;/);
  assert.doesNotMatch(html, /<cổ>/);
  assert.match(html, /<div id="prerender" class="prerender"><h1>Hồ sơ Sách Kells<\/h1>/);
  assert.match(renderPage(template, byPath['/']), /og:image:width/); // default image keeps its size
});

test('escapeHtml', () => assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'));

test('sitemap + robots', () => {
  const xml = sitemap(pages);
  assert.match(xml, new RegExp(`<loc>${SITE_ORIGIN}/characters/sach-kells/build</loc>`));
  assert.equal((xml.match(/<url>/g) || []).length, pages.length);
  assert.match(robots(), new RegExp(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`));
  assert.doesNotMatch(robots(), /whmxcalc/);
});
```
- [ ] **Step 2:** `node --test tools/prerender-lib.test.mjs` → FAIL (module not found).
- [ ] **Step 3: Implement** `tools/prerender-lib.mjs`

```js
// Static page files for search engines and link previews (spec 2026-11-09 seo-path-urls §4–5). Pure: no I/O.
export const SITE_ORIGIN = 'https://whmxsite.vercel.app'; // one place to change for a custom domain
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;
const SITE = 'Vật Hoa Di Tân Wiki';
const DEFAULT_DESC = 'Tra cứu nhân vật, kỹ năng, build và cốt truyện Vật Hoa Di Tân bằng tiếng Việt.';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vi = (o, k) => (o?.[`${k}_vi`] || o?.[`${k}_cn`] || '').trim(); // VI, else the Chinese original
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const strip = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const page = (path, heading, description, image = DEFAULT_IMAGE, text = []) =>
  ({ path, title: path === '/' ? SITE : `${heading} — ${SITE}`, heading, description: cut(description, 160), image, text: [description, ...text] });

export function buildPages({ data, music, tierLists }) {
  const pages = [
    page('/', SITE, DEFAULT_DESC),
    page('/characters', 'Danh sách Khí Giả', 'Toàn bộ Khí Giả Vật Hoa Di Tân: độ hiếm, hệ, vai trò, kỹ năng và build.'),
    page('/gallery', 'Trang phục', 'Toàn bộ trang phục Khí Giả Vật Hoa Di Tân.'),
    page('/tier-list', 'Tier list', 'Bảng xếp hạng Khí Giả Vật Hoa Di Tân.'),
    page('/music', 'Nhạc', 'Nhạc nền Vật Hoa Di Tân theo sự kiện, cốt truyện và khu vực.'),
    page('/banners', 'Banner', 'Banner hiện tại và lịch sử banner Vật Hoa Di Tân.'),
    page('/info', 'Thông tin', 'Banner, nhạc và dữ liệu Vật Hoa Di Tân.'),
  ];
  for (const c of Object.values(data.characters)) {
    const name = vi(c, 'name');
    const image = c.cards?.[0] || DEFAULT_IMAGE;
    const skills = (c.skills ?? []).map((g) => vi(g.levels?.[0], 'name')).filter(Boolean);
    const base = `/characters/${c.slug}`;
    pages.push(page(base, `${name} (${c.name_cn})`, `${name} (${c.name_cn}) — Khí Giả ${c.rare}★${c.tags_vi ? `, ${c.tags_vi.replaceAll(';', ',')}` : ''}. Kỹ năng: ${skills.join(', ')}.`, image));
    pages.push(page(`${base}/build`, `Build ${name}`, `Vũ khí, dòng thuộc tính, thâm tạo, chuỗi kỹ năng và đội hình gợi ý cho ${name}.`, image));
    const intro = strip(c.profile?.eval_intro_vi || c.profile?.eval_intro);
    pages.push(page(`${base}/lore`, `Hồ sơ ${name}`, intro || `Hồ sơ lưu trữ, báo cáo và di vật của ${name}.`, image));
    for (const s of c.skins ?? []) {
      if (s.is_base) continue;
      const card = c.cards?.find((u) => u.endsWith(`/${s.skinID.toLowerCase()}.webp`)) || image;
      pages.push(page(`/skins/${s.skinID}`, `${vi(s, 'name')} — ${name}`, `Trang phục ${vi(s, 'name')} của ${name}. ${vi(s, 'obtain')}`.trim(), card));
    }
  }
  for (const l of tierLists ?? []) {
    if (l.status !== 'published') continue;
    pages.push(page(`/tier-list/${l.slug}`, `Tier list ${l.doc.title}`, `Tier list "${l.doc.title}" của ${l.doc.author}.`));
  }
  for (const t of music?.tracks ?? []) pages.push(page(`/music/${encodeURIComponent(t.id)}`, vi(t, 'name') || t.id, `Nghe "${vi(t, 'name') || t.id}" — nhạc Vật Hoa Di Tân.`));
  return pages;
}

const setMeta = (html, attr, key, value) =>
  html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${escapeHtml(value)}$2`);

export function renderPage(template, p) {
  const url = `${SITE_ORIGIN}${p.path}`;
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(p.title)}</title>`);
  html = setMeta(html, 'name', 'description', p.description);
  html = setMeta(html, 'property', 'og:title', p.title);
  html = setMeta(html, 'property', 'og:description', p.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', p.image);
  if (p.image !== DEFAULT_IMAGE) html = html.replace(/\s*<meta property="og:image:(width|height)" content="\d+" \/>/g, '');
  html = html.replace('</head>', `<link rel="canonical" href="${escapeHtml(url)}" />\n</head>`);
  const body = `<h1>${escapeHtml(p.heading)}</h1>${p.text.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}`;
  return html.replace(/(<div id="prerender"[^>]*>)(<\/div>)/, `$1${body}$2`);
}

export const sitemap = (pages) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${escapeHtml(`${SITE_ORIGIN}${p.path}`)}</loc></url>`).join('\n')}
</urlset>
`;

export const robots = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
```
- [ ] **Step 4:** `node --test tools/prerender-lib.test.mjs` → PASS; add `\"tools/*.test.mjs\"` to `package.json` `test`; `npm test` → PASS.
- [ ] **Step 5: Commit** (owner yes) — `prerender: pure page builder + sitemap`.

---

### Task 6: Prerender script, build hook, prerender slot

**Files:**
- Create: `tools/prerender.mjs`
- Modify: `package.json` (`build`), `index.html` (slot + `.prerender` style in `<head>`), `src/app/bootstrap/boot.js` (remove slot), `tools/prerender-lib.mjs` + test (add `loadTierLists`)
- Delete: `public/robots.txt`

**Interfaces:**
- Consumes: Task 5 exports.
- Produces: `loadTierLists(pointerUrl: string | undefined, fetchImpl = fetch): Promise<PublishedList[]>` in `prerender-lib.mjs` — `[]` (with `console.warn`) on missing URL, non-OK response, bad JSON or timeout.

- [ ] **Step 1: Failing test** (append to `tools/prerender-lib.test.mjs`). Reuses the site's own loader `loadGameDocument` (`src/features/profile/api/loreOverlay.mts` L41: pointer `{ file: 'game.<12 hex>.json' }`, validates `version/refs/texts/builds`, returns `null` on any failure).

```js
import { loadTierLists } from './prerender-lib.mjs';

test('loadTierLists: follows the game pointer; any failure → []', async () => {
  const doc = { version: 1, refs: {}, texts: {}, builds: {}, tierLists: [{ slug: 'a', status: 'published', doc: {} }] };
  const files = { 'https://r2/lore/production/game.pointer.json': { file: 'game.0123456789ab.json' },
                  'https://r2/lore/production/game.0123456789ab.json': doc };
  const ok = async (url) => (files[url] ? { ok: true, json: async () => files[url] } : { ok: false, status: 404 });
  assert.deepEqual((await loadTierLists('https://r2/lore/production/lore.pointer.json', ok)).map((l) => l.slug), ['a']);
  assert.deepEqual(await loadTierLists(undefined, ok), []);
  assert.deepEqual(await loadTierLists('https://r2/x/lore.pointer.json', ok), []); // 404
  assert.deepEqual(await loadTierLists('https://r2/lore/production/lore.pointer.json', async () => { throw new Error('offline'); }), []);
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** in `prerender-lib.mjs`:

```js
import { loadGameDocument } from '../src/features/profile/api/loreOverlay.mts'; // the site's own loader (Node strips the types)

// Node's fetch may reject the browser-only `cache` option the site passes; drop it.
const nodeFetch = (url, opts = {}) => fetch(url, { ...opts, cache: undefined });

export async function loadTierLists(lorePointerUrl, fetchImpl = nodeFetch) {
  const doc = await loadGameDocument(lorePointerUrl, fetchImpl, 15000);
  if (!doc) console.warn('prerender: game document unavailable, tier list pages skipped');
  return doc?.tierLists ?? [];
}
```
  → PASS. If importing `loreOverlay.mts` drags in a browser-only module, copy nothing: instead export `loadPointed`'s caller from a tiny pure module and note it here.
- [ ] **Step 4: `tools/prerender.mjs`**

```js
// After `vite build`: one index.html per public page + sitemap.xml + robots.txt in dist/ (spec 2026-11-09 §4).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadEnv } from 'vite';
import { buildPages, loadTierLists, renderPage, robots, sitemap } from './prerender-lib.mjs';

const env = { ...loadEnv(process.env.MODE || 'production', process.cwd(), 'VITE_'), ...process.env };
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const template = readFileSync('dist/index.html', 'utf8');
const pages = buildPages({
  data: read('public/data.json'),
  music: read('public/music.json'),
  tierLists: await loadTierLists(env.VITE_LORE_POINTER_URL),
});
for (const p of pages) {
  if (p.path === '/') continue; // dist/index.html itself gets the home meta below
  const file = join('dist', decodeURIComponent(p.path), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(template, p));
}
writeFileSync('dist/index.html', renderPage(template, pages.find((p) => p.path === '/')));
writeFileSync('dist/sitemap.xml', sitemap(pages));
writeFileSync('dist/robots.txt', robots());
console.log(`prerender: ${pages.length} pages`);
```
  Note: `dist/index.html` is the SPA fallback for every unfiltered path too, so its text block says the site description — fine for the calculator.
- [ ] **Step 5:** `package.json`: `"build": "vite build && node tools/prerender.mjs"`. Delete `public/robots.txt` (Vite copies `public/` into `dist/`, the script overwrites it anyway; deleting removes the wrong `whmxcalc` host from the repo).
- [ ] **Step 6: `index.html` slot** — inside `<div id="app" class="app-layout">`, first child:

```html
<!-- Prerendered page text (tools/prerender.mjs) for search engines and no-JS readers; boot.js removes it -->
<div id="prerender" class="prerender"></div>
```
  and in `src/styles/global.css` (bottom): `.prerender { max-width: 720px; padding: 24px 16px; color: var(--text-muted); } .prerender h1 { font-family: var(--font-serif); color: var(--text); }`.
  `boot.js` `boot()`, first line: `document.getElementById('prerender')?.remove();`
- [ ] **Step 7:** `npm run build` → log `prerender: ~7xx pages`; `ls dist/characters/sach-kells` has `index.html`, `build/`, `lore/`; `head -c 600 dist/sitemap.xml`; `grep -o '<title>[^<]*' dist/characters/sach-kells/build/index.html` → `Build Sách Kells — …`.
- [ ] **Step 8: Commit** (owner yes) — `prerender: page files, sitemap, robots on build`.

---

### Task 7: Runtime title + calculator noindex

**Files:**
- Create: `src/app/router/pageMeta.mts`, `src/app/router/pageMeta.test.mts`
- Modify: `src/app/router/router.js` (`handleRoute`, after the admin early return)

**Interfaces:**
- Produces: `pageTitle(route: { view: string; slug?: string; subtab?: string; skinId?: string }, data: { characters: Record<string, any> }): string`; `setPageMeta(route, data): void` (sets `document.title`, adds/removes `<meta name="robots" content="noindex">` for `view === 'calculator'`).

- [ ] **Step 1: Failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageTitle } from './pageMeta.mts';

const data = { characters: { W0097: { id: 'W0097', slug: 'sach-kells', name_vi: 'Sách Kells', name_cn: '凯尔特之书', skins: [{ skinID: 'W0097002', name_vi: '', name_cn: '写照' }] } } };

test('pageTitle matches the prerendered titles', () => {
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'overview' }, data), 'Sách Kells (凯尔特之书) — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'build' }, data), 'Build Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'sach-kells', subtab: 'lore' }, data), 'Hồ sơ Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'skin-detail', skinId: 'W0097002' }, data), '写照 — Sách Kells — Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'home' }, data), 'Vật Hoa Di Tân Wiki');
  assert.equal(pageTitle({ view: 'character', slug: 'missing' }, data), 'Vật Hoa Di Tân Wiki');
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `pageMeta.mts`

```ts
// Tab title after in-app navigation; same wording as tools/prerender-lib.mjs (crawlers read that file, not this).
const SITE = 'Vật Hoa Di Tân Wiki';
const nm = (o: any) => (o?.name_vi || o?.name_cn || '').trim();
const VIEW: Record<string, string> = { catalog: 'Danh sách Khí Giả', gallery: 'Trang phục', 'tier-list': 'Tier list', music: 'Nhạc', banners: 'Banner', info: 'Thông tin', weapons: 'Vũ khí', calculator: 'Máy tính' };

export function pageTitle(route: { view: string; slug?: string; subtab?: string; skinId?: string }, data: { characters: Record<string, any> }): string {
  const chars = Object.values(data.characters);
  if (route.view === 'character') {
    const c = chars.find((x) => x.slug === route.slug);
    if (!c) return SITE;
    const h = route.subtab === 'build' ? `Build ${nm(c)}` : route.subtab === 'lore' ? `Hồ sơ ${nm(c)}` : `${nm(c)} (${c.name_cn})`;
    return `${h} — ${SITE}`;
  }
  if (route.view === 'skin-detail') {
    for (const c of chars) {
      const s = c.skins?.find((x: any) => x.skinID === route.skinId);
      if (s) return `${nm(s)} — ${nm(c)} — ${SITE}`;
    }
    return SITE;
  }
  return VIEW[route.view] ? `${VIEW[route.view]} — ${SITE}` : SITE;
}

export function setPageMeta(route: Parameters<typeof pageTitle>[0], data: Parameters<typeof pageTitle>[1]) {
  document.title = pageTitle(route, data);
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (route.view === 'calculator') {
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
    robots.content = 'noindex';
  } else robots?.remove();
}
```
  `router.js` `handleRoute`, after `if (route.view === 'admin') return;`: `setPageMeta(route, gameData);`
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** (owner yes) — `router: page title per route, calculator noindex`.

---

### Task 8: Verify end to end, update docs

**Files:** Modify `docs/WHMX_CURRENT_STATE_FINAL_2026-10-04.md` (§2 new row, §8 SEO row → done, §11 item 5), `docs/WHMX_COMMANDS.md` (build now prerenders).

- [ ] **Step 1:** `npm test`, `npm run test:tools`, `npx tsc --noEmit` → PASS (the 2 known stale Python failures excepted).
- [ ] **Step 2: Dev server** (`preview_start` with the project launch config) at 1440 and 390 px:
  - `/` → nav to Khí Giả → a character → tabs Tổng quan / Thông tin / Thiên phú / Build / Hồ sơ / Phòng trà / Thư viện: URL is a path, no reload, Back/Forward restores tab and scroll.
  - Deep link reload on `/characters/<slug>/tea`: tea icons (`assets/tea/…`) and item icons load (Review Focus 1); Network tab: no 404.
  - `/calculator?char=W0182`: calculator renders, picker changes the URL, item icons load; `<meta name="robots" content="noindex">` present.
  - Old links: open `/#/characters/<slug>/lore`, `/#calc?char=W0182`, `/#W0182`, `/#/tier-list` → each lands on the path page, one history entry.
  - `/#/admin` (signed out → `#/login`) still works; nav "Đăng nhập" works; from admin, the site brand link returns to `/`.
  - Music: open a track, filter, Back. Banners: set a filter, open a character, Back keeps the filter.
  - Ctrl+click a character card opens a new tab.
  - No horizontal scroll at 390 px; console has no errors.
- [ ] **Step 3: Built site** — `npm run build && npx vite preview --port 4173`; `curl -s localhost:4173/characters/<slug>/build/ | grep -E "<title>|og:image|canonical"`; open `/characters/<slug>/build` in the browser: prerender text flashes at most once, then the app; `/sitemap.xml`, `/robots.txt` served.
- [ ] **Step 4:** Update the docs listed above (state row: what shipped, origin constant, Search Console = owner, webp OG risk).
- [ ] **Step 5: Ask the owner** to commit and push to Preview first (`git push origin HEAD`): on the Preview URL check `/api/…` still answers (rewrite order), `curl` 3 pages, paste a character link into Discord. Then Production on the owner's yes; owner adds the site in Google Search Console and submits `/sitemap.xml`.
