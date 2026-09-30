# Home page + Banner page (current banners with countdown, banner archive) — design

> Date: 2026-09-30. Status: **implemented 2026-09-30** (plan `docs/superpowers/plans/2026-09-30-home-banners.md`); visual direction: `docs/public-redesign/home/direction-approved.md` (home-v2: season hero fading into the page, banner slices with the game's title logo). Not pushed yet.
> Not committed (owner: "chưa commit"). References studied: s1n.gg (Home + `/banners`), gll-fun.com (`/limbus/en/`).
> Visual direction: not chosen yet — huashu 3 directions, then taste skills + impeccable (§7).

## 1. Goal

The site has no home page: `#/` redirects to `#/characters`. Give it one that answers "what is in the game right now"
— the banners that are open with a live countdown, the events running, what was just released — and give banners their
own page with the full history since 2024-05. Success: `#/` shows the current banners (r3057: 万嶂烟峦 · A0184,
四海无争 · A0144, 刻名存念 · A0170, 孤岛螺旋 · W0097 …) counting down to their real end time; `#/banners` lists all 94
timed banners newest first with filters; both work at 1440 px and 390 px (no horizontal scroll); nothing needs a server
running — the data is static and refreshed on release day.

## 2. Owner decisions (2026-09-30)

| # | Question | Decision |
|---|---|---|
| Q1 | Scope / order | One spec, two phases: (1) banner data + Banner page, (2) Home reusing the banner card |
| Q2 | Home blocks | Hero (current KV + version), current banners + countdown, current events + countdown, new releases, shortcuts. **Not now:** birthdays (no birth-date data), site updates/guides (none yet), notices/donations |
| Q3 | "Current" banner | Banners with an UP character or skin get a full card; season banners and banners without UP go in one compact row |
| Q4 | Ended but the game data is not updated yet | Card says "Đã kết thúc · chờ bản cập nhật", countdown hidden; never guess the next banner |
| Q5 | Banner page content | Key art, name, type, dates, UP avatars (→ character page), UP skin (→ skin page), countdown when open; filters character / type / year. **Later:** rates, "Từng UP" on the character page |
| Q6 | Vietnamese names | CN banner/event names now + the UP characters' VI names; banner/event VI names later via Admin → Từ điển |
| Q7 | Where the data lives | A static JSON built on release day next to `data.json`; key art as WebP on R2 |
| Q8 | Design | huashu 3 directions (owner picks) **+ taste skills + impeccable** (owner addition); React + TS, GSAP, dark only; one banner card shared by Home and Banner page |
| Q9 | Navigation | Logo → Home; new rail items "Trang chủ" and "Banner"; "Khí Giả" unchanged |
| — | Upcoming banners | Not shown (owner: "ko cần decor banner kế"). s1n's upcoming list is speculation; our data has no future banners |

## 3. Data

### 3.1 Sources (MasterData, checked on `f9cb0604` / r3057)

| What | Table | Used fields |
|---|---|---|
| Banners | `cardPools` (99 rows, 94 with `startTime`; none `hidden` among timed) | `id`, `nameLanText`, `type` (`time` 77 · `limited` 14 · `oldtime` 2 · `season` 1), `kindNameLanText` (限时渠道 / 限定渠道 / 常规渠道), `startTime`, `endTime` (unix s), `characterShow` (UP character ids), `characterSkinShow` (skin suffix, e.g. `001`), `cardGroups[].isUP` |
| Current version | `ActivityVersionMap` | row with `StartTime ≤ now < EndTime` → `Version`, `NameLanText` ("3.4上版本热点活动总览" → label "3.4上") |
| Current events | `ActivityOverAllMap` | rows of that `Version`: `NameLanText`, `DescLanText` (主题活动 / 限时招集 / 试炼场), `StartTime`, `EndTime` |
| Hero art | `LoginBackgroundMap` | row active now → `KV` (e.g. `KV3401`), `NameLanText` (经以山海); texture `<KV>` in bundle `ui_<kv lowercased>` |
| Key art | bundle `images_cardpool` | `PoolBg_<poolId>` (76 of 94 timed pools), `PoolIcon_<poolId>` |
| New releases | `public/data.json` (already there) | `characters[].unlock_date`, `characters[].skins[].unlock_date` |

"Now" in §3.1 means the build time; the page re-evaluates status in the browser (§3.4).

### 3.2 `public/banners.json` (built by `tools/build_banner_data.py`)

```
{ "generated_at": <unix s>, "masterdata": "<cfc hash>", "asset_base_url": "<R2 public base>",
  "version": { "id": "2019", "label": "3.4上", "start": <s>, "end": <s> } | null,
  "hero": { "kv": "KV3401", "name_cn": "经以山海", "art": "kv/KV3401.webp", "start": <s>, "end": <s> } | null,
  "events": [ { "id": 1071, "name_cn": "榑桑遗境", "kind_cn": "主题活动", "start": <s>, "end": <s> } ],
  "banners": [ { "id": "2114", "name_cn": "万嶂烟峦", "name_vi": null, "type": "limited", "kind_cn": "限定渠道",
                 "start": <s>, "end": <s>, "up": ["A0184"], "up_skin": "A0184001" | null,
                 "art": "banners/2114.webp" | null } ] }
```

- `banners`: every `cardPools` row with a `startTime`, sorted by `start` descending. `up` = `characterShow` (in order);
  `up_skin` = `characterShow[0] + characterSkinShow` only when that skin id exists in `data.json` (else null — no
  guessing). `art` only when the extracted `PoolBg_<id>` exists.
- `events`: only the current version's rows. `hero`: only the row active at build time; null otherwise.
- `name_vi` stays null until the Từ điển domain exists (out of scope).
- Deterministic output (sorted keys, no timestamps other than `generated_at`); the release-day diff shows only real changes.
- Loaded with `fetch` by the Home and Banner pages (not merged into the 15.7 MB `data.json`); cached like other `public/` JSON.

### 3.3 Images

- A release-day tool extracts `PoolBg_<id>` from `images_cardpool` and `<KV>` from `ui_<kv>` of the current snapshot
  (NeoArtifacts decrypt + UnityPy, bundle chosen by **FileMD5**, not the first cache hit — MD5Name is stable across versions),
  converts to WebP with `tools/publish_assets.py`'s policy and uploads to R2 `banners/<poolId>.webp`, `kv/<KV>.webp`.
  `--dry-run` lists the objects; upload is an owner-approved step like `publish_assets.py`.
- A card without art shows the UP characters' avatars (`data.json` icons) on a dark panel.

### 3.4 Time (`src/features/banners/bannerTime.mts`, pure)

- `status(now, start, end)` → `'upcoming' | 'active' | 'ended'`.
- `remaining(now, end)` → text: "8 ngày 10 giờ" (≥ 1 day), "5 giờ 12 phút" (≥ 1 hour), "45 phút", "< 1 phút".
- Dates shown as `dd/mm/yyyy` in the viewer's local time (`Intl`).
- One ticking hook per page (`useNow()`), every 30 s (the text has no seconds, so a faster tick changes nothing);
  paused while the tab is hidden, refreshed when it is shown again (`visibilitychange`).
- Q4: `status === 'ended'` for a banner that is still in the "current" set (the site data is older than the game) →
  "Đã kết thúc · chờ bản cập nhật".

## 4. Routes and navigation

- `parseHash`: `''`, `'/'` → `view: 'home'`; `'/banners'` → `view: 'banners'`. The `#/` → `#/characters` rewrite in
  `handleRoute` is removed. Unknown hashes keep today's fallback (catalog).
- `VIEW_CONTAINERS` gains `home: 'home-view'`, `banners: 'banners-view'` (two `<div>`s in `index.html`, hidden like the others);
  `renderRouteView` mounts a React root in each (same pattern as `BuildTab.tsx`: `createRoot` + `flushSync`, unmount on leave).
- `AppNav.tsx`: brand link → `#/`; `PUBLIC_LINKS` gains `{ '#/', 'Trang chủ', views: ['home'] }` first and
  `{ '#/banners', 'Banner', views: ['banners'] }` after "Trang Phục"; mobile menu gets the same items.
- Analytics `pageForHash` already maps `#/` to `/`; add `/banners`.

## 5. Components (`src/features/banners/`, `src/features/home/`)

| Unit | Does | Depends on |
|---|---|---|
| `bannersData.mts` | `loadBanners()` fetch + shape check; `currentBanners(doc, now)` (active or ended-but-latest set, split into `featured` = has UP and `type !== 'season'`, `compact` = the rest, e.g. 孤岛螺旋 (season, UP W0097) and 结伴同游 (no UP)); `archive(doc, filters)` grouped by year | `bannerTime.mts` |
| `BannerCard.tsx` | One banner: art (or avatar fallback), name CN (+VI), type chip, dates, UP avatars → `#/characters/<slug>`, UP skin → `#/skins/<id>`, countdown or ended note | `data.json` characters (names, slugs, icons) |
| `BannersPage.tsx` | Current banners on top, archive by year below, filters (character search, type, year) | the two above |
| `HomePage.tsx` | Blocks of Q2 in order: Hero, Banner đang mở (`BannerCard` featured + compact row), Sự kiện đang diễn ra, Mới ra mắt, Lối tắt | `bannersData`, `data.json` |
| `newReleases.mts` | Characters and skins with `unlock_date ≤ now`, newest first, top 8; `isNew` when `unlock_date ≥ version.start` | `data.json` |
| `useNow.ts` | Shared ticking clock (§3.4) | — |

Styles: tokens from `src/styles/tokens.css` only; dark only; no bare `hidden` class; a panel hidden at a width appears
elsewhere at that width. Motion: GSAP via the `gsap-skills:*` skills, reusing `src/features/characters/motion.ts`
(`useReveal` for arriving blocks); countdown digits change without animation; reduced-motion path for everything.

## 6. Error handling

- `banners.json` missing or invalid → Home still renders hero-less shortcuts + new releases; the banner blocks show
  "Chưa tải được dữ liệu banner"; the Banner page shows the same message. No crash, no blank page.
- A banner whose `up` id is not in `data.json` (unreleased) → the avatar is skipped, the card still renders.
- Missing art → avatar fallback (§3.3). Missing hero → the hero shows the version label on a plain band.
- Clock skew is not corrected (viewer's clock); acceptable for a countdown.

## 7. Design process

1. `huashu-design`: 3 real directions for **Home** built on real r3057 data (the banner card is part of each), demos in
   `docs/public-redesign/home/design-demos/`; the owner picks (may mix).
2. Taste pass with the project taste skills (`.claude/skills/design-taste-frontend` …) on the chosen direction.
3. impeccable: `detect` at 1440 and 390 px on the demo and later on the built pages; `/impeccable critique` as a
   **self-review** (no subagents unless the owner asks), findings → owner decisions like the Build tab's C1–C4.
4. Record `docs/public-redesign/home/direction-approved.md`; the Banner page follows the same card and type scale.

## 8. Testing

- `node:test`: `bannerTime.mts` (status boundaries, text formats), `bannersData.mts` (featured/compact split, ended-but-
  current, archive grouping/filters, fallback art), `newReleases.mts` (future unlock excluded, `isNew`), router
  (`#/` → home, `#/banners`, `#/characters` unchanged), `pageForHash('/banners')`.
- Python (`npm run test:tools`): `build_banner_data.py` on a fixture (timed rows only, sort order, `up_skin` only when the
  skin exists, current version/events/hero selection, deterministic output).
- Typecheck, `npm run build`, `npm test`.
- Browser (Playwright): Home and Banner page at 1440 / 390 px, reduced motion, a banner forced to `ended`, `banners.json`
  missing; no horizontal scroll at 390 px; then production after deploy.

## 9. Release day

Add to `docs/WHMX_COMMANDS.md` (step C) and runbook N2: `python tools/build_banner_data.py`, then the banner-art tool
(`--dry-run`, then upload with owner yes). Commit `public/banners.json` with the release.

## 10. Out of scope

Upcoming/speculative banners, pull rates, "Từng UP" on the character page, banner/event VI names (Từ điển domain),
event images, birthdays, site-news block, admin editing of banners.
