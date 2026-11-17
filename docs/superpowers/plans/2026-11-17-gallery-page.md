# Thư viện ảnh — trang `/gallery` (thiết kế D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang công khai `/gallery` (Thư viện ảnh) theo thiết kế D đã duyệt, sau khi chuyển trang Trang phục sang `/skins`; dữ liệu thêm `story_cn/story_vi` và `variants`; script đẩy R2 viết xong nhưng chỉ chạy thử.

**Architecture:** Giống trang Âm nhạc. Python (`tools/build_gallery_data.py`) ghi `public/gallery.json`; `tools/publish_gallery.py` tạo `t.webp` / `v.webp` / `o.png` cho R2. Trang là một "React island" (`GalleryPage.tsx`) do router gọi `mountGalleryPage`; logic thuần (lọc, URL, nhóm, tên, đường dẫn ảnh) ở `galleryData.mts`, tải ảnh to có tiến trình ở `loadImage.mts`, tấm phủ + toàn màn hình ở `GalleryViewer.tsx`.

**Tech Stack:** React 19 + TS (Vite 8), GSAP 3 (đã cài), lucide-react (đã cài), node:test (`.test.mts`), Python 3.14 unittest, Pillow, boto3 qua `publish_assets.py`, Playwright MCP để kiểm trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-17-gallery-page-design.md` (đọc cùng `docs/public-redesign/gallery/direction-approved.md` và demo `docs/public-redesign/gallery/design-demos/D-kho-khoanh-khac.html` — demo là chuẩn hình / hành vi, bản thật viết lại bằng React).

## Global Constraints

- **Không thao tác git ghi** (add / commit / push / checkout / stash / reset / restore), không ghi DB, **không đẩy R2** khi chủ dự án chưa nói "đồng ý" trong chat. Bước "Commit" của mọi task = *"Owner approval required, do not commit"*: liệt kê file đã đổi cho chủ dự án.
- **Không ghi đè sửa đổi chưa commit của chủ dự án**: `src/features/music/*` (không đụng), `src/i18n/strings.mts` (chỉ thêm khoá bằng Edit, neo ở dòng cuối của khối `vi` / `cn`; không Write cả file, không sắp lại), `src/features/characters/views/detail/infoView.js` (không đụng), `localization/localization_master.xlsx` (không đụng). Trước mỗi task: `git diff --stat` để biết file nào đang có sửa đổi của người khác.
- Bản thật: React + TS, **chỉ token của `src/styles/tokens.css`**. Đổi tên token demo → site: `--bg`→`--bg-main`, `--surface`→`--bg-surface`, `--lifted`→`--bg-elevated`, `--hover`→`--bg-surface-hover`, `--line`→`--border-color`, `--line2`→`--border-strong`, `--text`→`--text-main`, `--ash`→`--text-muted`, `--gold`→`--accent`, `--goldline`→`--border-gold-subtle`, `--golddiv`→`--border-gold-divider`, `--scrim`→`--scrim`, `--sans`→`--font-sans`, `--serif`→`--font-serif`. Không thêm thư viện.
- Nhãn tải: **"Tải ảnh"** (VI) — không ghi định dạng file. Không câu mô tả dưới tiêu đề. Không hộp / thẻ xám bao lưới.
- Ảnh trên web lấy từ R2 qua `asset_base_url`. `--base` của build chỉ để thử cục bộ; `public/gallery.json` có `asset_base_url` không bắt đầu bằng `https://pub-` thì **không được để lại** khi xong việc.
- **Evidence rule** (AGENTS.md): không suy nghĩa game từ ID / tên. Nhãn CN của loại / nhóm là bản nháp (`// draft`), không phải thuật ngữ game. Nhóm ảnh gần giống là bằng chứng hình ảnh, chỉ gọi "Bản 1 / 2…".
- Chữ nhỏ của thư viện ảnh (tên truyện mới trong `gallery_vi.json`): AI dịch bằng `.agents/skills/game-translator` (chủ dự án cho phép riêng cho thư viện ảnh). Không tự sửa 33 câu thơ ngoài danh sách chờ duyệt.
- Lệnh: `npm test` (node:test), `npx tsc --noEmit -p tsconfig.json`, `npm run test:tools` (≈2 phút; **2 lỗi cũ đã biết** `test_character_metadata_regression` — không phải do việc này), `npm run build`. Chạy một lệnh npm một lúc. Test Python lẻ: `python -m unittest discover -s tools -p "<file>.py" -v` từ gốc repo.
- Báo cáo cho chủ dự án bằng tiếng Việt.

## Review Focus

1. **Bấm ô thứ hai khi ảnh ô thứ nhất còn đang tải** → chỉ ảnh thứ hai mở; tiến trình trên ô thứ nhất biến mất. (Task 7, bước Playwright "bấm nhanh hai ô".)
2. **R2 không cho fetch (thiếu CORS) hoặc proxy chặn** → ảnh vẫn mở (tải bằng `<img>`), chỉ mất phần trăm, không báo lỗi giả. (Task 5, test "fetch blocked"; Task 9 kiểm bằng máy chủ không có CORS.)
3. **"Tải ảnh" trên R2 (khác origin)** → trình duyệt lưu file, không mở ảnh trong tab (thuộc tính `download` bị bỏ qua khi khác origin). (Task 8, test `Content-Disposition`; Task 10 `curl -I`.)
4. **Nút Back trên điện thoại khi tờ ảnh đang mở** → đóng tờ, ở lại trang; và router xoá `body.style.overflow` mỗi lần đổi route nên khoá cuộn phải nằm ở class trên `<html>`. (Task 7, bước Playwright Back + cuộn.)
5. **Link chia sẻ chỉ có `?kind=story&id=…`** (không `g` / `v`) → mở đúng ảnh, tự chọn nhóm / bản của nó. (Task 4, test "shared link".)

## Phán quyết trong kế hoạch (chủ dự án có thể đổi)

| Phán quyết | Lý do | Giá nếu sai |
|---|---|---|
| `/gallery` cũ **không** chuyển hướng sang `/skins`; tham số lạ → mặc định | `skinGalleryView.js` chưa từng ghi tham số vào URL (ô tìm là biến module), nên không có link `/gallery?…` kiểu trang phục; chủ dự án: "nhường lại gallery" | Bookmark `/gallery` cũ thấy Thư viện ảnh, thêm 1 cú bấm (rail "Trang Phục" hoặc link cuối trang) |
| `/gallery-demo` → `/skins` | nó là bí danh của trang trang phục | 1 dòng sửa |
| Đổi tên view router `gallery` → `skins` cho Trang phục; `gallery` = Thư viện ảnh | tránh `view === 'gallery'` nghĩa là trang phục trong khi URL `/gallery` là ảnh | ~8 dòng ở 6 file; sót chỗ nào → trang sai, nên Task 3 có bước grep |
| Tìm kiếm tìm **cả loại đang chọn**, bỏ hàng nhóm / bản lúc đang tìm | người gõ tên mong tìm thấy dù đang đứng ở bản khác (demo chỉ tìm trong bản đang chọn) | Đổi 1 dòng trong `filterItems` + 1 test |
| Mở ảnh **thêm một mục lịch sử**; đổi ảnh trong tấm / đổi bộ lọc thì thay tại chỗ | Back trên điện thoại phải đóng tờ ảnh (demo chỉ `replaceState`) | Nếu chủ dự án không muốn: bỏ `push` trong `write()` |
| `o.png` trên R2 gửi `Content-Disposition: attachment` | `download` bị bỏ qua khác origin | Mở thẳng `o.png` trong tab sẽ tải về thay vì xem (ảnh xem đã có `v.webp`) |
| Tải ảnh to: fetch + `content-length`; fetch lỗi mạng / CORS → `<img>` không phần trăm | spec lore 2026-09-24 đã yêu cầu CORS trên bucket công khai nhưng repo không chứng minh được nó đã bật | Thiếu CORS: chỉ mất %, vẫn xem / tải được |
| Giữ tối đa 24 ảnh to đã tải (object URL) rồi thu hồi cái cũ | xem 100 ảnh không giữ 100 MB trong RAM | Quay lại ảnh cũ thì tải lại (cache HTTP vẫn còn) |
| Máy tính: chân trang chung (`.app-footer`) nằm dưới vùng cuộn, luôn hiện | vùng trang cố định cao 100dvh, chân trang không được bị cắt | Mất ~50 px chiều cao vùng ảnh; ẩn bằng 1 dòng CSS nếu chủ dự án muốn |
| Đóng tấm / toàn màn hình **không** mờ dần (tắt ngay) | React gỡ ngay; chủ dự án chỉ phàn nàn lúc mở | Thêm trạng thái "đang đóng" nếu chủ dự án muốn |
| Deep link / Back-Forward mở ảnh **không** bay từ ô (chỉ mờ hiện) | lúc đó ô có thể chưa vẽ hoặc là ô của bộ lọc cũ | Thuần thẩm mỹ |
| Thẻ ở trang Thông tin và file `gallery_variants.json` để tới bước chủ dự án duyệt (Task 10) | spec: nhóm ảnh chờ duyệt; R2 chưa có ảnh | — |

## File map

| File | Việc |
|---|---|
| `tools/build_gallery_data.py`, `tools/test_build_gallery_data.py` | sửa: `story_name`, `story_cn/vi`, `variant_groups`, `variants`, `--base` |
| `tools/gallery_vi.json` | thêm VI cho tên truyện mới |
| `tools/publish_gallery.py`, `tools/test_publish_gallery.py` | tạo |
| `src/app/router/parseRoute.mts`, `location.mts`, `staticRoutes.mts`, `pageMeta.mts`, `router.js` + 4 file test | sửa |
| `src/app/layout/AppNav.tsx`, `src/config/reportIssue.js`, `src/features/skins/views/skinDetailView.js`, `skinGalleryView.js` (chú thích) | sửa |
| `tools/prerender-lib.mjs`, `tools/prerender-lib.test.mjs` | sửa |
| `src/i18n/strings.mts` | thêm khoá `ga*`, `ifGalleryDesc` (chỉ chèn) |
| `src/features/gallery/galleryData.mts` (+`.test.mts`) | tạo: kiểu, tải json, URL, lọc, nhóm, tên, đường dẫn ảnh |
| `src/features/gallery/loadImage.mts` (+`.test.mts`) | tạo: fetch có tiến trình, cache, fallback `<img>` |
| `src/features/gallery/GalleryViewer.tsx` | tạo: `Name`, `Loading`, `useLoader`, `fly`, `trap`, `Panel`, `FullScreen` |
| `src/features/gallery/GalleryPage.tsx`, `src/features/gallery/styles/gallery.css` | tạo: trang + island |
| `index.html` | thêm `<main id="gallery-view">` |
| `src/features/info/InfoPage.tsx`, `src/features/info/styles/info.css` | Task 10 (chờ duyệt) |
| `tools/gallery_variants.json` | Task 10 (chờ duyệt) |

---

### Task 1: `story_cn` / `story_vi` trong `gallery.json`

**Files:**
- Modify: `tools/build_gallery_data.py` (hằng `TEXT`, hàm mới `story_name`, `build_document`)
- Modify: `tools/gallery_vi.json` (VI cho tên truyện chưa có)
- Test: `tools/test_build_gallery_data.py`

**Interfaces:**
- Consumes: `build_music_data.EVENT_CN`, `split_group` (đã import sẵn).
- Produces: `story_name(x: dict) -> str`; mỗi mục `gallery.json` có thêm `story_cn: str`, `story_vi: str` (rỗng nếu `kind != "story"`). `TEXT = ("name", "note", "place", "sub", "story")`.

- [ ] **Step 1: Viết test hỏng** — thêm vào cuối `tools/test_build_gallery_data.py`, trước `if __name__ == "__main__":`

```python
class StoryNameTest(unittest.TestCase):
    def test_story_name_per_section(self):
        self.assertEqual(b.story_name(it("story", "a", section="Events", category="e040", group_cn="镂忆琢名")), "镂忆琢名")
        self.assertEqual(b.story_name(it("story", "d", section="Events", category="e035", group_cn="")), "釉生净土")  # EVENT_CN
        self.assertEqual(b.story_name(it("story", "x", section="Events", category="e099", group_cn="")), "")  # lore names none: none invented
        self.assertEqual(b.story_name(it("story", "c", section="Main_Story", category="m001", group_cn="来古 (原洛阳)")), "来古")
        raw = "上阳台帖 — truyện của 上阳台帖 · Thượng Dương Đài Thiếp [V0075]"
        self.assertEqual(b.story_name(it("story", "g", section="Other_Stories", category="c075", group_cn=raw)), "上阳台帖")

    def test_document_carries_story_and_its_translation(self):
        idx = {"items": [it("story", "s", section="Events", category="e040", group_cn="镂忆琢名"),
                         it("story", "t", section="Events", category="e041", group_cn="协韵行歌"),
                         it("loading", "L", name_cn="静谧小院")]}
        doc = b.build_document(idx, {"镂忆琢名": "Lũ Ức Trác Danh", "静谧小院": "Tĩnh Mịch Tiểu Viện"}, "", STARTS, VERS)
        s_, t_, l_ = doc["items"]
        self.assertEqual((s_["group"], s_["sub_cn"], s_["story_cn"], s_["story_vi"]), ("v3", "3.4上", "镂忆琢名", "Lũ Ức Trác Danh"))
        self.assertEqual((l_["story_cn"], l_["story_vi"]), ("", ""))
        self.assertIn("协韵行歌", b.untranslated(doc))
```

- [ ] **Step 2: Chạy, thấy hỏng**

Run: `python -m unittest discover -s tools -p "test_build_gallery_data.py" -v`
Expected: `AttributeError: module 'build_gallery_data' has no attribute 'story_name'` (2 lỗi), 10 test cũ vẫn `ok`.

- [ ] **Step 3: Viết code** — trong `tools/build_gallery_data.py`:

Đổi dòng `TEXT = ("name", "note", "place", "sub")` thành:

```python
TEXT = ("name", "note", "place", "sub", "story")
```

Thêm ngay sau hàm `story_group`:

```python
def story_name(x: dict) -> str:
    """The story / event a story CG opens in: the INDEX.tsv group of its first script, tidied like `sub`;
    '' when the lore names none (never invented)."""
    sec = x.get("section", "")
    if sec == "Events":
        return x.get("group_cn") or EVENT_CN.get(x.get("category", ""), "")
    if sec == "Main_Story":
        return re.sub(r"\s*\(.*\)$", "", x.get("group_cn", ""))
    return split_group(x.get("group_cn", ""), {})[0]
```

Trong `build_document`, dòng tạo `y` thêm `story_cn` ngay sau `"group": group, "sub_cn": sub`:

```python
             "group": group, "sub_cn": sub, "story_cn": story_name(x) if x["kind"] == "story" else ""}
```

(vòng `for k in TEXT` có sẵn sẽ tạo `story_vi`; `untranslated` tự tính cả `story`.)

- [ ] **Step 4: Chạy, thấy qua**

Run: `python -m unittest discover -s tools -p "test_build_gallery_data.py" -v`
Expected: `Ran 12 tests` … `OK`.

- [ ] **Step 5: Dịch tên truyện còn thiếu**

Run: `python tools/build_gallery_data.py --strings`
Expected: in ra các tên truyện / sự kiện CN chưa có trong `tools/gallery_vi.json` (có thể 0 dòng nếu đã có). Đọc `.agents/skills/game-translator/SKILL.md`, dịch từng dòng (tên riêng Hán-Việt, giữ tên sự kiện đã dùng ở trang Âm nhạc), chèn vào `tools/gallery_vi.json` dạng `"cn": "vi"`, giữ thứ tự khoá đã sắp. Chạy lại tới khi không còn dòng nào.

- [ ] **Step 6: Ghi lại `gallery.json`**

Run: `python tools/build_gallery_data.py`
Expected: `…public\gallery.json: 816 ảnh, … KB, chưa dịch 0`. Kiểm: `python -c "import json;d=json.load(open('public/gallery.json',encoding='utf-8'));print(sum(1 for i in d['items'] if i['story_cn']))"` → khoảng 550 (600 CG truyện trừ sự kiện không tên; demo đếm 554).

- [ ] **Step 7: Commit** — Owner approval required, do not commit. File: `tools/build_gallery_data.py`, `tools/test_build_gallery_data.py`, `tools/gallery_vi.json`, `public/gallery.json`.

---

### Task 2: `variants` + cờ `--base` trong build

**Files:**
- Modify: `tools/build_gallery_data.py` (`VARIANTS`, `variant_groups`, `build_document(..., variants=None)`, `main`)
- Test: `tools/test_build_gallery_data.py`

**Interfaces:**
- Produces: `variant_groups(groups: list, items: list[dict]) -> list` (trả `[[kind, [id, …]], …]`); `build_document(index, vi, base, starts, versions, char_vi=None, variants=None)` → doc có `"variants"` (luôn có, `[]` khi chưa duyệt). File vào (Task 10): `tools/gallery_variants.json` = `[[kind, [id, …]], …]`. CLI `--base URL`.

- [ ] **Step 1: Viết test hỏng** — thêm vào `tools/test_build_gallery_data.py`

```python
class VariantsTest(unittest.TestCase):
    def test_groups_keep_present_ids_in_order_and_drop_singletons(self):
        items = [{"kind": "story", "id": i} for i in ("a", "b", "c")] + [{"kind": "loading", "id": "a"}]
        got = b.variant_groups([["story", ["b", "a", "gone"]], ["story", ["c", "gone2"]], ["loading", ["a", "zz"]]], items)
        self.assertEqual(got, [["story", ["b", "a"]]])

    def test_an_image_in_two_groups_stops_the_build(self):
        items = [{"kind": "story", "id": i} for i in ("a", "b", "c")]
        with self.assertRaises(SystemExit):
            b.variant_groups([["story", ["a", "b"]], ["story", ["c", "a"]]], items)

    def test_document_carries_variants(self):
        idx = {"items": [it("story", "a", section="Other", group_cn="x"), it("story", "b", section="Other", group_cn="x")]}
        self.assertEqual(b.build_document(idx, {}, "", {}, [], variants=[["story", ["a", "b"]]])["variants"], [["story", ["a", "b"]]])
        self.assertEqual(b.build_document(idx, {}, "", {}, [])["variants"], [])  # not reviewed yet: every image its own tile
```

- [ ] **Step 2: Chạy, thấy hỏng** — `python -m unittest discover -s tools -p "test_build_gallery_data.py" -v` → `AttributeError: … 'variant_groups'` và `TypeError: build_document() got an unexpected keyword argument 'variants'`.

- [ ] **Step 3: Viết code** — trong `tools/build_gallery_data.py`:

Sau dòng `GALLERY_VI = …` thêm:

```python
VARIANTS = Path(__file__).resolve().parent / "gallery_variants.json"  # owner-reviewed near-identical groups (spec)
```

Thêm hàm trước `build_document`:

```python
def variant_groups(groups: list, items: list[dict]) -> list:
    """Owner-reviewed groups of near-identical images → [[kind, [ids]]] of the items present, order kept (first id =
    the tile). Groups left with one image are dropped; an image in two groups is a data error."""
    have = {(i["kind"], i["id"]) for i in items}
    out, seen = [], set()
    for kind, ids in groups:
        keep = [i for i in ids if (kind, i) in have]
        dup = [i for i in keep if (kind, i) in seen]
        if dup:
            raise SystemExit(f"gallery_variants.json: {kind} {dup} đã nằm ở nhóm khác")
        seen.update((kind, i) for i in keep)
        if len(keep) > 1:
            out.append([kind, keep])
    return out
```

Đổi chữ ký và dòng `return` của `build_document`:

```python
def build_document(index: dict, vi: dict[str, str], base: str, starts: dict[str, int], versions: list[dict],
                   char_vi: dict[str, str] | None = None, variants: list | None = None) -> dict:
    ...
    return {"version": index.get("version", ""), "asset_base_url": base, "items": items,
            "variants": variant_groups(variants or [], items)}
```

Trong `main`: thêm tham số và truyền vào:

```python
    ap.add_argument("--base", help="asset_base_url khác R2, CHỈ để thử cục bộ (không commit gallery.json đó)")
    ...
    variants = json.loads(VARIANTS.read_text(encoding="utf-8")) if VARIANTS.is_file() else []
    doc = build_document(index, vi, args.base or data.get("asset_base_url", ""), starts, versions, char_vi, variants)
    ...
    print(f"{args.out}: {len(doc['items'])} ảnh, {len(doc['variants'])} nhóm gần giống, "
          f"{args.out.stat().st_size // 1024} KB, chưa dịch {len(miss)}")
```

(dòng `doc = build_document(index, vi, data.get("asset_base_url", ""), …)` cũ được thay; nhánh `--strings` giữ nguyên.)

- [ ] **Step 4: Chạy, thấy qua** — `python -m unittest discover -s tools -p "test_build_gallery_data.py" -v` → `Ran 15 tests` … `OK`.

- [ ] **Step 5: Ghi lại** — `python tools/build_gallery_data.py` → `… 816 ảnh, 0 nhóm gần giống, … KB, chưa dịch 0` (chưa có `gallery_variants.json` — đúng, chờ duyệt).

- [ ] **Step 6: Commit** — Owner approval required, do not commit. File: `tools/build_gallery_data.py`, `tools/test_build_gallery_data.py`, `public/gallery.json`.

---

### Task 3: Trang phục chuyển sang `/skins`

**Files:**
- Modify: `src/app/router/parseRoute.mts:33-34`, `src/app/router/location.mts:24`, `src/app/router/pageMeta.mts:4`, `src/app/router/router.js:84,116`
- Modify: `src/app/layout/AppNav.tsx:29`, `src/config/reportIssue.js:37`, `src/features/skins/views/skinDetailView.js:43,93`, `src/features/skins/views/skinGalleryView.js:2` (chú thích)
- Modify: `tools/prerender-lib.mjs:21`
- Test: `src/app/router/parseRoute.test.mts`, `location.test.mts`, `pageMeta.test.mts`, `tools/prerender-lib.test.mjs`

**Interfaces:**
- Produces: view `'skins'` (trang Trang phục, container `skin-gallery-view`); `parseRoute('#/gallery-demo')` → `{ view: 'skins', …, redirect: '/skins' }`. Tạm thời `/gallery` vẫn là `skins` (Task 7 lấy lại).

- [ ] **Step 1: Viết test hỏng**

`src/app/router/parseRoute.test.mts`: đổi dòng `assert.equal(parseRoute('#/gallery?lang=cn').view, 'gallery');` thành
```ts
  assert.equal(parseRoute('#/skins?lang=cn').view, 'skins');
```
và đổi dòng `#/gallery-demo` thành
```ts
  assert.deepEqual(parseRoute('#/gallery-demo?lang=vi'), { view: 'skins', slug: '', subtab: '', redirect: '/skins' }); // owner 2026-11-17
```

`src/app/router/location.test.mts`: `assert.equal(legacyHashToPath('#/gallery-demo'), '/skins');`

`src/app/router/pageMeta.test.mts`: thêm trong test có sẵn
```ts
  assert.equal(pageTitle({ view: 'skins' }, data), 'Trang phục — Vật Hoa Di Tân Wiki');
```

`tools/prerender-lib.test.mjs`: thêm `'/skins'` vào mảng đường dẫn của test `buildPages: the page set`, và thêm
```js
  assert.equal(byPath['/skins'].title, 'Trang phục — Vật Hoa Di Tân Wiki');
```

- [ ] **Step 2: Chạy, thấy hỏng**

Run: `node --test src/app/router/parseRoute.test.mts src/app/router/location.test.mts src/app/router/pageMeta.test.mts tools/prerender-lib.test.mjs`
Expected: 4 test FAIL (`'gallery' !== 'skins'`, `'/gallery' !== '/skins'`, title `Vật Hoa Di Tân Wiki`, `byPath['/skins']` undefined).

- [ ] **Step 3: Viết code**

`parseRoute.mts` (thay hai dòng 33-34):
```ts
  if (path === '/gallery-demo' || path === 'gallery-demo') return { view: 'skins', slug: '', subtab: '', redirect: '/skins' };
  // /gallery: the skins page until the Thư viện ảnh takes it (plan 2026-11-17-gallery-page Task 7)
  if (['/skins', 'skins', '/gallery', 'gallery'].includes(path)) return { view: 'skins', slug: '', subtab: '' };
```
`location.mts`: `if (path === '/gallery-demo') return '/skins';`
`pageMeta.mts`: trong `VIEW` đổi `gallery: 'Trang phục'` → `skins: 'Trang phục'`.
`router.js`: `VIEW_CONTAINERS` đổi `gallery: 'skin-gallery-view',` → `skins: 'skin-gallery-view',`; trong `renderRouteView` đổi `else if (route.view === 'gallery') renderSkinGalleryView(target);` → `else if (route.view === 'skins') renderSkinGalleryView(target);`.
`AppNav.tsx:29`: `{ href: '/skins', label: 'navSkins', icon: Shirt, views: ['skins', 'skin-detail'] },`
`reportIssue.js` (`VIEW_ROUTE_LABELS`): `gallery: 'Thư Viện Trang Phục',` → `skins: 'Thư Viện Trang Phục',` (không đổi `SUBTAB_ROUTE_LABELS.gallery` — đó là tab "Thư Viện" của trang nhân vật).
`skinDetailView.js` dòng 43 và 93: `href="/gallery"` → `href="/skins"`.
`skinGalleryView.js:2`: chú thích `(/gallery or /skins)` → `(/skins)`.
`prerender-lib.mjs`: thêm sau dòng `page('/gallery', …)`:
```js
    page('/skins', 'Trang phục', 'Toàn bộ trang phục Khí Giả Vật Hoa Di Tân.'),
```

- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh Step 2 → toàn bộ PASS.

- [ ] **Step 5: Không sót chỗ nào**

Run: `git grep -n -e "'/gallery'" -e '"/gallery"' -e "view === 'gallery'" -e "gallery: '" -- src tools/prerender-lib.mjs`
Expected: chỉ còn `parseRoute.mts` (dòng tạm), `prerender-lib.mjs` (`page('/gallery', 'Trang phục', …)` — Task 7 đổi), `reportIssue.js` dòng `gallery: 'Thư Viện'` của `SUBTAB_ROUTE_LABELS`. Chỗ nào khác → sửa theo cùng quy tắc.

- [ ] **Step 6: Bộ test + kiểu** — `npm test` → `ℹ fail 0`; `npx tsc --noEmit -p tsconfig.json` → không in gì.

- [ ] **Step 7: Commit** — Owner approval required, do not commit. File: các file ở mục **Files** trên.

---

### Task 4: `galleryData.mts` + chuỗi giao diện

**Files:**
- Create: `src/features/gallery/galleryData.mts`
- Test: `src/features/gallery/galleryData.test.mts`
- Modify: `src/i18n/strings.mts` (chỉ chèn khoá)

**Interfaces:**
- Consumes: `versionLabel(v, lang)` của `src/features/music/musicData.mts` (chỉ import, không sửa file đó); `s`, `StringKey`.
- Produces (Task 6, 7 dùng):
  - kiểu `GalleryKind`, `StoryGroup`, `GalleryItem`, `GalleryDoc`, `GalleryState = { kind; g: StoryGroup | ''; v: string; q: string; id: string }`, `Tile = { it: GalleryItem; f: GalleryItem[] }`, `Text = { text: string; zh: boolean }`
  - hằng `KINDS`, `KIND_LABEL`, `GROUPS`, `GROUP_LABEL`, `DIRECT`
  - `loadGallery(fetchImpl?)`, `loadGalleryCached()`, `cachedGallery()`
  - `isVerGroup(g)`, `subs(doc, g)`, `defaultState(doc, kind?)`, `readState(doc, url)`, `stateUrl(st)`, `filterItems(doc, st)`, `families(doc)`, `tiles(list, fam)`
  - `pick(lang, vi, cn): Text`, `subText(it, lang): Text`, `title(it, lang): Text`
  - `thumbUrl(doc, it)`, `viewUrl(doc, it)`, `origUrl(doc, it)`, `downloadName(it)`

- [ ] **Step 1: Thêm chuỗi** (cần trước test vì `galleryData` dùng khoá). Trong `src/i18n/strings.mts`, dùng Edit chèn **sau** dòng cuối của khối `vi`:
`  muScenesTotal: 'Tổng {n} cảnh truyện', muNoUse: 'Chưa tìm thấy nơi game dùng bài này.',`

```ts
  // Thư viện ảnh (spec 2026-11-17-gallery-page-design.md)
  gaTitle: 'Thư viện ảnh', gaSearch: 'Tìm theo tên, địa danh, truyện', gaEmpty: 'Không có ảnh nào phù hợp.',
  gaLoadError: 'Không tải được thư viện ảnh.', gaImageError: 'Không tải được ảnh này. Vẫn có thể bấm “Tải ảnh”.',
  gaThumbError: 'Không tải được ảnh', gaDownload: 'Tải ảnh', gaFull: 'Xem toàn màn hình', gaPrev: 'Ảnh trước', gaNext: 'Ảnh sau',
  gaPrevVer: 'Bản trước', gaNextVer: 'Bản sau', gaVersions: '{n} bản', gaVersionN: 'Bản {n}', gaVersionsOf: 'Các bản của ảnh này',
  gaLoadingImg: 'Đang tải…', gaCount: '{n} ảnh', gaKinds: 'Loại ảnh', gaGroups: 'Nhóm',
  gaKStory: 'CG truyện', gaKLoading: 'Màn hình chờ', gaKHome: 'Hình nền sảnh', gaKKv: 'KV phiên bản', gaKPostcard: 'Bưu thiếp',
  gaGV3: 'Bản 3.x', gaGV2: 'Bản 2.x', gaGOld: 'Trước 2.5', gaGMain: 'Chính tuyến', gaGOther: 'Khác',
  gaVerN: 'Bản {v}', gaRowVer: 'Bản', gaRowChapter: 'Chương', gaRowStory: 'Truyện',
  gaFactKind: 'Loại', gaFactIn: 'Nằm trong', gaFactObtain: 'Cách nhận', gaFactPart: 'Bản', gaFactSize: 'Kích thước', gaFactId: 'Mã',
  gaElsewhere: 'Ảnh trang phục và banner có trang riêng:', ifGalleryDesc: 'CG truyện, màn hình chờ, KV và bưu thiếp; xem ảnh to, tải bản gốc.',
```

và chèn **sau** dòng cuối của khối `cn`:
`  muScenes: '{n} 段', muScenesTotal: '共 {n} 段剧情', muNoUse: '尚未找到游戏中使用此曲的位置。', // draft`

```ts
  // 画廊 — all draft; kind / group names are not game terms (evidence rule)
  gaTitle: '画廊', gaSearch: '按名称、地点、剧情搜索', gaEmpty: '没有符合的图片。', gaLoadError: '画廊加载失败。', // draft
  gaImageError: '无法加载此图片，仍可点击“下载图片”。', gaThumbError: '图片加载失败', gaDownload: '下载图片', gaFull: '全屏查看', // draft
  gaPrev: '上一张', gaNext: '下一张', gaPrevVer: '上一版', gaNextVer: '下一版', gaVersions: '{n} 版', gaVersionN: '第 {n} 版', // draft
  gaVersionsOf: '此图的各个版本', gaLoadingImg: '加载中…', gaCount: '{n} 张', gaKinds: '图片类型', gaGroups: '分组', // draft
  gaKStory: '剧情CG', gaKLoading: '加载图', gaKHome: '主界面背景', gaKKv: '版本KV', gaKPostcard: '明信片', // draft
  gaGV3: '3.x 版本', gaGV2: '2.x 版本', gaGOld: '2.5 之前', gaGMain: '主线', gaGOther: '其他', // draft
  gaVerN: '{v}', gaRowVer: '版本', gaRowChapter: '章节', gaRowStory: '剧情', // draft
  gaFactKind: '类型', gaFactIn: '所属', gaFactObtain: '获取方式', gaFactPart: '版本', gaFactSize: '尺寸', gaFactId: '编号', // draft
  gaElsewhere: '衣装与招集图另有专页：', ifGalleryDesc: '剧情CG、加载图、KV 与明信片，可看大图并下载原图。', // draft
```

Kiểm: `git diff src/i18n/strings.mts` chỉ thấy hai khối thêm + hai dòng `muLede`/`muElsewhere` của chủ dự án (không đổi).

- [ ] **Step 2: Viết test hỏng** — `src/features/gallery/galleryData.test.mts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultState, families, filterItems, loadGallery, origUrl, readState, stateUrl, subs, thumbUrl, tiles, title, viewUrl,
  type GalleryDoc, type GalleryItem, type GalleryState,
} from './galleryData.mts';

const it = (o: Partial<GalleryItem>): GalleryItem => ({ id: 'x', kind: 'story', file: 'gallery/story/x', w: 1680, h: 720,
  name_cn: '', name_vi: '', note_cn: '', note_vi: '', place_cn: '', place_vi: '', group: '', sub_cn: '', sub_vi: '',
  story_cn: '', story_vi: '', ...o });
const a = it({ id: 'cg_a', group: 'v3', sub_cn: '3.4上', story_cn: '镂忆琢名', story_vi: 'Lũ Ức Trác Danh' });
const b = it({ id: 'cg_b', group: 'v3', sub_cn: '3.5下', story_cn: '协韵行歌' });
const c = it({ id: 'cg_c', group: 'main', sub_cn: '来古', sub_vi: 'Lai Cổ' });
const a2 = it({ id: 'cg_a2', group: 'v3', sub_cn: '3.4上', story_cn: '镂忆琢名' });
const kv = it({ id: '2502', kind: 'kv', file: 'gallery/kv/2502', name_cn: '2.5下' });
const ld = it({ id: 'CG61001', kind: 'loading', file: 'gallery/loading/CG61001', name_cn: '静谧小院', name_vi: 'Tĩnh Mịch Tiểu Viện',
  note_cn: '不开启', note_vi: 'Không mở thu thập' });
const doc: GalleryDoc = { version: 'r3173', asset_base_url: 'https://r2.example/', items: [a, b, c, a2, kv, ld],
  variants: [['story', ['cg_a', 'cg_a2']]] };
const st = (o: Partial<GalleryState>): GalleryState => ({ kind: 'story', g: '', v: '', q: '', id: '', ...o });

test('versions newest first; other groups keep data order', () => {
  assert.deepEqual(subs(doc, 'v3'), ['3.5下', '3.4上']);
  assert.deepEqual(subs(doc, 'main'), ['来古']);
});

test('default: story tab on its newest version', () => {
  assert.deepEqual(defaultState(doc), st({ g: 'v3', v: '3.5下' }));
  assert.deepEqual(readState(doc, ''), defaultState(doc));
  assert.deepEqual(defaultState(doc, 'kv'), st({ kind: 'kv' }));
});

test('query round trip; unknown values fall back without a blank page', () => {
  const x = st({ g: 'v3', v: '3.4上', q: 'mưa & gió', id: 'cg_a' });
  assert.deepEqual(readState(doc, stateUrl(x)), x);
  assert.deepEqual(readState(doc, '#/gallery?kind=nope&g=zz&v=9.9&id=missing'), defaultState(doc));
  assert.deepEqual(readState(doc, '?kind=kv&g=v3&v=3.4上'), st({ kind: 'kv' }));
  assert.deepEqual(readState(doc, '?kind=story&g=v3'), st({ g: 'v3' })); // a group alone shows all of it
  assert.equal(stateUrl(st({ kind: 'kv' })), '/gallery?kind=kv');
});

test('a shared link to one image opens it even without its group / version', () => {
  assert.deepEqual(readState(doc, '?kind=story&id=cg_c'), st({ g: 'main', v: '来古', id: 'cg_c' }));
  assert.equal(readState(doc, '?kind=kv&id=cg_c').id, ''); // an id of another kind is ignored
});

test('filter: kind, group, version; a search spans the whole kind and folds Vietnamese marks', () => {
  assert.deepEqual(filterItems(doc, st({ g: 'v3' })).map((x) => x.id), ['cg_b', 'cg_a', 'cg_a2']);
  assert.deepEqual(filterItems(doc, st({ g: 'v3', v: '3.4上' })).map((x) => x.id), ['cg_a', 'cg_a2']);
  assert.deepEqual(filterItems(doc, st({ g: 'v3', v: '3.5下', q: 'lai co' })).map((x) => x.id), ['cg_c']);
  assert.deepEqual(filterItems(doc, st({ kind: 'loading', q: 'TĨNH MỊCH' })).map((x) => x.id), ['CG61001']);
  assert.deepEqual(filterItems(doc, st({ q: '3.4 thuong' })).map((x) => x.id), ['cg_a', 'cg_a2']);
});

test('near-identical images are one tile; the first kept member stands for it', () => {
  const fam = families(doc);
  const t = tiles(filterItems(doc, st({ g: 'v3', v: '3.4上' })), fam);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].f.map((x) => x.id), ['cg_a', 'cg_a2']);
  assert.equal(tiles([a2], fam)[0].it.id, 'cg_a2');
  assert.equal(families({ ...doc, variants: undefined }).size, 0); // before the owner's review: one tile per image
});

test('titles: own name, place, the story it opens in, version; a KV version label is not "untranslated"', () => {
  assert.deepEqual(title(ld, 'vi'), { text: 'Tĩnh Mịch Tiểu Viện', zh: false });
  assert.deepEqual(title(ld, 'cn'), { text: '静谧小院', zh: false });
  assert.deepEqual(title(a, 'vi'), { text: 'Lũ Ức Trác Danh', zh: false });
  assert.deepEqual(title(b, 'vi'), { text: '协韵行歌', zh: true });
  assert.deepEqual(title(c, 'vi'), { text: 'Lai Cổ', zh: false });
  assert.deepEqual(title(kv, 'vi'), { text: 'KV 2.5 Hạ', zh: false });
  assert.deepEqual(title(kv, 'cn'), { text: 'KV 2.5下', zh: false });
  assert.deepEqual(title(it({ id: 'cg_z', group: 'v3', sub_cn: '3.4上' }), 'vi'), { text: 'Bản 3.4 Thượng', zh: false });
  assert.deepEqual(title(it({ id: '18.2', kind: 'kv' }), 'vi'), { text: 'KV 18.2', zh: false });
});

test('image urls: thumb, view, original under the item file', () => {
  assert.equal(thumbUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/t.webp');
  assert.equal(viewUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/v.webp');
  assert.equal(origUrl(doc, ld), 'https://r2.example/gallery/loading/CG61001/o.png');
});

test('load returns null on a bad document or a failed fetch', async () => {
  assert.equal(await loadGallery(async () => new Response('{}')), null);
  assert.equal(await loadGallery(async () => { throw new Error('offline'); }), null);
  assert.equal((await loadGallery(async () => new Response(JSON.stringify(doc))))?.items.length, 6);
});
```

- [ ] **Step 3: Chạy, thấy hỏng** — `node --test src/features/gallery/galleryData.test.mts` → `ERR_MODULE_NOT_FOUND … galleryData.mts`.

- [ ] **Step 4: Viết code** — `src/features/gallery/galleryData.mts`

```ts
// public/gallery.json (tools/build_gallery_data.py) → the Thư viện ảnh page. Spec 2026-11-17-gallery-page-design.md.
import type { Lang } from '../../i18n/lang.mts';
import { s, type StringKey } from '../../i18n/strings.mts';
import { versionLabel } from '../music/musicData.mts';

export type GalleryKind = 'story' | 'loading' | 'home' | 'kv' | 'postcard';
export type StoryGroup = 'v3' | 'v2' | 'old' | 'main' | 'other';
export type GalleryItem = { id: string; kind: GalleryKind; file: string; w: number; h: number;
  name_cn: string; name_vi: string; note_cn: string; note_vi: string; place_cn: string; place_vi: string;
  group: StoryGroup | ''; sub_cn: string; sub_vi: string; story_cn: string; story_vi: string };
export type GalleryDoc = { version: string; asset_base_url: string; items: GalleryItem[]; variants?: [GalleryKind, string[]][] };
export type GalleryState = { kind: GalleryKind; g: StoryGroup | ''; v: string; q: string; id: string };
export type Tile = { it: GalleryItem; f: GalleryItem[] }; // f = the image's family (near-identical versions), it = the one shown
export type Text = { text: string; zh: boolean };          // zh: Chinese standing in for VI

export const KINDS: GalleryKind[] = ['story', 'loading', 'home', 'kv', 'postcard'];
export const KIND_LABEL: Record<GalleryKind, StringKey> = { story: 'gaKStory', loading: 'gaKLoading', home: 'gaKHome', kv: 'gaKKv', postcard: 'gaKPostcard' };
export const GROUPS: StoryGroup[] = ['v3', 'v2', 'old', 'main', 'other'];
export const GROUP_LABEL: Record<StoryGroup, StringKey> = { v3: 'gaGV3', v2: 'gaGV2', old: 'gaGOld', main: 'gaGMain', other: 'gaGOther' };
/** No versions in these kinds: a tile opens straight to full screen (owner, round 2). */
export const DIRECT: ReadonlySet<GalleryKind> = new Set<GalleryKind>(['home', 'kv']);
export const isVerGroup = (g: string) => g === 'v3' || g === 'v2';
const VERSION = /^(\d)\.(\d)(上|下)?$/;

