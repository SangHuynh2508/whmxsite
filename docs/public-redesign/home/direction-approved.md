# Home + Banner — approved direction (2026-09-30)

Spec: `docs/superpowers/specs/2026-09-30-home-banners-design.md`. Plan: `docs/superpowers/plans/2026-09-30-home-banners.md`
(Tasks 7–9 take their markup and CSS from this file, not from the plan's first draft of `BannerCard`).

## What was shown (huashu gate, built serially — no subagents; real r3071 data)

Demos in `design-demos/` (data: `home-data.js` from `public/banners.json` + `public/data.json`; `home-titles.js` =
PoolIcon logos + colours; art in `assets/`). Screenshots in `_claude_scratch/home/` (not committed).

1. `direction-a-bulletin.html` — A · Bảng tin (catalogue grid, KV plate with caption under it, 16:9 cards).
2. `direction-b-stage.html` — B · Sân khấu (one banner on a stage with tabs, big serial countdown, event side column).
3. `direction-c-calendar.html` — C · Lịch phiên bản (version ruler with bars + "Hôm nay" line, banners as lore tickets).

Owner: "cả 3 hướng đều có cái đẹp" and asked for s1n-style wide banners with the name on the image. Follow-ups:

4. `strip-test.html` — wide strips: (1) art + title logo, (2) + colour panel, (3a) whole art + logo + white text,
   (3b) text in the drawing's hue. Owner: "giữ logo tên trên ảnh xong thêm chữ thẳng lên ảnh … giữ nguyên nền" → **3a**
   ("t thấy 3A oke hơn"), "bỏ cái hộp xám bao banner", "đỡ tốn diện tích như s1n".
5. `strip-compact.html` — thin 104 px slices. Owner: too empty on PC with layered art (character one side, text the
   other); CG would suit better. Checked: story CGs exist for 17/136 characters and are tied by story, not by
   character (A0144 and A0184 both get `cg_boshanlu`); version KVs are per half-version and only KV3401 is cached.
   Owner: "sự kiện chủ đề của mùa thì làm như ban đầu, để 1 ảnh hero lớn che cả phần trên trang và fade dần xuống dưới,
   đặt chữ không nền lên đó".
6. **`home-v2.html` — picked.** Owner, verbatim: "chốt v2, chọn (a), upload R2 luôn" — (a) = layered art (PoolBg + UP
   skin drawing) for every banner, no hand-picked CGs for now.

## The direction

### Hero (season theme)
- `home-hero`: the version KV (`hero.art`, today `kv/KV3401.webp`) full-bleed over the top of the page, height
  `min(62vh, 560px)` (phones 440 px), `object-fit: cover; object-position: 50% 28%`, fading into the page with
  `mask-image: linear-gradient(180deg, #000 55%, transparent 100%)`. It sits under the page padding (negative margin
  equal to the main padding) so the fade meets the page background.
- `home-hero-text` on the art, **no plate**: left 48 px / bottom 56 px (phones 16 px / 40 px);
  `text-shadow: 0 2px 8px rgb(0 0 0/.85), 0 0 2px rgb(0 0 0/.6)`.
  - line 1: "Phiên bản {label} · {dd/mm/yyyy} – {dd/mm/yyyy}" — 600 15 px sans, `--text-main`;
  - `h1`: `hero.name_cn` (Chinese + ash dot) — 700 48/1.1 serif (34 px on phones);
  - line 3 (only when a 主题活动 event is active): "Sự kiện chủ đề {name_cn} · còn {remaining}" — 500 15 px, the time in 600.
- No KV → no image; the text block stands on the page background.

### Banner slice (shared by Home and the Banner page) — `bn-slice`
An `<a>` (to the first UP character `#/characters/<slug>`; no UP → `#/banners`), 6 px corners, no border, no surface
colour (sits on the page), `overflow: hidden; isolation: isolate`. Layers, bottom to top:
1. `bn-slice-bg` — `artUrl(banner.art)` (PoolBg), `object-fit: cover; object-position: 50% 45%; transform: scale(1.12)`
   (hides the PoolBg's tilted frame edge). Missing/404 → no image; the slice falls back to `--bg-elevated`.
2. `bn-slice-fig` — the UP skin drawing: `data.json` `characters[up[0]].skins[skinID === up_skin].image`; absolute,
   `right: 2%; top: -8%; height: 250%; width: auto`. No `up_skin` or not in data.json → no figure.
3. `::before` scrim — `linear-gradient(90deg, rgb(0 0 0/.84) 0%, rgb(0 0 0/.74) 46%, rgb(0 0 0/.2) 70%, transparent 84%)`;
   narrow slices (3-up, phones) extend the .74 stop to 62% (impeccable `detect` found 2.2–2.6:1 on bright art before).
4. `bn-slice-txt` — left 20 px (phones 14 px), vertically centred, max-width 62%, gap 4 px, same text-shadow as the hero:
   - `bn-slice-logo` — `artUrl(banner.title)` (PoolIcon), `max-height: 40%; max-width: 60%; object-fit: contain`,
     left-aligned; missing → omitted (the name carries it);
   - `bn-slice-name` — UP characters' VI names joined by " · " (none → `name_cn` in Chinese + ash dot), 700 22/1.25
     serif (19 px in 3-up slices, 18 px on phones), one line, ellipsis;
   - `bn-slice-meta` — 500 13 px sans (12 px phones), one "·" max:
     - active: "{TYPE_VI} · còn **{remaining}**" (TYPE_VI: limited "Giới hạn", time "Có thời hạn", season "Theo mùa");
     - choice banner (`choice` set, cardPools kind `choiceness`): "Tự chọn trong {choice} Khí Giả · còn **{remaining}**";
     - ended but still the current batch: "Đã kết thúc · chờ bản cập nhật" and `filter: grayscale(.7)` on the slice;
     - archive (Banner page): "{TYPE_VI} · {dd/mm/yyyy} – {dd/mm/yyyy}", no grayscale.
- Hover/focus: the name underlines (1 px, offset 4 px); focus ring = the site's 2 px gold outline.
- Aspect ratio: 4 / 1.1 (2-up), 3 / 1.1 (3-up), 3 / 1.15 on phones.

### Banner grid — `bn-grid`
`display: grid; gap: 12px; grid-template-columns: repeat(6, minmax(0, 1fr))`; each slice spans 3 (2 per row). **Odd
count** (`bn-grid--odd`): the last three span 2 (3 per row) — never an empty cell (5 current banners = 2 + 3).
≤ 640 px: one column. Order = `currentBanners` featured then compact.

### Below the banners (Home)
`home-row`: two columns (1 fr / 1 fr, gap 32 px; one column ≤ 980 px).
- `home-events` "Sự kiện đang diễn ra": rows with a 1 px `--border-color` rule; kind (Chinese, 12 px ash), name
  (Chinese 16 px), right "Còn **{remaining}**" 14 px ash with the time in 600 `--text-main`.
- `home-releases` "Mới ra mắt": 4 columns of square images (6 px, `object-position: 50% 12%`, `--bg-elevated` behind),
  name 13 px, "Trang phục"/"Khí Giả" 12 px ash; "Mới" only when `isNew` (gold fill, night-ink text, 11 px — small label).
- Section headings: 600 16 px sans; "Tất cả banner ›" 14 px ash at the right of "Banner đang mở".
- Shortcuts block: dropped — the rail / phone menu already has every page (spec Q2 listed it; owner picked v2 without it).

### Banner page (`#/banners`)
Serif 26 px "Banner" title; the current batch as a `bn-grid`; then the archive: filters (Khí Giả / Loại / Năm, the
site's 36 px selects in a wrapping row), year headings 700 17 px serif over a 1 px rule, each year a `bn-grid` of
archive slices (newest first). "Chưa tải được dữ liệu banner" when `banners.json` fails (both pages).

### Motion (GSAP via `src/features/characters/motion.ts`)
- Page load: hero text, then each block arrives in reading order with `useReveal` (6 px rise, blur 2 → 0, 0.6 s expo-out,
  stagger ≤ 0.3 s); slices stagger inside a grid.
- Banner-page filter change: the year groups re-arrive (`useReveal` keyed by the filters).
- Countdown text changes without animation. Reduced motion: 0.15 s fade only.

### Exceptions to DESIGN.md (owner-approved 2026-09-30)
- **Gradients:** the hero's fade mask and the slice scrim are gradients — they exist only to put text on game art,
  which the owner chose over plates ("chữ không nền", "giữ nguyên nền"). Nowhere else.
- **Text shadow** on text over art (same reason). No box shadows.

### Checks done on the demo
- impeccable `detect` on `home-v2.html` at 1440×900 and 390×844: clean after widening the scrim (was 1 `low-contrast`).
- `scrollWidth === clientWidth` at 1440 and 390.
- Taste pass (`.claude/skills/design-taste-frontend`): no empty grid cell (2 + 3 rule), one "·" per meta line, hero
  stack = 3 text lines, version line moved off gold for legibility on bright KV areas.
- `/impeccable critique`: not run — the state doc (§6) runs critique only when the owner asks.

## Changes after `/impeccable critique` (2026-09-30, 24/40; snapshot `.impeccable/critique/2026-09-30T10-11-27Z__src-features-home-homepage-tsx.md`)

Owner: "sửa hết 5 phần", hero "Tiếng Việt lên đầu".
- Hero: dates line (`formatRange`), `h1` = `versionTitle(label)` ("Phiên bản 3.4 · Thượng"; 上/下 = Thượng/Hạ), the KV
  name 经以山海 as a 20 px Chinese line with the ash dot, then "Sự kiện chủ đề {name} · còn {time}" (subject first,
  the time set apart by a 12 px gap instead of a "·" after the dot).
- Slices: the name wraps to two lines (no ellipsis); on phones the text zone is 80% wide with a longer fade; a banner
  without an UP character is a `<div>`, not a link; linked slices show "Xem Khí Giả ›" on hover/focus; the logo has
  `alt=""` (the name is the accessible text).
- Banner page: headings "Đang mở" and "Tất cả banner · N banner"; filters live in the hash
  (`#/banners?char=&type=&year=`, `readFilters`/`filtersHash`, updated with `replaceState`); "Xoá bộ lọc"; a filtered
  archive searches every banner including the current batch; a legend with the game's channel names; years are
  `<details>` (newest open, others folded, unfolded years remembered for Back); archive slices are compact (3 per
  row, 3 / .9, no logo, 17 px name) with short same-year ranges ("20/08 – 10/09/2026").
- `banners.json` is kept after the first load (`loadBannersCached`) so Back re-renders at once and the router's
  scroll restore lands on real content (checked: 1200 px restored with year=2025).
- Home releases: 3 columns on phones.

## Slice fade, owner revision (2026-09-30)

Owner: "vùng tối hơi rõ quá, nên cho ít tối lại và làm nó fade nhiều hơn … vừa tối rõ và vừa phân chia rõ ranh giới sáng
tối". Slices (Home + Banner page) now use `--art-slice-fade` / `--art-slice-fade-wide` (tokens.css): max .64 instead of
.84, eased over nine stops to transparent, no visible edge; the text carries `--art-slice-text-shadow` (tight + 12 px +
28 px halo). Trade-off accepted by the owner's request: impeccable detect reports the meta line at median 1.9–3.2:1 on the
brightest art (刻名存念, 结伴同游); it does not model the halo. Hero and Info panels keep their own fades.
