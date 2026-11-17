# Thư viện ảnh (`/gallery`) — direction (huashu gate, 2026-11-17)

Spec: [`../../superpowers/specs/2026-11-17-gallery-page-design.md`](../../superpowers/specs/2026-11-17-gallery-page-design.md) ·
brief: [`design-brief.md`](design-brief.md) · demos: `design-demos/` (serve `D:\BaiTapCode\WHMX`, launch config
`music-demos`, port 8768; open `/WhmxCalc/docs/public-redesign/gallery/design-demos/<file>.html`).
Demo data: `gallery-data.js` = `public/gallery.json` (r3173, 816 images) + `story_cn/story_vi` (the story an image opens
in) from the export INDEX.json; images from `WHMX_Tool/Xuat/Gallery_r3173` (`_web/<kind>/<id>/{t,v}.webp` made for the demo).

## Shown (three directions, serial — owner rule)

| Demo | Logic | Screenshots (`design-demos/shots/`) |
|---|---|---|
| `A-phong-chieu.html` — A · Phòng chiếu | roulette `date +%S` = 56 → web style #17 *Gallery Dark* | `A-1440.jpg`, `A-1440-open.jpg`, `A-1440-postcard.jpg`, `A-390.jpg`, `A-390-open.jpg` |
| `B-kho-suu-tap.html` — B · Kho sưu tập | reference *Rijksmuseum Collection Online* (Fabrique × Q42, EDA gold 2025) | `B-1440.jpg`, `B-1440-open.jpg`, `B-1440-postcard.jpg`, `B-390.jpg`, `B-390-open.jpg` |
| `C-sach-anh.html` — C · Sách ảnh | best designer *Irma Boom* (art book: contents + chapters as spreads) | `C-1440.jpg`, `C-1440-open.jpg`, `C-1440-postcard.jpg`, `C-390.jpg`, `C-390-open.jpg` |

Impeccable critique of the three: see the owner report of 2026-11-17 (snapshot in `.impeccable/critique/`, git-ignored).

## Owner's answer to A / B / C (verbatim, 2026-11-17)

> "https://uttu.merui.net/gallery/ cả 3 phong cách thật ra t đều ko thích cho lắm, m có thể tự vào web này click thử và
> tham khảo, à mà đối với các ảnh giống nhau(khác vài chi tiết) thì họ sẽ gộp chung và chỉ khi mở 1 ảnh đại diện lên
> thì mới thấy các ảnh khác"

A, B and C are rejected. The owner named a reference, so a fourth demo follows it instead of three new directions
(huashu gate: the owner chose the reference; recorded here as the ruling).

| Demo | Logic | Screenshots |
|---|---|---|
| `D-kho-khoanh-khac.html` — D · theo UTTU | UTTU *The Captured Moment* (`/gallery/the-captured-moment/`, panel `?c=`; reference shot `shots/ref-uttu-tcm-open.jpg`) | `D-1440.jpg`, `D-1440-open.jpg`, `D-1440-postcard.jpg`, `D-390.jpg`, `D-390-open.jpg` |

What UTTU does and D copies: one framed board (kind tabs with an underline → series → versions), a dense thumb grid
with names on hover, a panel that opens under the clicked row (big image · strip of the other versions · facts +
download), the big image opens full screen; phones get a full-screen sheet. UTTU keeps the versions as `other_files`
of one entry (e.g. Tuesday: 3 files).

**Variant groups (demo data, `design-demos/gallery-variants.js`):** found by pixel similarity on the web thumbs, same
kind only — 16×16 dHash ≤ 40 bits and mean grey diff ≤ 10, or ≥ 55 % of the non-flat colour cells unchanged (cells
dark or white in both pictures ignored, else black-background CGs all match). Checked by eye on contact sheets: 102
groups, 245 images (story 98, loading 4). Not grouped: camera-pan sequences such as `cg_boshanpv_02` → `_5` (the frame
moves, so few cells match). Exact duplicates are grouped too (`CG61028` = `HD11302`, `CG61056` = `HD10501`). Becomes
real data only after the owner reviews it (`build_gallery_data.py` would carry a `variants` list).