// ponytail: one copy per page load, like music.json; a failed load is not kept.
let cached: GalleryDoc | null = null;
export const cachedGallery = () => cached;
export async function loadGalleryCached(): Promise<GalleryDoc | null> {
  return cached ?? (cached = await loadGallery());
}
export async function loadGallery(fetchImpl: typeof fetch = fetch): Promise<GalleryDoc | null> {
  try {
    const res = await fetchImpl('/gallery.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.items) ? (doc as GalleryDoc) : null;
  } catch {
    return null;
  }
}

const verKey = (v: string) => { const m = VERSION.exec(v); return m ? (+m[1] * 10 + +m[2]) * 2 + (m[3] === '下' ? 1 : 0) : -1; };
/** The second row of the story tab: versions newest first; events / chapters / stories in data order. */
export function subs(doc: GalleryDoc, g: StoryGroup | ''): string[] {
  const out = [...new Set(doc.items.filter((x) => x.kind === 'story' && x.group === g).map((x) => x.sub_cn))];
  return isVerGroup(g) ? out.sort((p, q) => verKey(q) - verKey(p)) : out;
}

export function defaultState(doc: GalleryDoc, kind: GalleryKind = 'story'): GalleryState {
  return kind === 'story' ? { kind, g: 'v3', v: subs(doc, 'v3')[0] ?? '', q: '', id: '' } : { kind, g: '', v: '', q: '', id: '' };
}

/** '/gallery?kind=story&g=v3&v=3.4上&q=…&id=…' (or the router's '#/gallery?…'); anything unknown falls back. */
export function readState(doc: GalleryDoc, url: string): GalleryState {
  const p = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
  const kind = KINDS.find((k) => k === p.get('kind')) ?? 'story';
  const st = { ...defaultState(doc, kind), q: p.get('q') ?? '' };
  if (kind === 'story') {
    const g = GROUPS.find((x) => x === p.get('g'));
    if (g) { st.g = g; st.v = ''; }
    const v = p.get('v') ?? '';
    if (v && subs(doc, st.g).includes(v)) st.v = v;
  }
  const hit = doc.items.find((x) => x.kind === kind && x.id === p.get('id'));
  if (hit) {
    st.id = hit.id;
    // a shared link to one image: show its own group / version if the link did not name them
    if (kind === 'story' && !(st.g === hit.group && (!st.v || st.v === hit.sub_cn))) { st.g = hit.group; st.v = hit.sub_cn; }
  }
  return st;
}

export function stateUrl(st: GalleryState): string {
  const p = new URLSearchParams();
  p.set('kind', st.kind);
  if (st.kind === 'story' && st.g) p.set('g', st.g);
  if (st.kind === 'story' && st.v) p.set('v', st.v);
  if (st.q.trim()) p.set('q', st.q);
  if (st.id) p.set('id', st.id);
  return `/gallery?${p}`;
}

const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const hay = (x: GalleryItem) => fold([x.id, x.name_cn, x.name_vi, x.place_cn, x.place_vi, x.note_cn, x.note_vi, x.sub_cn, x.sub_vi,
  x.story_cn, x.story_vi, isVerGroup(x.group) ? versionLabel(x.sub_cn, 'vi') : ''].join(' '));

/** The images of the tab. A search looks through the whole kind; the group / version rows apply only without one. */
export function filterItems(doc: GalleryDoc, st: GalleryState): GalleryItem[] {
  const q = fold(st.q.trim());
  const rows = st.kind === 'story' && !q;
  const out = doc.items.filter((x) => x.kind === st.kind
    && (!rows || ((!st.g || x.group === st.g) && (!st.v || x.sub_cn === st.v)))
    && (!q || hay(x).includes(q)));
  if (!rows || !st.g) return out;
  const order = subs(doc, st.g); // newest version first, as the row shows them
  return out.sort((p, q2) => order.indexOf(p.sub_cn) - order.indexOf(q2.sub_cn));
}

/** Owner-reviewed groups of near-identical images (gallery.json `variants`): each member → its whole group. */
export function families(doc: GalleryDoc): Map<GalleryItem, GalleryItem[]> {
  const by = new Map(doc.items.map((x) => [`${x.kind}:${x.id}`, x]));
  const fam = new Map<GalleryItem, GalleryItem[]>();
  for (const [kind, ids] of doc.variants ?? []) {
    const f = ids.map((id) => by.get(`${kind}:${id}`)).filter((x): x is GalleryItem => !!x);
    if (f.length > 1) for (const x of f) fam.set(x, f);
  }
  return fam;
}

/** One tile per family: the first member the filter kept stands for it. */
export function tiles(list: GalleryItem[], fam: Map<GalleryItem, GalleryItem[]>): Tile[] {
  const seen = new Set<GalleryItem[]>(), out: Tile[] = [];
  for (const it of list) {
    const f = fam.get(it) ?? [it];
    if (seen.has(f)) continue;
    seen.add(f);
    out.push({ it, f });
  }
  return out;
}

/** VI page: the Vietnamese, else the Chinese flagged; CN page: the Chinese (VI only if there is none). */
export const pick = (lang: Lang, vi: string, cn: string): Text =>
  lang === 'vi' ? (vi ? { text: vi, zh: false } : { text: cn, zh: !!cn }) : { text: cn || vi, zh: false };

/** Where a story CG sits: "Bản 3.4 Thượng" for a version series, else its event / chapter / story. */
export function subText(it: GalleryItem, lang: Lang): Text {
  if (isVerGroup(it.group)) return { text: s('gaVerN', lang).replace('{v}', versionLabel(it.sub_cn, lang)), zh: false };
  return it.sub_cn ? pick(lang, it.sub_vi, it.sub_cn) : { text: it.id, zh: false };
}

/** A name for every image: its own name → postcard place → the story it opens in → the KV code. */
export function title(it: GalleryItem, lang: Lang): Text {
  if (it.kind === 'kv') return { text: `KV ${VERSION.test(it.name_cn) ? versionLabel(it.name_cn, lang) : it.id}`, zh: false };
  if (it.name_cn) return pick(lang, it.name_vi, it.name_cn);
  if (it.place_cn) return pick(lang, it.place_vi, it.place_cn);
  if (it.kind === 'story') return isVerGroup(it.group) && it.story_cn ? pick(lang, it.story_vi, it.story_cn) : subText(it, lang);
  return { text: it.id, zh: false };
}

const base = (doc: GalleryDoc) => doc.asset_base_url.replace(/\/$/, '');
export const thumbUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/t.webp`;
export const viewUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/v.webp`;
export const origUrl = (doc: GalleryDoc, it: GalleryItem) => `${base(doc)}/${it.file}/o.png`;
export const downloadName = (it: GalleryItem) => `${it.kind}_${it.id}.png`;
```

- [ ] **Step 5: Chạy, thấy qua** — `node --test src/features/gallery/galleryData.test.mts` → `ℹ pass 9`, `ℹ fail 0`; `node --test src/i18n/strings.test.mts` → PASS (đủ khoá vi/cn); `npx tsc --noEmit -p tsconfig.json` → không in gì.

- [ ] **Step 6: Commit** — Owner approval required, do not commit. File: `src/features/gallery/galleryData.mts`, `galleryData.test.mts`, `src/i18n/strings.mts` (chỉ phần chèn).

---

### Task 5: `loadImage.mts` — ảnh to có tiến trình

**Files:**
- Create: `src/features/gallery/loadImage.mts`
- Test: `src/features/gallery/loadImage.test.mts`

**Interfaces:**
- Produces: `type Progress = (p: number) => void` (0..1, `-1` = không biết độ dài); `fetchBlob(url, onProgress, fetchImpl?) → Promise<Blob>` (lỗi HTTP → reject `Error('HTTP <code>')`); `loadImage(url, onProgress?, fetchImpl?) → Promise<string>` (src để gán cho `<img>`: `blob:` URL, hoặc chính `url` khi fetch bị chặn; một fetch cho mỗi url; tải lỗi không giữ).

- [ ] **Step 1: Viết test hỏng** — `src/features/gallery/loadImage.test.mts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchBlob, loadImage } from './loadImage.mts';

