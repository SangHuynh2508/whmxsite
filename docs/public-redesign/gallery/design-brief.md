# Thư viện ảnh (`/gallery`) — design brief (huashu Phase 3, shared input of the three directions)

Spec: [`../../superpowers/specs/2026-11-17-gallery-page-design.md`](../../superpowers/specs/2026-11-17-gallery-page-design.md).
Design system: `DESIGN.md` ("The Night Archive") + `PRODUCT.md`. Demos: `design-demos/` — serve `D:\BaiTapCode\WHMX`
(e.g. `python -m http.server 8768 --bind 127.0.0.1`, launch config `music-demos`), open `/WhmxCalc/docs/public-redesign/gallery/design-demos/<file>.html`.
Images come from the WHMX_Tool export next to the repo (`WHMX_Tool/Xuat/Gallery_r3173`, demo web sizes in `_web/`).

**Restatement (Phase 2).** Players keep asking for the game's wallpapers, and today the only way is to dig through
files named at random, filter by size and hope. The page gives them the game's own art sorted by **where the game
uses it** — loading screens, home backgrounds, travel postcards, version key visuals and story CGs — so "I want a
wallpaper" becomes one tab, and "the CG from that 3.4 event" becomes two clicks (series, then version). The art is the
content; the page is a quiet frame around it: the Night Archive's charcoal and one gold lamp, never competing with
images that already carry all the colour. What the owner did not say but expects: it must feel like WHMX (same rail,
type, tabs, ink), it must work one-handed on a phone next to the game (390 px, swipe between images), downloads must be
the real PNG, and a link to one image must open that image. Untranslated names stay Chinese with the ash dot.

**What it is.** A public page `/gallery` (card in the Thông tin page next to Âm nhạc) showing 816 images from
`public/gallery.json` (r3173): story CGs 600, loading screens 139, home backgrounds 16, KVs 28, postcards 33.
Story CGs split by **series row** (Bản 3.x / Bản 2.x / Trước 2.5 / Chính tuyến / Khác) and a **version row** under it
(3.5 Thượng … 2.5; or chapter / event / story names). The other kinds are one grid each (the game gives them no version).

**Who and where.** Vietnamese players of 物华弥新 who cannot read Chinese. Two distances: phone at 10 cm (390 px, binding,
no horizontal page scroll) and laptop at 1 m (1440 px). Jobs: find a wallpaper, find "that CG", look at it big, save the
original. Some come from a shared link to one image.

**Content (all real).** Every image, size, name, note and translation is the real data. Texts are short: loading names
(≤ 6 字) + how to get them, home background names, postcard place + a two-line poem (the poem is the one longer text),
story CGs have no own name — their label is the story/event/chapter they open in. KVs have only a code (`3401`,
`18.2`), no name; show the code, never guess a version from it. Almost all art is 1680 × 720 (21 : 9); postcards are
400 × 400.

**Must have (spec).** Title + one-line lede; kind tabs; search by name (VI + CN, accent-insensitive); story: series
row + version row; state in the query (`?kind=story&g=v3&v=3.4上&q=…&id=…`, unknown values fall back); grid of `t.webp`
with `loading="lazy"` keeping the real ratio (no layout jump); viewer with `v.webp`, prev / next (buttons, ←/→, swipe),
Esc closes, **Tải PNG gốc** (`o.png`, `download`), name + kind + note / place + poem; opening an image writes `id` to the
URL. Empty search → message + "Xóa tìm kiếm". Broken thumb → placeholder cell, grid intact. Links to Trang phục and
Banner at the foot. GSAP-level motion, tasteful (tab change, viewer open / close), with a reduced-motion path.

**Tone.** The Night Archive: charcoal steps, hairlines, antique gold only for state (selected tab ink, focus, primary
download button). Literata speaks for the archive (titles, names, poems), IBM Plex Sans for the tool (tabs, counts,
captions). Quiet; the images are loud enough.

**Constraints.** Dark only; colours only from `src/styles/tokens.css` (demos use `../../home/design-demos/common.css`);
6 px corners; spacing 4·8·12·16·24; no shadows, no glow; gradients only as the dark fade under text on art (owner's
accepted exception, banners); UI text ≥ 12 px, body ≥ 14 px; focus ring 2 px gold; 390 px no horizontal scroll (inner
scrolling strips are allowed); reduced motion respected.

**Images.** Content-critical and on hand (the export); no stock, no drawing. Three directions share the same images
and the same data (`gallery-data.js`, `gallery-common.js`).

**Visual motif (from the content).** The game frames these pictures as *collected memories*: the loading CGs are
literally a collection (`collectCGs`, "留影"), postcards are travel souvenirs with a poem, story CGs are stills of a
chapter. 21 : 9 is the frame of a film still. So the motif is the **still and its caption** — a wide frame with a small,
exact label (where it comes from, how to get it), like a film archive's contact sheet or a museum's object label.

**The three directions (serial, no subagents — owner rule, as for Tier list and Âm nhạc).**
- **A · Phòng chiếu** — roulette (`date +%S` = 56 → 56 % 20 + 1 = 17 → web style *Gallery Dark*: dark negative space,
  one big image per row, EXIF-style small captions; read inside the Night Archive, not pure black): a single column of
  large stills with exact small captions; a slim contact-sheet strip for jumping.
- **B · Kho sưu tập** — real reference *Rijksmuseum Collection Online* (Fabrique × Q42; European Design Award gold 2025,
  "image first", verified 2026-11-17): facet bar + justified image grid at true ratios; an object view where the image
  takes the screen and the facts sit beside it, download first.
- **C · Sách ảnh** — best designer *Irma Boom* (book maker, Rijksmuseum's own catalogues): the gallery as an art book —
  a table of contents (series → versions) and chapters laid out as spreads, one large plate and smaller plates per
  spread, the caption set like a book's plate list.