### D, round 2 (owner feedback, 2026-11-17, verbatim)

> "ở cg truyện phần này vẫn chưa rõ lắm, có lẽ là do phối màu mà t nhìn cả dòng đều như 1 thể chứ ko phân biệt được,
> ngoài ra hình nền sảnh và KV ko có ảnh trùng nên là làm hiệu ứng ấn vào ảnh thì phóng to ảnh ra và cạnh nút x để
> thoát có thêm nút tải là đủ rồi, còn hiệu ứng kéo ảnh ra của các trang khác đang làm giống merui cũng ok nhưng hơi
> khựng khi mở ra, m có thể đề xuất phương án khác bằng cách sài impeccable đối với tất cả những gì t vừa nêu"

Changes (impeccable pass, shots `D2-*`):
- **Rows:** "Nhóm" (segmented, with counts, on the card) and, under it on the darker ground, a labelled "↳ Bản /
  Chương / Truyện" row (underline) — two levels, two looks.
- **Hình nền sảnh / KV:** a tile opens straight to full screen; top bar = name · n / N · gold "Tải PNG gốc" · ✕;
  ‹ › and swipe go through the tab.
- **Stutter, cause:** the big image loaded after the panel had measured itself, so the panel grew twice; and a
  smooth-scroll ran beside the height tween. **Fix:** the frame is sized from the image's known ratio, the cached thumb
  shows at once and is swapped for the large file when it has loaded (no size change), the scroll is part of the same
  GSAP timeline. Measured: panel height equal before and after the large file loads.
- **Ways to open** (demo switch on the page, `?mo=`): **A · Rèm** (row below slides open), **B · Ảnh bay** (A + the
  thumb flies from the tile to the big image, shared-element), **C · Lớp phủ** (grid stays still, panel over the
  page, thumb flies to the centre). Phones: always a full-screen sheet. Recommended: B.

### D, round 3 (owner, 2026-11-17, verbatim)

> "cái này cũng đc, chỉ là t ko thích cái màu rồi khung này kia có vẻ hơi AI quá, ngoài ra nút tải ảnh đối với dạng
> to như KV thì chỉ cần Icon tải thôi, ko cần ghi chữ vào"

- Groups / versions: no boxes, no tinted band, no label cell or icon, no counts — groups in 15 px (bone + bold when
  chosen), versions under them in 13 px with the gold underline; one hairline under the pair. Shots `D3-*`.
- Full screen: download is an icon button (same quiet button as ✕; label "Tải ảnh" since round 4).
- The owner's preview pane is phone width, so the A / B / C opening effects were not seen yet (phones always get the
  sheet).

## Owner's choice (verbatim)

> "à mà t chọn C nhé"

D, opened the **C · Lớp phủ** way (panel over the page). A / B, the `?mo=` switch and their code are removed from the demo.

### D, round 4 (owner, 2026-11-17, verbatim)

> "r rhaays ảnh của merui phóng to lên đâu có mờ xong rồi rõ đâu nhỉ, nó rõ hẵn, ngoài ra các dạng hình có nhiều hình
> giống nhau thì họ hình như chỉ tải ảnh đầu, ấn vào ảnh sau thì nó sẽ hiện tiến trình tải r mới hiện ra ấ, vả lại ở
> phần phóng ảnh to ra thì vẫn cho phép nhìn xung quanh(thấy thanh menu) chỉ là tối hơn, với cả ở ảnh 2 thì chỉ cần"tải
> ảnh" hoặc "tải ảnh xuống" chứ ko cần nói rõ png gì hết"

Changes (shots `D4-*`):
- **No blur:** the large file is fetched first, then shown; the image that flies from the tile is that loaded file, so
  it is sharp the whole way. No thumb-then-sharpen swap.
- **Load on demand:** opening fetches only the image asked for (progress on the tile: dim + % + gold line along the
  bottom, shown only if the wait passes 120 ms). Another version is fetched when picked, with the progress on the big
  frame. No neighbour or version prefetch. Fetch stream + `content-length` → %, otherwise "Đang tải…" with a moving line.
  A failed load says so and keeps "Tải ảnh" working.