const body = (sizes: number[]) => new ReadableStream<Uint8Array>({ start(c) { for (const n of sizes) c.enqueue(new Uint8Array(n)); c.close(); } });
const res = (sizes: number[], headers: Record<string, string> = {}, status = 200) => new Response(body(sizes), { status, headers });

test('progress from content-length, ending at 1', async () => {
  const seen: number[] = [];
  const blob = await fetchBlob('u', (p) => seen.push(p), async () => res([2, 2], { 'content-length': '4', 'content-type': 'image/webp' }));
  assert.deepEqual(seen, [0.5, 1]);
  assert.equal(blob.size, 4);
  assert.equal(blob.type, 'image/webp');
});

test('no content-length: one "unknown" (-1), still the whole body', async () => {
  const seen: number[] = [];
  assert.equal((await fetchBlob('u', (p) => seen.push(p), async () => res([3]))).size, 3);
  assert.deepEqual(seen, [-1]);
});

test('an HTTP error rejects (the viewer says so, "Tải ảnh" stays)', async () => {
  await assert.rejects(fetchBlob('u', () => {}, async () => res([], {}, 404)), /HTTP 404/);
});

test('one fetch per url; a failed load is not kept', async () => {
  let calls = 0;
  const ok = async () => { calls += 1; return res([1], { 'content-length': '1' }); };
  const [x, y] = await Promise.all([loadImage('https://r2/a.webp', () => {}, ok), loadImage('https://r2/a.webp', () => {}, ok)]);
  assert.equal(x, y);
  assert.equal(calls, 1);
  assert.match(x, /^blob:/);
  let n = 0;
  const bad = async () => { n += 1; return res([], {}, 500); };
  await assert.rejects(loadImage('https://r2/b.webp', () => {}, bad));
  await assert.rejects(loadImage('https://r2/b.webp', () => {}, bad));
  assert.equal(n, 2);
});

