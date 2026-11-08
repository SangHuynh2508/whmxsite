# SEO: path URLs + prerendered pages + sitemap — design

Date: 2026-11-09. Owner approved the direction in chat (approach A, all recommendations, keep `whmxsite.vercel.app`).

## 1. Goal

- A Vietnamese player who searches Google for a character ("build Kells vật hoa di tân") lands on that character's page.
- A link pasted into Discord / Facebook / Zalo shows **that** page's title, description and image, not the site default.

Today every public URL is `#/…`: to search engines and link previews the whole site is one page, and its content
only exists after JS renders `data.json` (17 MB). Facebook/Zalo/Discord run no JS.

Success criteria:
1. `curl https://whmxsite.vercel.app/characters/<slug>` (no JS) returns HTML with the character's own `<title>`,
   `description`, `canonical`, `og:*` and a readable text block.
2. `/sitemap.xml` lists every prerendered page; `robots.txt` points to it on the right domain.
3. Every old `#/…` link still opens the same page.
4. The app behaves as today after JS loads (no visual change, no extra lag).

## 2. Decisions (owner, 2026-11-09)

| Question | Decision |
|---|---|
| Approach | **A**: path URLs + static HTML generated at build time (no server, no new Vercel function) |
| Pages prerendered | Home, Khí Giả catalog, each character × Tổng quan / Build / Hồ Sơ Lưu Trữ, non-base skins, tier list (index + each list), music (index + each track), banners |
| Content in the HTML | Meta **plus** a short visible text block (see §5) |
| Old `#/…` links | Rewritten client-side to the path (`history.replaceState`) |
| Admin | Stays on `#/admin`, `#/login` — untouched, `noindex` |
| Calculator | Path URL, not prerendered, `noindex` |
| OG image | Existing character card art (R2 `cards/<skin>.webp`); site default `og-image.jpg` elsewhere |
| Domain | Keep `https://whmxsite.vercel.app`; one constant `SITE_ORIGIN` so a later domain is one edit |
| Search Console | Owner signs in and submits the sitemap; not automated |

## 3. URLs

Path = today's hash without `#`: `/`, `/characters`, `/characters/<slug>[/<tab>]`, `/skins/<id>`, `/gallery`,
`/weapons`, `/tier-list[/<slug>[/<tab>]]`, `/music[/<track>]`, `/banners`, `/info`, `/calculator?…`.

- **Router** (`src/app/router/router.js`, `staticRoutes.mts`, `characterHash.mts`, `tier-list/tierRoute.mts`): parse
  `location.pathname + location.search` instead of `location.hash`; listen to `popstate` instead of `hashchange`.
  The parse functions keep their string input, so their tests change only in the prefix.
- **Navigation**: one helper `navigate(path, {replace})` (pushState/replaceState + route). A delegated click handler on
  `document` turns same-origin `<a href="/…">` clicks into `navigate` (skips modifier keys, `target`, `#/admin`).
- **Links**: every public `href="#/…"` (66 occurrences outside `src/admin`, incl. `tierListHref`, sidebar, search)
  becomes `/…`. A test greps `src/` (non-admin) for `"#/` to keep it that way.
- **Legacy hash**: on boot, if `location.hash` starts with `#/` and is not admin/login, `replaceState` to the path
  (also the bare `#W0182` form → `/characters/<slug>`). Admin keeps the hash router it has.
- **Relative assets**: game data and several views use relative paths (`assets/items/…`, `assets/tea/…`), which break
  on `/characters/x/build`. `index.html` gets `<base href="/">` (the site has no SVG `url(#…)` references, the usual
  casualty of a base element).
- **Vercel** (`vercel.json`): a `rewrites` fallback `/(.*)` → `/index.html` placed **after** the API rewrites;
  Vercel serves a real file (prerendered `index.html`, assets, `data.json`) before applying rewrites.

## 4. Prerender script

`tools/prerender.mjs` (Node, no new dependency), run by `"build": "vite build && node tools/prerender.mjs"`.

Inputs: `dist/index.html` (template, keeps Vite's hashed asset tags), `public/data.json`, `public/music.json`,
`public/banners.json`, and the published game document for tier lists (`game.pointer.json` → `game.<hash>.json` on
R2, fetched over HTTPS; if the fetch fails the tier list pages fall back to the index meta and the build continues
with a warning — a network hiccup must not break deploys).

For each page it writes `dist/<path>/index.html` = template with:
- `<title>`, `meta description`, `link rel=canonical`, `og:title/description/url/image`, `twitter:*` replaced;
- `<meta name="robots" content="noindex">` where §2 says so (calculator has no file; its index route gets it at runtime);
- the text block (§5) inside the main content container, marked `data-prerender` so the app clears it on mount.

All strings are HTML-escaped (names come from game data). Pure function `renderPage(template, page)` is separate from
file I/O so it is unit-tested.

Also writes `dist/sitemap.xml` (every prerendered path, absolute URLs, no `lastmod` — we have no honest per-page date)
and `dist/robots.txt` (replaces `public/robots.txt`, which today points to the wrong host `whmxcalc.vercel.app`).

Expected output: ~750 files of 12–20 KB in `dist/` only (git-ignored); built by Vercel on deploy.

## 5. Page meta and text

| Page | Title | Description / text block |
|---|---|---|
| Character Tổng quan | `<Tên VI> (<tên CN>) — Vật Hoa Di Tân Wiki` | rarity, class, tags, skill names (VI, else CN) |
| Character Build | `Build <Tên VI> — …` | "Vũ khí, dòng thuộc tính, thâm tạo, chuỗi kỹ năng và đội hình gợi ý cho <Tên>" (build summary from the game document: later, if wanted) |
| Character Hồ Sơ | `Hồ sơ <Tên VI> — …` | first ~200 chars of the profile intro (VI, else CN) |
| Skin | `<Tên skin> — <Tên nhân vật> — …` | obtain text |
| Tier list / music / banners / home / catalog | page name | one fixed sentence; track/list name where it exists |

Untranslated names show the Chinese original (PRODUCT principle 1). OG image: character → first card webp; skin → its
card; others → `og-image.jpg`. Risk: some apps (Zalo) may not show webp previews; if so, add a jpg variant later.

## 6. Runtime title

A small `setPageMeta({title})` called by the router after each route sets `document.title` (and canonical), so the
tab title is right after in-app navigation. Not trying to fix OG at runtime — crawlers read only the static file.

## 7. Out of scope

Custom domain; structured data (JSON-LD); per-language pages; prerendering lore/build full text from R2/DB; the
admin; Search Console automation; changing any page's look.

## 8. Testing

- Unit (node:test): path parsing (existing router tests moved from hash to path), legacy hash → path mapping,
  `renderPage` escaping + meta, sitemap contents, no `"#/` link left in public `src/`.
- Build: `npm run build`, count files, spot-check 3 pages and `sitemap.xml`.
- Browser (dev + `vite preview`): deep link `/characters/<slug>/build` loads, back/forward, old `#/characters/…`
  rewrites, admin `#/admin` still works, no horizontal scroll change.
- After deploy (owner yes to push): `curl` 3 production URLs; paste a character link into Discord.

## 9. Risks

- **Missed `#/` link** → a click reloads the page via the hash path; the legacy rewrite still lands it correctly.
- **Vercel rewrite order** wrong → API calls get `index.html`; test `/api/…` after deploy on Preview first.
- **Scroll restore** (`routeScrollCache`) keyed on routes is unchanged; verify back/forward keeps position.
- Prerendered text flashes before the app mounts → the block sits where the page renders and is replaced in place.