- **Dimmed page behind:** the panel and the full screen sit on `--scrim` (`rgb(0 0 0 / .6)`, from `tokens.css`), so
  the menu and grid stay visible, darker. The full-screen top bar keeps a dark band so its title never sits on page
  text. Phones keep a solid full-screen sheet.
- **Label:** "Tải ảnh" (panel button, and the full-screen icon's `aria-label` / tooltip).
- ← / → while the panel is open fetch the next tile and swap the panel's content in place; Tab stays inside the open
  layer.

### D, round 5 (owner, 2026-11-17, verbatim)

> "những trang thế này khi mở lên bị khựng và giựt nhẹ lên trên, có vẻ có căn ảnh ko chuẩn hay sao ấy, ngoài ra việc
> tất cả ảnh nằm trong 1 nền xám nhìn ko thích lắm, t cho rằng nó giống AI, m có thể sửa nền khác hoặc hòa vào nền gốc
> của web. merui chỉ di chuyển ảnh còn toàn bộ trang được giữ cố định"

Causes, measured: (1) locking the scroll dropped the scrollbar (page 1425 → 1440 px wide), so the whole grid reflowed
and every tile shifted ~3 px; (2) the panel slid up 10 px while the image flew, and the flight was aimed at the
panel's starting place, so the image landed ~6 px low and jumped up when the real one took over; (3) the flight began
from the hovered thumb, which is scaled 1.04.
Fix: `scrollbar-gutter: stable` on `html`; the panel only fades (no slide), so only the image moves; the flight starts
from the tile's own box. Measured after: tile rect identical before / after opening, scroll position kept, frame
rect identical at flight start and end.
Board: the grey card (surface + border) is gone; tabs, groups, versions and grid sit on the page background, aligned
to the heading. Shots `D5-*`.

### D, round 6 (owner, 2026-11-17, verbatim)

> "ý là t còn muốn phần ảnh sẽ có lướt riêng nuẵ, như m thấy trong ảnh t gửi thì phần ảnh lướt tại chổ còn cả trang
> bao gồm cả menu đều đứng yên"

Desktop (≥ 769 px): the page no longer scrolls; heading, search, kind tabs and the group / version rows stand still,
and only the image area under them scrolls (thin scrollbar, `overscroll-behavior: contain`; the "Ảnh trang phục /
Banner" footer is the last thing inside it). Changing tab / group / version puts it back at the top. Measured: page
height = viewport, tabs at the same place after scrolling the images, tiles still do not move when a picture opens.
Phones keep the normal page scroll (a scroller inside the page fights the browser bar and the thumb). Shot
`D6-1440-scrolled.jpg`.

### D, round 7 (owner, 2026-11-17, verbatim)

> "à mà bỏ cái mô tả đầu trang đi" — the lede under "Thư viện ảnh" is gone; title and search share one row. Shot
> `D7-1440-rows.jpg`.

Phone scroll, after the reasons were explained (browser bar does not collapse, swipes on the fixed header do nothing,
iOS Safari nested-scroll quirks): owner, verbatim: "Giữ cuộn cả trang".

Variant groups (owner, 2026-11-17, verbatim): "ảnh gần giống nhau ko phải từng nói rồi hả ? nó là 1 chuỗi ảnh đó" —
the grouping is accepted as decided; `gallery-variants.js` (102 groups) may become the real `variants` data.
R2 CORS checked the same day: `curl -H "Origin: …"` on the public bucket returns `Access-Control-Allow-Origin: *`
and `Content-Length`, so the load percentage works.

## Data finding from the demos

Story CGs of a version series (`v3` / `v2`) carry only the version in `gallery.json`, so their only possible name was
"Bản 3.5 Thượng". The demos name them by the story / event they open in (`story_cn` / `story_vi`, from INDEX.json
`group_cn`). `build_gallery_data.py` should carry that field (one small change + test) before the page is built.