test('fetch blocked (no CORS on R2, a proxy): the <img> loads it, progress unknown', async () => {
  const seen: number[] = [];
  (globalThis as any).Image = class { onload = () => {}; onerror = () => {}; set src(_v: string) { queueMicrotask(() => this.onload()); } };
  try {
    const src = await loadImage('https://r2/c.webp', (p) => seen.push(p), async () => { throw new TypeError('Failed to fetch'); });
    assert.equal(src, 'https://r2/c.webp');
    assert.deepEqual(seen, [-1]);
  } finally {
    delete (globalThis as any).Image;
  }
});
```

- [ ] **Step 2: Chạy, thấy hỏng** — `node --test src/features/gallery/loadImage.test.mts` → `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Viết code** — `src/features/gallery/loadImage.mts`

```ts
// The large image of the Thư viện ảnh viewer (spec 2026-11-17 "Tải ảnh to"; direction-approved.md round 4): fetched
// with progress and shown only when whole and decoded — sharp at once, never a blurry thumb that sharpens.
export type Progress = (p: number) => void; // 0..1, or -1 when the size is unknown

export async function fetchBlob(url: string, onProgress: Progress, fetchImpl: typeof fetch = fetch): Promise<Blob> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) { onProgress(-1); return res.blob(); }
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  return new Blob(parts, { type: res.headers.get('content-type') || 'image/webp' });
}

const MAX = 24; // ponytail: object URLs of the last 24 large images stay (≈0.3–1 MB each); older ones are revoked
const cache = new Map<string, Promise<string>>(); // insertion order = least recently used first
const listeners = new Map<string, Set<Progress>>();

async function decoded(src: string) {
  if (typeof Image === 'undefined') return;
  const im = new Image();
  im.src = src;
  await im.decode().catch(() => {});
}
/** Fetch blocked (R2 without a CORS rule, a proxy): the <img> still loads it, only without a percentage. */
const viaImg = (url: string) => new Promise<string>((ok, no) => {
  const im = new Image();
  im.onload = () => ok(url);
  im.onerror = () => no(new Error('image failed'));
  im.src = url;
});

export function loadImage(url: string, onProgress: Progress = () => {}, fetchImpl: typeof fetch = fetch): Promise<string> {
  const set = listeners.get(url) ?? new Set<Progress>();
  listeners.set(url, set);
  set.add(onProgress);
  let p = cache.get(url);
  if (p) cache.delete(url); // re-inserted below as the most recent
  else {
    const tell: Progress = (x) => listeners.get(url)?.forEach((f) => f(x));
    p = fetchBlob(url, tell, fetchImpl).then(
      async (blob) => { const src = URL.createObjectURL(blob); await decoded(src); return src; },
      (e) => { if (!(e instanceof TypeError)) throw e; tell(-1); return viaImg(url); },
    );
    p.catch(() => cache.delete(url));
  }
  cache.set(url, p);
  while (cache.size > MAX) {
    const [old, q] = cache.entries().next().value!;
    cache.delete(old);
    q.then((src) => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); }, () => {});
  }
  return p.finally(() => set.delete(onProgress));
}
```

- [ ] **Step 4: Chạy, thấy qua** — `node --test src/features/gallery/loadImage.test.mts` → `ℹ pass 5`, `ℹ fail 0`; `npx tsc --noEmit -p tsconfig.json` → không in gì.

- [ ] **Step 5: Commit** — Owner approval required, do not commit. File: `src/features/gallery/loadImage.mts`, `loadImage.test.mts`.

---

### Task 6: `GalleryViewer.tsx` — tấm phủ, toàn màn hình, tiến trình, ảnh bay

**Files:**
- Create: `src/features/gallery/GalleryViewer.tsx`

**Interfaces:**
- Consumes: Task 4 (`title`, `subText`, `pick`, `thumbUrl`, `origUrl`, `downloadName`, `KIND_LABEL`, `GROUP_LABEL`, `isVerGroup`, kiểu), Task 5 (`loadImage`), `reduced()` của `src/features/characters/motion.ts`.
- Produces (Task 7 dùng):
  - `Name({ t: Text })`, `Loading({ p: number })`
  - `useLoader(): { busy: Record<string, number>; load(key: string, url: string): Promise<string | null | undefined>; cancel(slot?: string): void }` — key `tile:<n>` | `frame` | `full`; `null` = lỗi, `undefined` = bị thay / huỷ
  - `trap(box: HTMLElement, e: KeyboardEvent): void`
  - `type PanelState = { n: number; at: number; shownAt: number; src: string | null }` và `Panel({ doc, f, state, from, busy?, onPick(at), onFull(frame), onClose() })`
  - `type FullState = { seq: GalleryItem[]; at: number; src: string | null; versions: boolean; step: -1 | 0 | 1 }` và `FullScreen({ doc, state, from, busy?, onStep(d: -1 | 1), onClose() })`
  - CSS class (Task 7 viết): `.ga-panel .ga-pin(.is-one) .ga-stage .ga-frame .ga-zoom .ga-broken .ga-strip .ga-info .ga-top .ga-poem .ga-acts .ga-btn(.is-icon/.is-gold) .ga-x .ga-full .ga-bar .ga-ct .ga-room .ga-full-frame .ga-pv .ga-nx .ga-fly .ga-ld(.is-ind) .ga-zh .ga-nw .ga-dot .ga-sr`

- [ ] **Step 1: Viết code** (component thuần hiển thị; kiểm bằng kiểu ở đây, bằng trình duyệt ở Task 7/9)

```tsx
// Viewer of the Thư viện ảnh (spec 2026-11-17 "Mở ảnh"; demo D-kho-khoanh-khac.html): the panel over the page
// (story / loading / postcard) and the full screen (home / KV, or the panel's big image). Only the loaded image
// moves; the layers fade in where they stand (owner, round 5).
import { Fragment, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight, Download, Maximize2, X } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import type { Lang } from '../../i18n/lang.mts';
import { reduced } from '../characters/motion.ts';
import {
  GROUP_LABEL, KIND_LABEL, downloadName, isVerGroup, origUrl, pick, subText, thumbUrl, title,
  type GalleryDoc, type GalleryItem, type StoryGroup, type Text,
} from './galleryData.mts';
import { loadImage } from './loadImage.mts';

/** Chinese standing in for VI: serif, the ash dot kept on the last glyph's line, "(chưa dịch)" for screen readers. */
export function Name({ t }: { t: Text }) {
  if (!t.zh) return <>{t.text}</>;
  const c = Array.from(t.text);
  return (
    <span className="ga-zh" lang="zh">
      {c.slice(0, -1).join('')}<span className="ga-nw">{c.at(-1)}<span className="ga-dot" aria-hidden="true" /></span>
      <span className="ga-sr"> (chưa dịch)</span>
    </span>
  );
}

/** Dimmed picture, % in the middle, a gold line along the bottom; "Đang tải…" with a moving line when the size is unknown. */
export function Loading({ p }: { p: number }) {
  const lang = useLang();
  return (
    <span className={`ga-ld${p < 0 ? ' is-ind' : ''}`} aria-hidden="true">
      <i style={p >= 0 ? { width: `${p * 100}%` } : undefined} />
      <b>{p < 0 ? s('gaLoadingImg', lang) : `${Math.round(p * 100)}%`}</b>
    </span>
  );
}

const slotOf = (key: string) => (key.startsWith('tile:') ? 'open' : key);
const without = (b: Record<string, number>, slot: string) => Object.fromEntries(Object.entries(b).filter(([k]) => slotOf(k) !== slot));
const step = (p: number) => (p < 0 ? -1 : Math.floor(p * 20) / 20); // 5 % steps: each one re-renders the grid

/**
 * Large images on demand (owner, round 4: only the image asked for). `load(key, url)` shows progress on `key`
 * (`tile:<n>`, `frame`, `full`) once the wait passes 120 ms, so a cached image opens without a flash; all `tile:*`
 * share one slot, so a newer click drops the older one. Resolves to the src, `null` when it failed, `undefined` when
 * it was superseded or cancelled.
 */
export function useLoader() {
  const [busy, setBusy] = useState<Record<string, number>>({});
  const want = useRef(new Map<string, object>());
  const load = useCallback((key: string, url: string): Promise<string | null | undefined> => {
    const slot = slotOf(key), token = {};
    want.current.set(slot, token);
    setBusy((b) => without(b, slot));
    const mine = () => want.current.get(slot) === token;
    let last = 0, shown = false;
    const timer = setTimeout(() => { shown = true; if (mine()) setBusy((b) => ({ ...b, [key]: last })); }, 120);
    const done = (src: string | null) => {
      clearTimeout(timer);
      if (!mine()) return undefined;
      want.current.delete(slot);
      setBusy((b) => without(b, slot));
      return src;
    };
    const progress = (p: number) => {
      const r = step(p);
      if (r === last) return;
      last = r;
      if (shown && mine()) setBusy((b) => ({ ...b, [key]: r }));
    };
    return loadImage(url, progress).then(done, () => done(null));
  }, []);
  const cancel = useCallback((slot?: string) => {
    if (slot) { want.current.delete(slot); setBusy((b) => without(b, slot)); } else { want.current.clear(); setBusy({}); }
  }, []);
  return { busy, load, cancel };
}

/** The loaded image flies from `from` (a tile's own box — its img is scaled 1.04 on hover — or the panel frame) to `to`. */
function fly(from: HTMLElement | null, to: HTMLElement | null, tl: gsap.core.Timeline, src: string) {
  if (!from || !to || reduced()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const c = Object.assign(new Image(), { src, alt: '', className: 'ga-fly' });
  Object.assign(c.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  document.body.append(c);
  gsap.set(to, { opacity: 0 });
  tl.fromTo(c, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.55, ease: 'expo.out' }, 0)
    .set(to, { opacity: 1 }, 0.55)
    .add(() => c.remove(), 0.56);
}

/** Tab stays inside the open layer. */
export function trap(box: HTMLElement, e: KeyboardEvent) {
  const f = [...box.querySelectorAll<HTMLElement>('a[href],button:not([hidden]),[tabindex="0"]')]
    .filter((x) => x.offsetParent || x === document.activeElement);
  if (!f.length) return;
  e.preventDefault();
  const i = f.indexOf(document.activeElement as HTMLElement);
  f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
}

/** Horizontal swipe (phones) → prev / next; vertical scrolling is left alone. */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: ReactTouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: ReactTouchEvent) => {
      const a = start.current;
      start.current = null;
      if (!a) return;
      const dx = e.changedTouches[0].clientX - a.x, dy = e.changedTouches[0].clientY - a.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx > 0 ? onPrev : onNext)();
    },
  };
}

const ratio = (it: GalleryItem) => ({ '--r': `${it.w}/${it.h}`, '--ar': it.w / it.h }) as CSSProperties;

function facts(f: GalleryItem[], at: number, lang: Lang): [string, ReactNode][] {
  const it = f[at];
  const out: [string, ReactNode][] = [[s('gaFactKind', lang), s(KIND_LABEL[it.kind], lang)]];
  if (it.kind === 'story') {
    out.push([s('gaFactIn', lang), isVerGroup(it.group)
      ? <Name t={subText(it, lang)} />
      : <>{s(GROUP_LABEL[it.group as StoryGroup], lang)} · <Name t={subText(it, lang)} /></>]);
  }
  if (it.kind === 'loading' && it.note_cn) out.push([s('gaFactObtain', lang), <Name t={pick(lang, it.note_vi, it.note_cn)} />]);
  if (f.length > 1) out.push([s('gaFactPart', lang), `${at + 1} / ${f.length}`]);
  out.push([s('gaFactSize', lang), `${it.w} × ${it.h} px`], [s('gaFactId', lang), it.id]);
  return out;
}

function Poem({ t }: { t: Text }) {
  return (
    <p className={`ga-poem${t.zh ? ' ga-zh' : ''}`} lang={t.zh ? 'zh' : undefined}>
      {t.text.split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>)}
      {t.zh && <span className="ga-sr"> (chưa dịch)</span>}
    </p>
  );
}

export type PanelState = { n: number; at: number; shownAt: number; src: string | null }; // at: chosen version; shownAt: the one on screen

/** The panel over the page on the scrim: big image · versions strip · facts + "Tải ảnh". Phones: a full-screen sheet (CSS). */
export function Panel({ doc, f, state, from, busy, onPick, onFull, onClose }: {
  doc: GalleryDoc; f: GalleryItem[]; state: PanelState; from: HTMLElement | null; busy?: number;
  onPick: (at: number) => void; onFull: (frame: HTMLElement) => void; onClose: () => void;
}) {
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const it = f[state.at], pic = f[state.shownAt];
  const swipe = useSwipe(() => onPick(state.at - 1), () => onPick(state.at + 1));
  useLayoutEffect(() => {
    const el = box.current!;
    el.querySelector<HTMLElement>('.ga-x')?.focus({ preventScroll: true });
    if (reduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
      .fromTo(el.querySelectorAll('.ga-strip, .ga-info'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.15);
    if (state.src) fly(from, frame.current, tl, state.src);
    return () => { tl.progress(1).kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per opening
  const seen = useRef({ n: state.n, shownAt: state.shownAt });
  useLayoutEffect(() => { // ← / →: same layer, new content; another version: the new picture fades in
    const was = seen.current;
    seen.current = { n: state.n, shownAt: state.shownAt };
    if (reduced()) return;
    if (was.n !== state.n) gsap.fromTo(box.current!.querySelector('.ga-pin'), { opacity: 0.4 }, { opacity: 1, duration: 0.25 });
    else if (was.shownAt !== state.shownAt) gsap.fromTo(frame.current!.querySelector('img'), { opacity: 0 }, { opacity: 1, duration: 0.25 });
  }, [state.n, state.shownAt]);
  const full = () => { if (state.src && frame.current) onFull(frame.current); };
  return (
    <div className="ga-panel" ref={box} role="dialog" aria-modal="true" aria-label={title(f[0], lang).text} data-lenis-prevent
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ga-pin${f.length > 1 ? '' : ' is-one'}`}>
        <div className="ga-stage" {...swipe}>
          <div className="ga-frame" ref={frame} style={ratio(pic)} role="button" tabIndex={0} aria-label={s('gaFull', lang)}
            onClick={full} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); full(); } }}>
            {state.src ? <img src={state.src} alt={title(pic, lang).text} /> : <p className="ga-broken">{s('gaImageError', lang)}</p>}
            <span className="ga-zoom" aria-hidden="true"><Maximize2 size={16} /></span>
            {busy !== undefined && <Loading p={busy} />}
          </div>
        </div>
        {f.length > 1 && (
          <div className="ga-strip" role="group" aria-label={s('gaVersionsOf', lang)}>
            <b>{s('gaVersions', lang).replace('{n}', String(f.length))}</b>
            {f.map((x, i) => (
              <button key={x.id} type="button" aria-current={i === state.at} style={ratio(x)}
                aria-label={s('gaVersionN', lang).replace('{n}', String(i + 1))} onClick={() => onPick(i)}>
                <img src={thumbUrl(doc, x)} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className="ga-info">
          <div className="ga-top">
            <button type="button" className="ga-btn is-icon ga-x" aria-label={s('close', lang)} onClick={onClose}><X size={18} /></button>
          </div>
          <h2><Name t={title(it, lang)} /></h2>
          {it.kind === 'postcard' && it.note_cn && <Poem t={pick(lang, it.note_vi, it.note_cn)} />}
          <dl>{facts(f, state.at, lang).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
          <div className="ga-acts">
            <a className="ga-btn is-gold" href={origUrl(doc, it)} download={downloadName(it)}>
              <Download size={16} aria-hidden="true" /><span>{s('gaDownload', lang)}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export type FullState = { seq: GalleryItem[]; at: number; src: string | null; versions: boolean; step: -1 | 0 | 1 };

/** Full screen on the scrim (the page stays visible, darker): bar = name · n / N · download icon · ✕. */
export function FullScreen({ doc, state, from, busy, onStep, onClose }: {
  doc: GalleryDoc; state: FullState; from: HTMLElement | null; busy?: number; onStep: (d: -1 | 1) => void; onClose: () => void;
}) {
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const it = state.seq[state.at];
  const many = state.seq.length > 1;
  const swipe = useSwipe(() => onStep(-1), () => onStep(1));
  useLayoutEffect(() => {
    const el = box.current!;
    el.querySelector<HTMLElement>('.ga-x')?.focus({ preventScroll: true });
    if (reduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 0)
      .fromTo(el.querySelector('.ga-bar'), { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, 0.1);
    if (state.src) fly(from, frame.current, tl, state.src);
    return () => { tl.progress(1).kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per opening
  const seen = useRef(state.at);
  useLayoutEffect(() => {
    if (seen.current === state.at) return;
    seen.current = state.at;
    if (!reduced()) gsap.fromTo(frame.current, { opacity: 0.3, x: 12 * state.step }, { opacity: 1, x: 0, duration: 0.35, ease: 'expo.out' });
  }, [state.at, state.step]);
  const outside = (e: { target: EventTarget; currentTarget: EventTarget }) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="ga-full" ref={box} role="dialog" aria-modal="true" aria-labelledby="ga-full-title" data-lenis-prevent>
      <div className="ga-bar" onClick={outside}>
        <b id="ga-full-title"><Name t={title(it, lang)} /></b>
        {many && <span className="ga-ct">{state.at + 1} / {state.seq.length}</span>}
        <a className="ga-btn is-icon" href={origUrl(doc, it)} download={downloadName(it)} aria-label={s('gaDownload', lang)} title={s('gaDownload', lang)}>
          <Download size={18} aria-hidden="true" />
        </a>
        <button type="button" className="ga-btn is-icon ga-x" aria-label={s('close', lang)} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="ga-room" onClick={outside} {...swipe}>
        <div className="ga-full-frame" ref={frame} style={ratio(it)}>
          {state.src ? <img src={state.src} alt={title(it, lang).text} /> : <p className="ga-broken">{s('gaImageError', lang)}</p>}
          {busy !== undefined && <Loading p={busy} />}
        </div>
        {many && (
          <>
            <button type="button" className="ga-btn is-icon ga-pv" aria-label={s(state.versions ? 'gaPrevVer' : 'gaPrev', lang)} onClick={() => onStep(-1)}><ChevronLeft size={22} /></button>
            <button type="button" className="ga-btn is-icon ga-nx" aria-label={s(state.versions ? 'gaNextVer' : 'gaNext', lang)} onClick={() => onStep(1)}><ChevronRight size={22} /></button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Kiểm kiểu** — `npx tsc --noEmit -p tsconfig.json` → không in gì. (Lỗi `BlobPart` / `TouchEvent` → sửa kiểu, không đổi hành vi.)

- [ ] **Step 3: Commit** — Owner approval required, do not commit. File: `src/features/gallery/GalleryViewer.tsx`.

---

### Task 7: `GalleryPage.tsx` + CSS + `/gallery` vào router

**Files:**
- Create: `src/features/gallery/GalleryPage.tsx`, `src/features/gallery/styles/gallery.css`
- Modify: `index.html` (sau dòng `<main id="music-view" …>`), `src/app/router/staticRoutes.mts`, `parseRoute.mts`, `pageMeta.mts`, `router.js`, `src/app/layout/AppNav.tsx:31`, `src/config/reportIssue.js`, `tools/prerender-lib.mjs`
- Test: `src/app/router/staticRoutes.test.mts`, `parseRoute.test.mts`, `pageMeta.test.mts`, `tools/prerender-lib.test.mjs`

**Interfaces:**
- Consumes: Task 4, 5, 6; `routeString`, `navigate`, `ROUTE_EVENT` (`location.mts`); `useSlider`, `useReveal` (`motion.ts`).
- Produces: `mountGalleryPage(container: HTMLElement): Promise<void>`, `unmountGalleryPage(): void`; `staticView('#/gallery…') === 'gallery'`; container `#gallery-view`.

- [ ] **Step 1: Viết test hỏng (router)**

`staticRoutes.test.mts` — thêm:
```ts
test('gallery route: the query is the page\'s own', () => {
  assert.equal(staticView('#/gallery'), 'gallery');
  assert.equal(staticView('#/gallery?kind=kv&id=2301&lang=cn'), 'gallery');
  assert.equal(staticView('#/gallery/x'), null);
  assert.equal(staticView('#/galleryx'), null);
});
```
`parseRoute.test.mts` — trong test đầu thêm `assert.equal(parseRoute('#/gallery?kind=story&g=v3&lang=cn').view, 'gallery');`
`pageMeta.test.mts` — thêm `assert.equal(pageTitle({ view: 'gallery' }, data), 'Thư viện ảnh — Vật Hoa Di Tân Wiki');`
`prerender-lib.test.mjs` — thêm `assert.equal(byPath['/gallery'].title, 'Thư viện ảnh — Vật Hoa Di Tân Wiki');`

- [ ] **Step 2: Chạy, thấy hỏng** — `node --test src/app/router/staticRoutes.test.mts src/app/router/parseRoute.test.mts src/app/router/pageMeta.test.mts tools/prerender-lib.test.mjs` → 4 FAIL.

- [ ] **Step 3: Router, menu, SEO**

`staticRoutes.mts`: kiểu trả về thêm `'gallery'`: `'home' | 'banners' | 'info' | 'music' | 'coffee' | 'gallery' | null`; thêm sau dòng `/coffee`:
```ts
  if (path === '/gallery') return 'gallery'; // Thư viện ảnh; kind / g / v / q / id are the page's own (spec 2026-11-17)
```
`parseRoute.mts`: dòng tạm của Task 3 thành
```ts
  if (['/skins', 'skins'].includes(path)) return { view: 'skins', slug: '', subtab: '' };
```
(xoá dòng chú thích tạm phía trên.)
`pageMeta.mts` (`VIEW`): thêm `gallery: 'Thư viện ảnh',`.
`reportIssue.js` (`VIEW_ROUTE_LABELS`): thêm `gallery: 'Thư Viện Ảnh',`.
`AppNav.tsx:31`: `views: ['info', 'banners', 'music', 'weapons', 'gallery']` (Thư viện ảnh nằm trong Thông tin, như Âm nhạc).
`prerender-lib.mjs`: dòng `page('/gallery', 'Trang phục', …)` thành
```js
    page('/gallery', 'Thư viện ảnh', 'CG truyện, màn hình chờ, hình nền sảnh, KV và bưu thiếp của Vật Hoa Di Tân; xem ảnh to, tải bản gốc.'),
```
`index.html` sau `<main id="music-view" class="music-view hidden"></main>`:
```html

    <!-- Thư viện ảnh View Root (React, src/features/gallery/GalleryPage.tsx) -->
    <main id="gallery-view" class="gallery-view hidden"></main>
```
`router.js`:
- import: `import { mountGalleryPage, unmountGalleryPage } from '../../features/gallery/GalleryPage.tsx';`
- `VIEW_CONTAINERS`: thêm `gallery: 'gallery-view',`
- vòng gỡ: thêm `if (id === 'gallery-view') unmountGalleryPage();`
- chuỗi mount: thêm `else if (route.view === 'gallery') mountGalleryPage(target);` **trước** `else if (route.view === 'skins') …` (dòng `else renderSkinDetailView` phải luôn ở cuối).

- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh Step 2 → PASS.

- [ ] **Step 5: Trang** — `src/features/gallery/GalleryPage.tsx`

```tsx
// Thư viện ảnh (/gallery): game images by the table that uses them; big view and original download.
// Spec docs/superpowers/specs/2026-11-17-gallery-page-design.md; look = direction D opened the "C · Lớp phủ" way
// (docs/public-redesign/gallery/direction-approved.md; reference demo design-demos/D-kho-khoanh-khac.html).
import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Layers, Search } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import { routeString, navigate, ROUTE_EVENT } from '../../app/router/location.mts';
import { useReveal, useSlider } from '../characters/motion.ts';
import {
  DIRECT, GROUPS, GROUP_LABEL, KINDS, KIND_LABEL, cachedGallery, defaultState, families, filterItems, isVerGroup,
  loadGalleryCached, readState, stateUrl, subText, subs, thumbUrl, tiles, title, viewUrl,
  type GalleryDoc, type GalleryItem, type GalleryKind, type GalleryState, type Tile,
} from './galleryData.mts';
import { FullScreen, Loading, Name, Panel, trap, useLoader, type FullState, type PanelState } from './GalleryViewer.tsx';
import './styles/gallery.css';

const phone = () => matchMedia('(max-width: 768px)').matches;

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false);
  return bad
    ? <span className="ga-ph">{s('gaThumbError')}</span>
    : <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

export function GalleryPage({ doc, retry }: { doc: GalleryDoc | null; retry: () => void }) {
  const lang = useLang();
  if (!doc) {
    return (
      <div className="ga-page">
        <div className="ga-empty"><p>{s('gaLoadError', lang)}</p><button type="button" className="ga-btn" onClick={retry}>{s('muRetry', lang)}</button></div>
      </div>
    );
  }
  return <Gallery doc={doc} />;
}

type How = 'click' | 'swap' | 'link'; // a tile click (flies, adds a history entry), ← / → in the panel, a link or Back / Forward

function Gallery({ doc }: { doc: GalleryDoc }) {
  const lang = useLang();
  const [st, setSt] = useState<GalleryState>(() => readState(doc, routeString()));
  const [q, setQ] = useState(st.q);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [full, setFull] = useState<FullState | null>(null);
  const { busy, load, cancel } = useLoader();
  const fam = useMemo(() => families(doc), [doc]);
  const list = useMemo(() => filterItems(doc, st), [doc, st]);
  const shown = useMemo(() => tiles(list, fam), [list, fam]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, doc.items.filter((x) => x.kind === k).length])) as Record<GalleryKind, number>, [doc]);
  const page = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const vers = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const from = useRef<HTMLElement | null>(null); // where the opening image flies from
  const openId = useRef(st.id);                   // the id this page has put in the URL
  const pushed = useRef(false);                   // opening added a history entry: closing goes Back
  const qTimer = useRef(0);
  const now = useRef({ st, shown, panel, full });  // for handlers that outlive a render (route event, awaited loads)
  now.current = { st, shown, panel, full };
  useSlider(tabs, KINDS.indexOf(st.kind));
  useReveal(page, '.ga-tile:nth-child(-n+14)', `${st.kind}|${st.g}|${st.v}|${st.q}`);

  const tileEl = (n: number) => grid.current?.querySelector<HTMLElement>(`[data-n="${n}"]`) ?? null;
  const repAt = (sh: Tile[], n: number) => sh[n].f.indexOf(sh[n].it);
  const write = (next: GalleryState, push = false) => {
    openId.current = next.id;
    if (push) { pushed.current = true; navigate(stateUrl(next)); } else history.replaceState(null, '', stateUrl(next));
  };

  const openPanel = async (sh: Tile[], n: number, at: number, how: How) => {
    const it = sh[n].f[at];
    const src = await load(how === 'swap' ? 'frame' : `tile:${n}`, viewUrl(doc, it));
    if (src === undefined) return; // another image was asked for, or the layer closed
    from.current = how === 'click' ? tileEl(n) : null;
    setPanel({ n, at, shownAt: at, src });
    if (how !== 'link') write({ ...now.current.st, id: it.id }, how === 'click');
  };
  const openFull = async (seq: GalleryItem[], at: number, key: string, fromEl: HTMLElement | null, versions: boolean, push: boolean) => {
    const src = await load(key, viewUrl(doc, seq[at]));
    if (src === undefined) return;
    from.current = fromEl;
    setFull({ seq, at, src, versions, step: 0 });
    if (push) write({ ...now.current.st, id: seq[at].id }, true);
  };
  // Another version: the facts follow at once, the picture once it has loaded (progress on the big frame).
  const pickVersion = async (at: number) => {
    const p = now.current.panel;
    if (!p) return;
    const f = now.current.shown[p.n].f;
    const a = (at + f.length) % f.length;
    setPanel({ ...p, at: a });
    write({ ...now.current.st, id: f[a].id });
    const src = await load('frame', viewUrl(doc, f[a]));
    if (src !== undefined) setPanel((x) => (x && x.n === p.n && x.at === a ? { ...x, src, shownAt: a } : x));
  };
  const stepFull = async (d: -1 | 1) => {
    const f = now.current.full;
    if (!f || f.seq.length < 2) return;
    const at = (f.at + d + f.seq.length) % f.seq.length;
    if (f.versions) void pickVersion(at); // the panel behind follows the same version
    const src = await load('full', viewUrl(doc, f.seq[at]));
    if (src === undefined) return;
    setFull((x) => (x ? { ...x, at, src, step: d } : x));
    if (!f.versions) write({ ...now.current.st, id: f.seq[at].id });
  };
  const closeAll = (silent = false) => {
    const { panel: p, full: fs } = now.current;
    const back = p ? p.n : fs && !fs.versions ? fs.at : -1; // the tile that opened it gets the focus back
    cancel();
    setPanel(null);
    setFull(null);
    const had = openId.current;
    openId.current = '';
    if (!silent && had) {
      if (pushed.current) history.back(); // the route event that follows finds no id and nothing open
      else history.replaceState(null, '', stateUrl({ ...now.current.st, id: '' }));
    }
    pushed.current = false;
    if (!silent && back >= 0) requestAnimationFrame(() => tileEl(back)?.focus({ preventScroll: true }));
  };
  const closeFull = () => {
    if (!now.current.panel) return closeAll();
    cancel('full');
    setFull(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.ga-frame')?.focus({ preventScroll: true }));
  };
  const set = (patch: Partial<GalleryState>) => {
    closeAll(true);
    const next = { ...now.current.st, ...patch, id: '' };
    setSt(next);
    write(next);
    scroller.current?.scrollTo({ top: 0 }); // desktop: the image area starts at the top again
    const t = tabs.current;
    if (phone() && t && t.getBoundingClientRect().top < 0) t.scrollIntoView({ block: 'start' });
  };
  const onQuery = (v: string) => {
    setQ(v);
    clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => set({ q: v }), 150);
  };
  const clearSearch = () => { setQ(''); set({ q: '' }); };
  const openById = (next: GalleryState) => {
    const sh = tiles(filterItems(doc, next), fam);
    const n = sh.findIndex((t) => t.f.some((x) => x.id === next.id));
    if (n < 0) return;
    openId.current = next.id; // already in the URL
    if (DIRECT.has(next.kind)) void openFull(sh.map((t) => t.it), n, `tile:${n}`, null, false, false);
    else void openPanel(sh, n, sh[n].f.findIndex((x) => x.id === next.id), 'link');
  };

  const api = useRef({ openById, closeAll });
  api.current = { openById, closeAll };
  useEffect(() => {
    if (now.current.st.id) api.current.openById(now.current.st); // a shared link to one image
    const onRoute = () => {
      const next = readState(doc, routeString());
      if (next.id !== openId.current) { // Back / Forward past an open image: the URL already says what to show
        api.current.closeAll(true);
        if (next.id) api.current.openById(next);
      }
      setSt(next);
      setQ(next.q);
    };
    addEventListener(ROUTE_EVENT, onRoute);
    return () => removeEventListener(ROUTE_EVENT, onRoute);
  }, [doc]);

  useEffect(() => { // every render: the keys act on this render's layers
    if (!panel && !full) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.matches?.('input')) return;
      const layer = document.querySelector<HTMLElement>(full ? '.ga-full' : '.ga-panel');
      if (e.key === 'Tab') { if (layer) trap(layer, e); return; }
      if (full) {
        if (e.key === 'Escape') closeFull();
        else if (e.key === 'ArrowLeft') void stepFull(-1);
        else if (e.key === 'ArrowRight') void stepFull(1);
        return;
      }
      const n = panel!.n;
      if (e.key === 'Escape') closeAll();
      else if (e.key === 'ArrowLeft' && n > 0) void openPanel(shown, n - 1, repAt(shown, n - 1), 'swap');
      else if (e.key === 'ArrowRight' && n < shown.length - 1) void openPanel(shown, n + 1, repAt(shown, n + 1), 'swap');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const layered = !!(panel || full);
  useEffect(() => {
    // phones scroll the document; a class (not body.style, which the router resets on every route) keeps it still
    document.documentElement.classList.toggle('ga-lock', layered);
    return () => document.documentElement.classList.remove('ga-lock');
  }, [layered]);

  useEffect(() => { // keep the chosen version in view in its row
    const row = vers.current, on = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  }, [st.g, st.v]);

  const searching = !!st.q.trim();
  const rowLabel = isVerGroup(st.g) ? 'gaRowVer' : st.g === 'main' ? 'gaRowChapter' : 'gaRowStory';
  const subItem = (v: string) => doc.items.find((x) => x.kind === 'story' && x.group === st.g && x.sub_cn === v)!;
  const opened = panel ? shown[panel.n] : null;
  return (
    <div className="ga-page" ref={page}>
      <header className="ga-head">
        <h1 className="ga-title">{s('gaTitle', lang)}</h1>
        <label className="ga-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={q} placeholder={s('gaSearch', lang)} aria-label={s('gaSearch', lang)} onChange={(e) => onQuery(e.target.value)} />
        </label>
      </header>
      <div className="ga-tabs" role="tablist" aria-label={s('gaKinds', lang)} ref={tabs}>
        <span className="seg-ink" aria-hidden="true" />
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === st.kind}
            onClick={() => { if (k !== st.kind) set({ ...defaultState(doc, k), q: st.q }); }}>
            {s(KIND_LABEL[k], lang)}<small>{counts[k]}</small>
          </button>
        ))}
      </div>
      <div className="ga-groups">
        {st.kind === 'story' && (
          <div className="ga-grp" role="group" aria-label={s('gaGroups', lang)}>
            {GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={!searching && g === st.g}
                onClick={() => { setQ(''); set({ g, v: isVerGroup(g) ? subs(doc, g)[0] ?? '' : '', q: '' }); }}>
                {s(GROUP_LABEL[g], lang)}
              </button>
            ))}
          </div>
        )}
        <span className="ga-res" aria-live="polite">{s('gaCount', lang).replace('{n}', String(list.length))}</span>
      </div>
      {st.kind === 'story' && (
        <div className="ga-vers" role="group" aria-label={s(rowLabel, lang)} ref={vers}>
          {['', ...subs(doc, st.g)].map((v) => (
            <button key={v || '*'} type="button" aria-pressed={!searching && v === st.v} onClick={() => { setQ(''); set({ v, q: '' }); }}>
              {v ? <Name t={subText(subItem(v), lang)} /> : s('muAll', lang)}
            </button>
          ))}
        </div>
      )}
      <div className="ga-scroll" ref={scroller} data-lenis-prevent>
        {shown.length ? (
          <div className={`ga-grid${st.kind === 'postcard' ? ' is-sq' : ''}`} ref={grid}>
            {shown.map(({ it, f }, n) => {
              const t = title(f[0], lang);
              const label = f.length > 1 ? `${t.text} · ${s('gaVersions', lang).replace('{n}', String(f.length))}` : t.text;
              const p = busy[`tile:${n}`];
              return (
                <button key={`${it.kind}:${it.id}`} type="button" className="ga-tile" data-n={n} aria-haspopup="dialog"
                  aria-expanded={panel?.n === n} aria-busy={p !== undefined} aria-label={label}
                  style={{ '--r': `${it.w}/${it.h}` } as CSSProperties}
                  onClick={(e) => {
                    if (DIRECT.has(it.kind)) void openFull(shown.map((x) => x.it), n, `tile:${n}`, e.currentTarget, false, true);
                    else void openPanel(shown, n, repAt(shown, n), 'click');
                  }}>
                  <Thumb src={thumbUrl(doc, it)} />
                  {f.length > 1 && <span className="ga-vc" aria-hidden="true"><Layers size={12} />{f.length}</span>}
                  <span className="ga-nm" aria-hidden="true"><Name t={t} /></span>
                  {p !== undefined && <Loading p={p} />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ga-empty">
            <p>{s('gaEmpty', lang)}</p>
            {searching && <button type="button" className="ga-btn" onClick={clearSearch}>{s('muClear', lang)}</button>}
          </div>
        )}
        <footer className="ga-elsewhere">
          <span>{s('gaElsewhere', lang)}</span><a href="/skins">{s('navSkins', lang)}</a><a href="/banners">{s('bnTitle', lang)}</a>
        </footer>
      </div>
      {opened && panel && createPortal(
        <Panel doc={doc} f={opened.f} state={panel} from={from.current} busy={busy.frame}
          onPick={(a) => void pickVersion(a)} onClose={() => closeAll()}
          onFull={(el) => void openFull(opened.f, panel.shownAt, 'frame', el, true, false)} />, document.body)}
      {full && createPortal(
        <FullScreen doc={doc} state={full} from={from.current} busy={busy.full} onStep={(d) => void stepFull(d)} onClose={closeFull} />,
        document.body)}
    </div>
  );
}

// ---- the island: one root per visit; a cached gallery.json renders synchronously (Back scroll restore) ----
let root: Root | null = null;
let host: HTMLElement | null = null;
let generation = 0;
export function unmountGalleryPage() { generation += 1; root?.unmount(); root = null; host = null; }
export function mountGalleryPage(container: HTMLElement): Promise<void> {
  // filters and an open image change the URL and the router calls mount again: the page (already here) follows the URL
  if (root && host === container && container.firstChild) return Promise.resolve();
  unmountGalleryPage();
  const retry = () => queueMicrotask(() => { unmountGalleryPage(); void mountGalleryPage(container); });
  const render = (doc: GalleryDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    host = container;
    flushSync(() => mounted.render(<StrictMode><GalleryPage doc={doc} retry={retry} /></StrictMode>));
  };
  const hit = cachedGallery();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadGalleryCached().then((doc) => { if (mine === generation) render(doc); });
}
```

- [ ] **Step 6: CSS** — `src/features/gallery/styles/gallery.css`

```css
/* Thư viện ảnh (docs/superpowers/specs/2026-11-17-gallery-page-design.md). Tokens only; look per
   docs/public-redesign/gallery/direction-approved.md (D, opened the "C · Lớp phủ" way). No card / grey box (owner). */

.gallery-view { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; background: var(--bg-main); }
.gallery-view.hidden { display: none !important; }
.ga-page { position: relative; max-width: 1320px; margin: 0 auto; padding: 24px 24px 0; color: var(--text-main); }
:is(.ga-page, .ga-panel, .ga-full) :is(a, button, input, [tabindex="0"]):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* desktop (owner, round 6): the page and its menu stand still, only the images scroll, in place under the tabs */
@media (min-width: 769px) {
  .gallery-view { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; scrollbar-gutter: auto; }
  .gallery-view > .app-footer { flex: none; }
  .ga-page { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; }
  .ga-scroll { flex: 1; min-height: 0; margin: 0 -4px; padding: 0 4px 24px; overflow-y: auto; overscroll-behavior: contain;
    scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; } /* 4 px: room for the focus ring */
}

/* head: title and search on one row, no lede (owner, round 7) */
.ga-head { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: center; justify-content: space-between; padding: 8px 0 16px; }
.ga-title { margin: 0; font: 700 36px/1.15 var(--font-serif); }
.ga-search { position: relative; display: block; width: 320px; }
.ga-search svg { position: absolute; left: 12px; top: 12px; color: var(--text-muted); }
.ga-search input { width: 100%; height: 40px; padding: 0 12px 0 36px; border: 1px solid var(--input-border); border-radius: 6px;
  background: var(--input-bg); color: var(--input-text); font: 14px var(--font-sans); }
.ga-search input::placeholder { color: var(--input-placeholder); }

/* kind tabs: the gold underline is the shared sliding ink (motion.ts useSlider sets top / height inline) */
.ga-tabs { position: relative; display: flex; gap: 28px; border-bottom: 1px solid var(--border-color); overflow-x: auto; scrollbar-width: none; }
.ga-tabs::-webkit-scrollbar { display: none; }
.ga-tabs > button { flex: none; height: 48px; padding: 0; border: 0; background: none; color: var(--text-muted); font: 500 15px var(--font-sans); cursor: pointer; white-space: nowrap; }
.ga-tabs > button:hover, .ga-tabs > button[aria-selected="true"] { color: var(--text-main); }
.ga-tabs small { margin-left: 6px; font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.ga-tabs > .seg-ink { top: auto !important; bottom: 0; height: 2px !important; background: var(--accent); border: 0; border-radius: 0; }

/* story rows (owner, round 3): plain type, no boxes — group 15 px (bone + bold when chosen), versions 13 px gold underline */
.ga-groups { display: flex; align-items: baseline; gap: 16px; padding: 14px 0 2px; }
.ga-grp { display: flex; gap: 22px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.ga-grp::-webkit-scrollbar, .ga-vers::-webkit-scrollbar { display: none; }
.ga-grp button { flex: none; padding: 2px 0; border: 0; background: none; color: var(--text-muted); font: 500 15px var(--font-sans); cursor: pointer; white-space: nowrap; }
.ga-grp button:hover { color: var(--text-main); }
.ga-grp button[aria-pressed="true"] { color: var(--text-main); font-weight: 600; }
.ga-res { margin-left: auto; font-size: 13px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ga-vers { position: relative; display: flex; gap: 18px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--border-color); }
.ga-vers button { flex: none; height: 36px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--text-muted); font: 500 13px var(--font-sans); cursor: pointer; white-space: nowrap; }
.ga-vers button:hover { color: var(--text-main); }
.ga-vers button[aria-pressed="true"] { color: var(--text-main); border-bottom-color: var(--accent); }

/* grid */
.ga-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; padding: 16px 0; }
.ga-grid.is-sq { grid-template-columns: repeat(8, minmax(0, 1fr)); }
.ga-tile { position: relative; display: block; width: 100%; aspect-ratio: var(--r); padding: 0; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: var(--bg-elevated); color: var(--text-main); cursor: pointer; }
.ga-tile img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .5s cubic-bezier(.16, 1, .3, 1); }
.ga-tile:hover { border-color: var(--border-gold-subtle); }
.ga-tile:hover img { transform: scale(1.04); }
.ga-tile[aria-expanded="true"] { border-color: var(--accent); }
.ga-nm { position: absolute; inset: auto 0 0 0; padding: 20px 10px 7px; background: linear-gradient(transparent, color-mix(in srgb, var(--bg-main) 88%, transparent));
  font: 500 13px/1.3 var(--font-sans); text-align: left; opacity: 0; transform: translateY(4px); transition: opacity .2s, transform .2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ga-tile:hover .ga-nm, .ga-tile:focus-visible .ga-nm, .ga-tile[aria-expanded="true"] .ga-nm { opacity: 1; transform: none; }
.ga-vc { position: absolute; top: 6px; right: 6px; display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 6px; border-radius: 6px;
  background: color-mix(in srgb, var(--bg-main) 82%, transparent); color: var(--text-main); font: 600 12px var(--font-sans); font-variant-numeric: tabular-nums; }
.ga-ph { display: grid; place-items: center; height: 100%; padding: 8px; color: var(--text-muted); font-size: 12px; }

/* loading (owner, round 4): the picture dims, the percentage sits in the middle, a gold line fills along the bottom */
.ga-ld { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; background: color-mix(in srgb, var(--bg-main) 55%, transparent); pointer-events: none; }
.ga-ld b { font: 600 12px var(--font-sans); color: var(--text-main); font-variant-numeric: tabular-nums; }
.ga-ld i { position: absolute; left: 0; bottom: 0; width: 0; height: 2px; background: var(--accent); transition: width .15s linear; }
.ga-ld.is-ind i { width: 30%; animation: ga-ld 1.1s linear infinite; }
@keyframes ga-ld { from { transform: translateX(-100%); } to { transform: translateX(340%); } }

/* buttons */
.ga-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 6px;
  background: var(--bg-surface); color: var(--text-main); font: 500 14px var(--font-sans); text-decoration: none; cursor: pointer; }
.ga-btn:hover { background: var(--bg-surface-hover); }
.ga-btn.is-icon { width: 40px; height: 40px; padding: 0; }
.ga-btn.is-gold { border-color: var(--accent); background: var(--accent); color: var(--on-vivid); font-weight: 600; }
.ga-btn.is-gold:hover { background: var(--accent); filter: brightness(1.08); }

/* the panel over the page (owner chose "C · Lớp phủ"): page and menu show through the scrim, darker.
   Layers sit above the rail (z 1000) like the skin lightbox (10000). */
.ga-panel { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 32px; background: var(--scrim); overflow: auto; overscroll-behavior: contain; color: var(--text-main); }
.ga-pin { display: grid; grid-template-columns: minmax(0, 1fr) auto 320px; width: min(1240px, 100%); border: 1px solid var(--border-strong); border-radius: 6px; background: var(--bg-main); }
.ga-pin.is-one { grid-template-columns: minmax(0, 1fr) 320px; }
.ga-stage { display: grid; place-items: center; padding: 16px; min-width: 0; }
.ga-frame { position: relative; width: min(100%, calc(60vh * var(--ar))); aspect-ratio: var(--r); border-radius: 6px; overflow: hidden; background: var(--bg-elevated); cursor: zoom-in; }
.ga-frame img, .ga-full-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ga-zoom { position: absolute; right: 10px; bottom: 10px; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 6px;
  background: color-mix(in srgb, var(--bg-main) 70%, transparent); opacity: 0; transition: opacity .2s; }
.ga-frame:hover .ga-zoom, .ga-frame:focus-visible .ga-zoom { opacity: 1; }
.ga-broken { display: grid; place-items: center; height: 100%; margin: 0; padding: 16px; color: var(--text-muted); font-size: 13px; text-align: center; }
.ga-strip { display: flex; flex-direction: column; gap: 8px; width: 120px; padding: 16px 8px; border-left: 1px solid var(--border-color); overflow-y: auto; max-height: calc(60vh + 32px); scrollbar-width: none; }
.ga-strip b { font-size: 12px; font-weight: 500; color: var(--text-muted); text-align: center; }
.ga-strip button { flex: none; width: 100%; aspect-ratio: var(--r); padding: 0; border: 1px solid var(--border-strong); border-radius: 6px; overflow: hidden; background: var(--bg-elevated); opacity: .45; cursor: pointer; transition: opacity .15s; }
.ga-strip button:hover { opacity: .8; }
.ga-strip button[aria-current="true"] { opacity: 1; border-color: var(--accent); }
.ga-strip img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ga-info { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px 20px; border-left: 1px solid var(--border-color); min-width: 0; }
.ga-top { display: flex; justify-content: flex-end; }
.ga-info h2 { margin: -8px 0 0; font: 700 22px/1.3 var(--font-serif); }
.ga-poem { margin: 0; padding: 10px 0; border-block: 1px solid var(--border-gold-divider); font: 500 15px/1.8 var(--font-serif); }
.ga-info dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; margin: 0; font-size: 13px; }
.ga-info dt { color: var(--text-muted); }
.ga-info dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.ga-acts { margin-top: auto; }
.ga-acts .ga-btn { width: 100%; height: 42px; }

/* full screen: bar on top = name · n / N · download icon · ✕; the bar's band keeps the title off the page's own text */
.ga-full { position: fixed; inset: 0; z-index: 10001; display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--scrim); color: var(--text-main); }
.ga-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px 10px 20px; background: color-mix(in srgb, var(--bg-main) 80%, transparent); }
.ga-bar b { flex: 1; min-width: 0; font: 600 17px/1.3 var(--font-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ga-ct { font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ga-room { position: relative; display: grid; place-items: center; padding: 0 64px 24px; min-height: 0; }
.ga-full-frame { position: relative; width: min(100%, calc((100dvh - 84px) * var(--ar))); aspect-ratio: var(--r); border-radius: 6px; overflow: hidden; background: var(--bg-elevated); }
.ga-pv, .ga-nx { position: absolute; top: 50%; margin-top: -32px; }
.ga-pv { left: 12px; }
.ga-nx { right: 12px; }
.ga-fly { position: fixed; z-index: 10002; margin: 0; border-radius: 6px; object-fit: cover; pointer-events: none; will-change: transform; }
html.ga-lock body { overflow: hidden; }

/* misc */
.ga-empty { display: grid; justify-items: start; gap: 12px; padding: 32px 0; color: var(--text-muted); }
.ga-empty p { margin: 0; }
.ga-elsewhere { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 24px 0; border-top: 1px solid var(--border-color); font-size: 13px; color: var(--text-muted); }
.ga-elsewhere a { color: var(--text-main); text-decoration: underline; text-decoration-color: var(--border-gold-subtle); text-underline-offset: 3px; }
.ga-zh { font-family: var(--font-serif); font-weight: 500; }
.ga-nw { white-space: nowrap; }
.ga-dot { display: inline-block; width: 5px; height: 5px; margin-left: 5px; border-radius: 50%; background: var(--text-muted); vertical-align: middle; }
.ga-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

@media (max-width: 1100px) {
  .ga-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ga-grid.is-sq { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .ga-pin, .ga-pin.is-one { grid-template-columns: minmax(0, 1fr) auto; }
  .ga-info { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--border-color); }
}
/* phones (owner: "Giữ cuộn cả trang"): the document scrolls; the panel is a solid full-screen sheet */
@media (max-width: 768px) {
  .gallery-view { scrollbar-gutter: auto; }
  .ga-page { padding: 16px 16px 0; }
  .ga-title { font-size: 28px; }
  .ga-search { width: 100%; }
  .ga-tabs { gap: 22px; }
  .ga-groups { padding-top: 12px; }
  .ga-res { display: none; }
  .ga-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px 0; }
  .ga-grid.is-sq { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ga-nm { display: none; } /* no hover on phones: the name is read in the opened sheet */
  .ga-panel { display: block; padding: 0; background: var(--bg-main); }
  .ga-pin { display: flex; flex-direction: column; width: auto; min-height: 100%; border: 0; border-radius: 0; }
  .ga-stage { padding: 56px 8px 8px; }
  .ga-frame { width: 100%; }
  .ga-zoom { opacity: 1; }
  .ga-strip { flex-direction: row; width: auto; max-height: none; padding: 8px; border-left: 0; border-top: 1px solid var(--border-color); overflow-x: auto; }
  .ga-strip b { display: none; }
  .ga-strip button { width: 120px; }
  .ga-info { border-left: 0; border-top: 1px solid var(--border-color); }
  .ga-info h2 { margin-top: 0; }
  .ga-top { position: fixed; top: 0; left: 0; right: 0; z-index: 2; padding: 8px; background: color-mix(in srgb, var(--bg-main) 92%, transparent); }
  .ga-bar { padding: 8px 8px 8px 16px; }
  .ga-room { padding: 0 8px 72px; }
  .ga-full-frame { width: min(100%, calc((100dvh - 136px) * var(--ar))); }
  .ga-pv, .ga-nx { top: auto; bottom: 12px; margin: 0; }
  .ga-btn.is-icon { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ga-ld.is-ind i { animation: none; width: 100%; opacity: .5; }
  .ga-tile img, .ga-nm { transition: none; }
  .ga-tile:hover img { transform: none; }
}
```

- [ ] **Step 7: Kiểu + test + build** — `npx tsc --noEmit -p tsconfig.json` → không in gì; `npm test` → `ℹ fail 0` (310 cũ + test mới); `npm run build` → kết thúc bằng `prerender: <n> pages`; `dist/gallery/index.html` chứa `<title>Thư viện ảnh — Vật Hoa Di Tân Wiki</title>`, `dist/skins/index.html` chứa `Trang phục — Vật Hoa Di Tân Wiki`.

- [ ] **Step 8: Xem nhanh trong trình duyệt** (ảnh thật đến ở Task 9; ở đây ảnh R2 chưa có nên ô hiện "Không tải được ảnh" — đúng hành vi lỗi). `npm run dev` (nền) → Playwright mở `http://localhost:5173/gallery`: thấy "Thư viện ảnh", 5 tab có số (600 · 139 · 16 · 28 · 33), hàng nhóm + hàng bản, lưới 5 cột ở 1440 px; `/skins` ra trang Trang phục, rail "Trang Phục" sáng; `/gallery-demo` → URL thành `/skins`; console không lỗi đỏ ngoài 404 ảnh.

- [ ] **Step 9: Commit** — Owner approval required, do not commit. File: các file ở mục **Files**.

---

### Task 8: `publish_gallery.py` (chỉ chạy thử)

**Files:**
- Create: `tools/publish_gallery.py`
- Test: `tools/test_publish_gallery.py`

**Interfaces:**
- Consumes: `public/gallery.json` (`items[].file/kind/id`); png ở `<export>/<kind>/<id>.png` (`WHMX_Tool/Xuat/Gallery_r*` mới nhất); `publish_assets.REQUIRED_ENV`, `create_s3_client`, `load_dotenv_without_logging`, `sha256_file`; `publish_music._unchanged`; `build_gallery_data.OUT`, `TOOL`, `_latest`.
- Produces: `objects(item) -> list[tuple[str, str]]` (khoá R2, bản `t`/`v`/`o`); `render(src, variant, out) -> Path`; `extra_args(item, variant, source) -> dict`; `publish(items, export, *, client=None, bucket="", stage=None, force=False) -> dict` (`sent`, `skipped`, `missing`, `bytes`). CLI: `--dry-run` | `--stage DIR` | (không cờ = đẩy thật, chờ duyệt), `--force`.

- [ ] **Step 1: Viết test hỏng** — `tools/test_publish_gallery.py`

```python
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import publish_gallery as p

ITEM = {"id": "cg_1_20", "kind": "story", "file": "gallery/story/cg_1_20"}


def png(folder: Path, kind: str, id_: str, size=(1680, 720)) -> Path:
    (folder / kind).mkdir(parents=True, exist_ok=True)
    f = folder / kind / f"{id_}.png"
    Image.new("RGB", size, (200, 10, 10)).save(f)
    return f


class ObjectsTest(unittest.TestCase):
    def test_three_keys_per_image(self):
        self.assertEqual(p.objects(ITEM), [("gallery/story/cg_1_20/t.webp", "t"), ("gallery/story/cg_1_20/v.webp", "v"),
                                           ("gallery/story/cg_1_20/o.png", "o")])
        self.assertEqual(p.objects({"id": "18.2", "kind": "kv", "file": "gallery/kv/18.2"})[0][0], "gallery/kv/18.2/t.webp")

    def test_unsafe_keys_are_refused(self):
        for bad in ("gallery/story/..", "gallery/story/../x", "music/bgm/x", "gallery/other/x", "gallery/story/a b"):
            with self.assertRaises(ValueError, msg=bad):
                p.objects({**ITEM, "file": bad})


class RenderTest(unittest.TestCase):
    def test_thumb_480_wide_view_full_size_original_as_is(self):
        with tempfile.TemporaryDirectory() as d:
            src = png(Path(d), "story", "a")
            with Image.open(p.render(src, "t", Path(d) / "t.webp")) as im:
                self.assertEqual((im.size, im.format), ((480, 206), "WEBP"))
            with Image.open(p.render(src, "v", Path(d) / "v.webp")) as im:
                self.assertEqual((im.size, im.format), ((1680, 720), "WEBP"))
            self.assertEqual(p.render(src, "o", Path(d) / "o"), src)


class ArgsTest(unittest.TestCase):
    def test_original_downloads_as_attachment(self):
        a = p.extra_args({"kind": "kv", "id": "2301"}, "o", "abc")
        self.assertEqual(a["ContentDisposition"], 'attachment; filename="kv_2301.png"')
        self.assertEqual((a["ContentType"], a["Metadata"]["source-sha256"]), ("image/png", "abc"))
        t = p.extra_args({"kind": "kv", "id": "2301"}, "t", "abc")
        self.assertNotIn("ContentDisposition", t)
        self.assertEqual(t["ContentType"], "image/webp")


class FakeClient:
    def __init__(self, sha):
        self.sha, self.sent = sha, []

    def head_object(self, Bucket, Key):
        return {"Metadata": {"source-sha256": self.sha}}

    def upload_file(self, f, bucket, key, ExtraArgs):
        self.sent.append((key, ExtraArgs["ContentType"]))


class PublishTest(unittest.TestCase):
    def test_stage_writes_the_r2_layout_and_lists_missing_png(self):
        with tempfile.TemporaryDirectory() as d:
            png(Path(d) / "exp", "story", "cg_1_20")
            stage = Path(d) / "stage"
            n = p.publish([ITEM, {"id": "gone", "kind": "story", "file": "gallery/story/gone"}], Path(d) / "exp", stage=stage)
            self.assertEqual((n["sent"], n["missing"]), (3, ["story/gone"]))
            for f in ("t.webp", "v.webp", "o.png"):
                self.assertTrue((stage / "gallery/story/cg_1_20" / f).is_file(), f)

    def test_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            png(Path(d) / "exp", "story", "cg_1_20")
            n = p.publish([ITEM], Path(d) / "exp")
            self.assertEqual((n["sent"], n["bytes"]), (3, 0))

    def test_unchanged_source_is_skipped_unless_forced(self):
        with tempfile.TemporaryDirectory() as d:
            src = png(Path(d) / "exp", "story", "cg_1_20")
            same = FakeClient(p.sha256_file(src))
            self.assertEqual(p.publish([ITEM], Path(d) / "exp", client=same, bucket="b")["skipped"], 3)
            self.assertEqual(same.sent, [])
            p.publish([ITEM], Path(d) / "exp", client=same, bucket="b", force=True)
            self.assertEqual([k for k, _ in same.sent], [k for k, _ in p.objects(ITEM)])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy, thấy hỏng** — `python -m unittest discover -s tools -p "test_publish_gallery.py" -v` → `ModuleNotFoundError: No module named 'publish_gallery'`.

- [ ] **Step 3: Viết code** — `tools/publish_gallery.py`

```python
"""Thư viện ảnh images → R2 (spec 2026-11-17-gallery-page-design.md): gallery/<kind>/<id>/{t.webp,v.webp,o.png}.
--dry-run counts only; --stage DIR writes the same objects under DIR (local check, no network); no flag uploads
(owner approval first)."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

from PIL import Image

from build_gallery_data import OUT as GALLERY_JSON, TOOL, _latest
from publish_assets import REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file
from publish_music import _unchanged

ROOT = Path(__file__).resolve().parent.parent
THUMB_W = 480
QUALITY = {"t": 85, "v": 90}  # v ≈ 90 (spec); the 480 px thumb needs less
CTYPE = {"t": "image/webp", "v": "image/webp", "o": "image/png"}
SAFE = re.compile(r"gallery/(story|loading|home|kv|postcard)/(?!\.)[A-Za-z0-9_.-]+")
CACHE = "public, max-age=604800"


def objects(item: dict) -> list[tuple[str, str]]:
    """(R2 key, variant) for one gallery.json item; refuses anything that is not gallery/<kind>/<id>."""
    if not SAFE.fullmatch(item["file"]):
        raise ValueError(f"unsafe R2 key: {item['file']!r}")
    return [(f"{item['file']}/{v}.{'png' if v == 'o' else 'webp'}", v) for v in ("t", "v", "o")]


def render(src: Path, variant: str, out: Path) -> Path:
    """o = the original png as is; v = same-size webp; t = 480 px wide webp."""
    if variant == "o":
        return src
    with Image.open(src) as im:
        im = im if im.mode in ("RGB", "RGBA") else im.convert("RGBA")
        if variant == "t" and im.width > THUMB_W:
            im = im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.Resampling.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY[variant], method=4)
    return out


def extra_args(item: dict, variant: str, source: str) -> dict:
    a = {"ContentType": CTYPE[variant], "CacheControl": CACHE,
         "Metadata": {"source-sha256": source, "policy-version": f"gallery-{variant}-w{THUMB_W}-q{QUALITY.get(variant, 0)}"}}
    if variant == "o":  # <a download> is ignored across origins (R2 ≠ the site): the header makes "Tải ảnh" save the file
        a["ContentDisposition"] = f'attachment; filename="{item["kind"]}_{item["id"]}.png"'
    return a


def publish(items: list[dict], export: Path, *, client=None, bucket: str = "", stage: Path | None = None,
            force: bool = False) -> dict:
    """No client and no stage = dry run. ponytail: the skip compares the source png only; after changing THUMB_W or
    QUALITY run with --force."""
    n = {"sent": 0, "skipped": 0, "missing": [], "bytes": 0}
    with tempfile.TemporaryDirectory() as tmp:
        for item in items:
            src = export / item["kind"] / f"{item['id']}.png"
            if not src.is_file():
                n["missing"].append(f"{item['kind']}/{item['id']}")
                continue
            source = sha256_file(src)
            for key, v in objects(item):
                if client and not force and _unchanged(client, bucket, key, source):
                    n["skipped"] += 1
                    continue
                if client is None and stage is None:
                    n["sent"] += 1
                    continue
                body = render(src, v, Path(tmp) / f"{v}.webp")
                n["bytes"] += body.stat().st_size
                if stage is not None:
                    dest = stage / key
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(body, dest)
                else:
                    client.upload_file(str(body), bucket, key, ExtraArgs=extra_args(item, v, source))
                n["sent"] += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gallery", type=Path, default=GALLERY_JSON)
    ap.add_argument("--export", type=Path, default=_latest("Xuat/Gallery_r*") or TOOL / "Xuat" / "Gallery")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="chỉ đếm, không ghi gì")
    mode.add_argument("--stage", type=Path, help="ghi object ra thư mục này thay vì R2 (thử cục bộ)")
    ap.add_argument("--force", action="store_true", help="đẩy lại cả object không đổi (sau khi đổi THUMB_W / QUALITY)")
    args = ap.parse_args()
    items = json.loads(args.gallery.read_text(encoding="utf-8"))["items"]
    client, bucket = None, ""
    if not args.dry_run and args.stage is None:
        load_dotenv_without_logging(ROOT / ".env")
        missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    n = publish(items, args.export, client=client, bucket=bucket, stage=args.stage, force=args.force)
    verb = "would upload" if args.dry_run else f"staged → {args.stage}" if args.stage else "uploaded"
    print(f"{verb}: {n['sent']} objects ({n['bytes'] / 2**20:.0f} MB), unchanged {n['skipped']}, missing png {len(n['missing'])}")
    for m in n["missing"][:20]:
        print("  thiếu", m)
    return 1 if n["missing"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Chạy, thấy qua** — `python -m unittest discover -s tools -p "test_publish_gallery.py" -v` → `Ran 7 tests` … `OK`.

- [ ] **Step 5: Chạy thử thật (không mạng)** — `python tools/publish_gallery.py --dry-run` → `would upload: 2448 objects (0 MB), unchanged 0, missing png 0` (816 × 3). Thiếu png → dừng, báo chủ dự án (bản xuất và `gallery.json` lệch nhau).

- [ ] **Step 6: Commit** — Owner approval required, do not commit. File: `tools/publish_gallery.py`, `tools/test_publish_gallery.py`.

---

### Task 9: Kiểm tra toàn bộ (cục bộ, không R2)

**Files:** không tạo file mới trong repo. Thư mục tạm `.asset-publish-tmp/gallery-stage/` (đã git-ignore). `public/gallery.json` tạm có base cục bộ — **phải trả lại** ở Step 7.

- [ ] **Step 1: Bộ test** — lần lượt: `npm test` → `ℹ fail 0`; `npx tsc --noEmit -p tsconfig.json` → không in gì; `npm run test:tools` → chỉ 2 lỗi cũ `test_character_metadata_regression` (`FAILED (failures=2)`), không lỗi nào ở `test_build_gallery_data` / `test_publish_gallery`; `npm run build` → `prerender: … pages`.

- [ ] **Step 2: Ảnh cục bộ** — `python tools/publish_gallery.py --stage .asset-publish-tmp/gallery-stage` (vài phút) → `staged → …: 2448 objects (… MB), unchanged 0, missing png 0`. Rồi `python tools/build_gallery_data.py --base /.asset-publish-tmp/gallery-stage` → `816 ảnh, …`.

- [ ] **Step 3: Máy tính 1440 px** — `npm run dev` (nền), Playwright `http://localhost:5173/gallery` (viewport 1440×900). Kiểm và chụp ảnh gửi chủ dự án:
  - Ảnh nhỏ hiện; tab có gạch chân vàng trượt; CG truyện mặc định "Bản 3.x" + bản mới nhất; không có câu mô tả; không hộp xám quanh lưới.
  - Trang đứng yên, chỉ vùng ảnh cuộn: `browser_evaluate` →
    ```js
    (() => { const s = document.querySelector('.ga-scroll'), t = document.querySelector('.ga-tabs');
      const y0 = t.getBoundingClientRect().top; s.scrollTop = 800;
      return { scrolls: s.scrollHeight > s.clientHeight, tabsStill: t.getBoundingClientRect().top === y0,
               viewFits: document.querySelector('#gallery-view').scrollHeight <= innerHeight + 1 }; })()
    ```
    Expected: `{ scrolls: true, tabsStill: true, viewFits: true }`.
  - Bấm một ô CG truyện: tiến trình (nếu chậm) → tấm phủ trên nền tối, rail vẫn thấy mờ; ảnh nét ngay. Ô không xê dịch:
    ```js
    (async () => { const t = document.querySelector('.ga-tile[data-n="3"]'); const a = t.getBoundingClientRect();
      t.click(); await new Promise((r) => setTimeout(r, 1500)); const b = t.getBoundingClientRect();
      return [a.x === b.x, a.y === b.y, a.width === b.width, location.search.includes('id=')]; })()
    ```
    Expected: `[true, true, true, true]`.
  - Network: đúng **1** request `v.webp` sau một lần bấm (không tải trước ô bên cạnh / bản khác). ← / → đổi nội dung tấm; Esc đóng, focus về ô; Back (browser_navigate_back) sau khi mở → tấm đóng, URL hết `id=`, vẫn ở `/gallery`.
  - Nhóm ảnh gần giống: chưa có `variants` → không ô nào có huy hiệu (đúng; Task 10 bật). Tạm kiểm giao diện nhóm bằng cách tạo `tools/gallery_variants.json` = `[["story", ["<id1>", "<id2>"]]]` với hai id có thật cùng một bản, build lại với `--base`, thấy huy hiệu 2, dải bản trong tấm, chọn bản 2 → tiến trình trên khung lớn rồi đổi ảnh, "Bản 2 / 2"; **xoá file đó ngay sau khi kiểm**.
  - Tab Hình nền sảnh / KV: bấm ô → thẳng toàn màn hình, thanh trên có tên · n / N · nút tải chỉ biểu tượng (tooltip "Tải ảnh") · ✕; ‹ › đi qua cả tab.
  - Nút "Tải ảnh" trỏ `…/o.png` và có thuộc tính `download`.
  - Bấm nhanh hai ô khác nhau (Review Focus 1, giả lập mạng chậm bằng `browser_run_code` `page.route('**/v.webp', r => setTimeout(() => r.continue(), 1500))`): chỉ ô thứ hai mở, ô thứ nhất hết tiến trình.
  - Tìm "lai co" khi đang ở Bản 3.x → ra CG chương Lai Cổ; hàng nhóm / bản không mục nào được nhấn; "Xóa tìm kiếm" trả lại.
  - Link `http://localhost:5173/gallery?kind=story&id=<một id chương chính>` → mở đúng ảnh, hàng nhóm sáng "Chính tuyến".
  - Đổi CN (`?lang=cn`): chữ giao diện đổi; tên chưa dịch không có chấm.
- [ ] **Step 4: Điện thoại 375×812** — `browser_resize`: cả trang cuộn; lưới 2 cột; mở ô → tờ toàn màn hình nền đặc, ✕ ở thanh trên cố định; vuốt ngang đổi bản; trong lúc tờ mở `document.scrollingElement.scrollTop` không đổi khi cuộn (Review Focus 4); Back → tờ đóng, vẫn ở trang; không cuộn ngang trang (`document.documentElement.scrollWidth <= 375`).
- [ ] **Step 5: Giảm chuyển động** — `browser_emulate_media` `reducedMotion: 'reduce'`: mở / đóng không bay, không mờ; tiến trình không chạy vạch.
- [ ] **Step 6: Fetch bị chặn (Review Focus 2)** — `python -m http.server 8769 --bind 127.0.0.1 --directory .asset-publish-tmp/gallery-stage` (nền), `python tools/build_gallery_data.py --base http://127.0.0.1:8769`, tải lại trang, bấm ô: ảnh vẫn mở (không có `Access-Control-Allow-Origin` → nhánh `<img>`), tiến trình chỉ "Đang tải…", không báo lỗi. Tắt máy chủ.
- [ ] **Step 7: Trả `gallery.json` về R2** — `python tools/build_gallery_data.py` → rồi `python -c "import json;print(json.load(open('public/gallery.json',encoding='utf-8'))['asset_base_url'])"` → bắt đầu bằng `https://pub-`. `tools/gallery_variants.json` không tồn tại. Dừng `npm run dev`.
- [ ] **Step 8: Rà soát** — `ponytail:ponytail-review` và `superpowers:requesting-code-review` trên toàn bộ thay đổi (`git diff` + file mới); sửa điểm xác nhận được (test hỏng trước với lỗi logic); chạy lại Step 1.
- [ ] **Step 9: Báo chủ dự án** (tiếng Việt): ảnh chụp 1440 / 375, kết quả đo, danh sách file, các phán quyết ở đầu kế hoạch, việc chờ duyệt ở Task 10. Owner approval required, do not commit.

---

### Task 10: Chờ chủ dự án duyệt — nhóm ảnh, câu thơ, R2, thẻ Thông tin, commit

Mỗi bước dưới chỉ làm khi chủ dự án đã nói rõ "đồng ý" cho **đúng bước đó** trong chat.

**Files:**
- Create (sau duyệt): `tools/gallery_variants.json`
- Modify (sau duyệt): `tools/gallery_vi.json` (câu thơ chủ dự án sửa), `public/gallery.json`, `src/features/info/InfoPage.tsx`, `src/features/info/styles/info.css`

- [ ] **Step 1: Nhóm ảnh gần giống** — chủ dự án xem tờ ảnh 102 nhóm / 245 ảnh (`design-demos/gallery-variants.js`, ảnh `shots/`) và bỏ / sửa nhóm. Sau "đồng ý": `node -e "global.window={};require('./docs/public-redesign/gallery/design-demos/gallery-variants.js');require('fs').writeFileSync('tools/gallery_variants.json',JSON.stringify(window.GALLERY_VARIANTS,null,1))"`, áp các chỉnh sửa của chủ dự án, `python tools/build_gallery_data.py` → `… 816 ảnh, <102 hoặc ít hơn> nhóm gần giống, …`.
- [ ] **Step 2: Câu thơ** — áp các sửa của chủ dự án trong `docs/gallery-poems-review.md` vào `tools/gallery_vi.json`; build lại → `chưa dịch 0`.
- [ ] **Step 3: Đẩy R2** (chủ dự án duyệt; nói rõ: 2448 object, ≤ 1,5 GB, bucket công khai hiện tại, ghi đè được bằng `--force`) — `python tools/publish_gallery.py` → `uploaded: 2448 objects (… MB), unchanged 0, missing png 0`. Chạy lại lần hai → `uploaded: 0 objects …, unchanged 2448` (chứng minh bỏ qua file không đổi).
- [ ] **Step 4: Kiểm header R2** — `curl -sI "https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/gallery/kv/2301/o.png" -H "Origin: https://whmxsite.vercel.app"` → `content-type: image/png`, `content-disposition: attachment; filename="kv_2301.png"`, có `access-control-allow-origin` (thiếu → báo chủ dự án bật CORS theo `2026-09-24-lore-pipeline-design.md` §12 bước 3; trang vẫn chạy, chỉ mất %). `curl -sI …/gallery/kv/2301/v.webp` → `content-length` có giá trị.
- [ ] **Step 5: Thẻ ở trang Thông tin** (chủ dự án duyệt) — trong `InfoPage.tsx` thêm import `import { loadGalleryCached, thumbUrl, type GalleryDoc } from '../gallery/galleryData.mts';`, component:
  ```tsx
  // three images of the Thư viện ảnh (the KV tab: wide art reads well at card size)
  function GalleryArt() {
    const [doc, setDoc] = useState<GalleryDoc | null>(null);
    useEffect(() => { void loadGalleryCached().then(setDoc); }, []);
    const pics = doc?.items.filter((x) => x.kind === 'kv').slice(0, 3) ?? [];
    return <span className="info-gallery">{pics.map((x) => <img key={x.id} src={thumbUrl(doc!, x)} alt="" loading="lazy" />)}</span>;
  }
  ```
  và mục trong `tiles`, ngay sau Âm nhạc: `{ href: '/gallery', name: s('gaTitle'), desc: s('ifGalleryDesc'), art: <GalleryArt /> },`. Trong `info.css`:
  ```css
  .info-gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: 100%; padding: 0 16px; }
  .info-gallery img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; }
  ```
  Playwright `/info` 1440 + 390: thẻ cao bằng thẻ Âm nhạc, không tràn; chỉ chỉnh hai luật CSS này nếu lệch. `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run build` → xanh.
- [ ] **Step 6: Kiểm lần cuối trên ảnh R2** — `npm run dev`, `/gallery`: ảnh từ `pub-…r2.dev`; bấm ô → `%` chạy (CORS có) hoặc "Đang tải…" (CORS chưa có); "Tải ảnh" lưu file `story_<id>.png`, không mở tab.
- [ ] **Step 7: Commit** — chỉ khi chủ dự án nói commit; chủ dự án tự chọn gom file (lưu ý `strings.mts`, `src/features/music/*`, `infoView.js`, `localization_master.xlsx` đang có sửa đổi riêng của chủ dự án — không gom chung trừ khi được bảo).
