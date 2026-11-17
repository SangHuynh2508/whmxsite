# Thư viện ảnh (`/gallery`): ảnh game phân loại theo bảng dữ liệu, xem to và tải gốc

Ngày: 2026-11-17 · Trạng thái: **chờ chủ dự án duyệt spec (bản sửa sau thiết kế D)** · Kế hoạch: `../plans/2026-11-17-gallery-data.md` (dữ liệu, đã làm), `../plans/2026-11-17-gallery-page.md` (trang) · Liên quan: `2026-11-08-music-page-design.md` (cùng kiểu đường dữ liệu), `2026-11-09-seo-path-urls-design.md` (URL không `#`)

## Mục tiêu

Người xem tìm được ảnh nền / CG của game **theo loại** mà không phải lọc theo kích thước rồi đoán. Xem ảnh to, tải **png gốc**.

Cách phân loại: **theo bảng game nào dùng tới ảnh**, không theo tên file hay kích thước. Ảnh nằm trong `collectCGs` chắc chắn là CG màn hình chờ. Không suy nghĩa game từ ID / tên khi thiếu bằng chứng (AGENTS.md "WHMX evidence rule").

Ngoài phạm vi (bản sau): poster / truyện tranh từ Weibo, Bilibili (phải gắn nhãn tay, sẽ là một mục admin riêng); video; ảnh trang phục và banner (đã có trang riêng, chỉ đặt link).

## Quyết định (chủ dự án, 2026-11-17)

Ghi theo thứ tự; dòng sau sửa dòng trước thì dòng trước vẫn giữ để biết lịch sử.

- **Đường dẫn** `/gallery` (không `#`, `#` chỉ còn ở admin). Thẻ mới trong trang Thông tin, cạnh Âm nhạc. Tên: VI "Thư viện ảnh", CN "画廊".
- **Đường dẫn, bổ sung** (nguyên văn: "chuyển sang skins và nhường lại gallery"): trang Trang phục (hôm nay ở `/gallery` và `/skins`) chuyển hẳn sang **`/skins`**; `/gallery` thành Thư viện ảnh. Cách xử lý ở mục "Đổi đường dẫn".
- **Không có tab "Mới cập nhật".**
- Loại nào game **không gắn phiên bản** → để chung một lưới. **CG truyện** chia theo phiên bản kiểu UTTU (hàng nhóm + hàng bản).
- **Chữ đi kèm ít** (đo 2026-11-17, r3173) → **AI dịch** bằng `.agents/skills/game-translator` (chủ dự án cho phép AI dịch chữ nhỏ của thư viện ảnh, khác với chữ admin / DB do chủ dự án tự dịch); 33 câu thơ bưu thiếp đánh dấu để chủ dự án xem lại (`docs/gallery-poems-review.md`).
- **Giao diện**: `huashu-design` làm 3 hướng demo thật → `impeccable` chấm cả 3 → chủ dự án chốt → `docs/public-redesign/gallery/direction-approved.md`.
- **Giao diện, kết quả**: A / B / C bị từ chối; chủ dự án chỉ tham khảo UTTU (`uttu.merui.net/gallery/`) → demo **D** (`design-demos/D-kho-khoanh-khac.html`), mở ảnh **kiểu "C · Lớp phủ"** (nguyên văn: "à mà t chọn C nhé"), sửa qua 7 vòng. Chi tiết ở mục "Trang công khai"; lời chủ dự án từng vòng ở `direction-approved.md`.
- **Ảnh gần giống nhau** (nguyên văn: "đối với các ảnh giống nhau(khác vài chi tiết) thì họ sẽ gộp chung và chỉ khi mở 1 ảnh đại diện lên thì mới thấy các ảnh khác") → gộp thành một ô; danh sách nhóm chỉ thành dữ liệu **sau khi chủ dự án duyệt** (mục "Nhóm ảnh gần giống").
- **Đẩy R2** chỉ khi chủ dự án duyệt rõ ràng; trước đó chỉ chạy thử (`--dry-run`, `--stage`).

## Các loại ảnh (bản đầu)

| Loại (`kind`) | Nguồn (masterdata r3173) | Số ảnh trong `gallery.json` (r3173) | Ảnh | Chữ đi kèm | Phiên bản |
|---|---|---|---|---|---|
| `loading` CG màn hình chờ | `collectCGs` | 139 (151 dòng bảng) | `pathCG` (ảnh nhỏ game: `headPathCG`) | `nameCGLanText` (≤6 chữ), `sourceTipLanText` (51 câu khác nhau, ≤24 chữ) | không, để chung |
| `home` Hình nền sảnh | `BGSwitchMap` | 16 | `Image` (vd `ui_home_bj_di`) | `NameLanText` (≤4 chữ) | không, để chung |
| `postcard` Bưu thiếp du lịch | `TravelPostcardMap` | 33 | `SetContent1` (vd `ui_lx_lxwl_mxp7`) | `SetContent4LanText` địa danh, `SetContent2LanText` câu thơ (`;` = xuống dòng) | không, để chung |
| `story` CG truyện | lore (`whmx.py cg`, INDEX.tsv) | 600 | `cg_*` của truyện | tên truyện / sự kiện (phần lớn đã có VI) | **có** (xem dưới) |
| `kv` KV phiên bản | `ui_kv<ver>` | 28 (47 bundle đếm 2026-09-30) | ảnh KV | tên phiên bản (chỉ mã dạng `ui_kv<d><d>0<1\|2>`; mã khác để trống tên) | chính là phiên bản |

`cgTips` **không** phải mô tả ảnh (là mẹo gameplay lúc loading) → bỏ.

Mục không tìm thấy ảnh trong bản xuất → bỏ khỏi `gallery.json`, in ra danh sách thiếu (không hỏng build).

### Phiên bản của CG truyện

Dùng lại `load_versions` / `version_of` của `tools/build_music_data.py` (`activityGroup.startTimeUnix` so với `ActivityVersionMap`, nhãn kiểu "3.4上"):
- CG của **sự kiện** → bản của lần đầu sự kiện mở. Bảng chỉ có từ **2.5** → sự kiện cũ hơn hoặc không xác định được ngày vào nhóm `old` ("Trước 2.5"), hàng con là tên sự kiện; sự kiện không tên (e005) → "未知活动".
- CG **cốt truyện chính** → nhóm "Chính tuyến", hàng dưới là chương.
- Còn lại (truyện nhân vật, phụ) → nhóm "Khác".

Một CG dùng ở nhiều truyện → xếp theo truyện **đầu tiên** dùng nó (giống quy tắc thư mục của `build_cg`).

### Tên truyện của CG (`story_cn` / `story_vi`)

CG truyện thuộc nhóm phiên bản (`v3`, `v2`) chỉ mang nhãn bản ("3.4上"), nên tên duy nhất có thể là "Bản 3.4 Thượng". Demo D gọi CG theo **truyện / sự kiện nó mở ra**: `story_cn` = `GROUP_NAME_CN` của kịch bản đầu tiên dùng CG đó (INDEX.tsv, qua INDEX.json `group_cn`), làm gọn như `sub` (bỏ "(…)" của chương, tên truyện nhân vật lấy phần trước " — "); sự kiện không có tên trong lore → `EVENT_CN` của `build_music_data.py`, không có nữa thì để trống (không bịa). `story_vi` dịch qua `gallery_vi.json` như các chữ khác. Chỉ loại `story` có; loại khác để rỗng.

### Nhóm ảnh gần giống (`variants`)

Ảnh cùng cảnh, khác vài chi tiết (vd nữ / nam `…sexf` / `…sexm`, cùng CG thêm vật) hiện **một ô** có huy hiệu "lớp" + số bản; mở ô mới thấy các bản.

- Nguồn: so điểm ảnh trên ảnh nhỏ, cùng `kind`: dHash 16×16 ≤ 40 bit và chênh xám trung bình ≤ 10, hoặc ≥ 55 % ô màu không phẳng giống nhau (ô tối / trắng ở cả hai ảnh bỏ qua). Xem bằng mắt trên tờ ảnh: **102 nhóm, 245 ảnh** (story 98, loading 4), ở `docs/public-redesign/gallery/design-demos/gallery-variants.js`. Chuỗi máy quay lia (vd `cg_boshanpv_02` → `_5`) **không** gộp.
- Đây là bằng chứng hình ảnh, không phải nghĩa game: không gắn nhãn "bản gốc / bản đổi", chỉ "Bản 1 / 2 …"; ảnh đầu nhóm là ảnh xuất hiện trước trong `gallery.json`.
- Thành dữ liệu **chỉ sau khi chủ dự án duyệt danh sách**: duyệt xong → `tools/gallery_variants.json`; build ghép vào `gallery.json`. Chưa có file → mỗi ảnh một ô (trang vẫn chạy).

## Dữ liệu và đường đi

Giống trang Âm nhạc: không DB, không admin.

1. `tools/build_gallery_data.py` (**đã có**, chạy được, 10 test): đọc INDEX.json của bản xuất `WHMX_Tool/Xuat/Gallery_r*` (rút bằng `whmx.py gallery`), masterdata (phiên bản), `tools/gallery_vi.json` → ghi `public/gallery.json`. Còn thiếu: `story_cn/story_vi`, `variants`, cờ `--base` (thử cục bộ).
2. `tools/publish_gallery.py` (**chưa có trong repo**, viết ở kế hoạch trang): đẩy lên R2 `gallery/<kind>/<id>/` ba bản: `t.webp` ảnh nhỏ (rộng 480), `v.webp` ảnh xem (giữ kích thước, q≈90), `o.png` gốc. `o.png` gửi kèm `Content-Disposition: attachment; filename="<kind>_<id>.png"` (thuộc tính `download` của `<a>` bị trình duyệt bỏ qua khi khác origin, R2 khác origin với web). Bỏ qua file không đổi bằng metadata `source-sha256` như `publish_music.py`. Dùng chung `publish_assets.py` (env, client). `--dry-run` chỉ đếm; `--stage <thư mục>` ghi y hệt bố cục R2 ra đĩa để thử trang cục bộ; không cờ = đẩy thật (**chờ chủ dự án duyệt**).
3. Bản dịch VI: `tools/gallery_vi.json` (cn → vi) do AI dịch, build ghép vào. Chuỗi chưa có VI → hiện CN kèm chấm xám "chưa dịch" như trang Âm nhạc.
4. Ảnh trên web **luôn** lấy từ R2 qua `asset_base_url` (= `asset_base_url` của `public/data.json`). `--base` chỉ dùng khi thử cục bộ; `gallery.json` có base khác R2 thì không được commit.

```
gallery.json = { version, asset_base_url, items: [
  { id, kind, file: "gallery/<kind>/<id>",  w, h,
    name_cn, name_vi, note_cn, note_vi,      // note: cách nhận (loading) / câu thơ (postcard)
    place_cn, place_vi,                       // postcard
    group, sub_cn, sub_vi,                    // story: group "v3" | "v2" | "old" | "main" | "other"; sub = "3.4上" (v*), tên sự kiện (old), chương (main), tên nhóm (other)
    story_cn, story_vi                        // story: truyện / sự kiện CG mở ra; loại khác ""
  } ],
  variants: [ [kind, [id, id, …]], … ] }     // nhóm ảnh gần giống đã duyệt, id đầu = ô đại diện; [] khi chưa duyệt
```

Ước tính R2: dưới 1,5 GB (gói free 10 GB; bản xuất r3173 = 1,4 GB png).

## Đổi đường dẫn: Trang phục → `/skins` (2026-11-17)

- Trang Trang phục: đường dẫn chuẩn **`/skins`**; tên view trong router đổi `gallery` → `skins` (để `gallery` là Thư viện ảnh, khỏi lẫn). Mục "Trang Phục" trên thanh điều hướng trỏ `/skins`, sáng ở `skins` và `skin-detail`. Nút "quay lại" của trang chi tiết trang phục trỏ `/skins`. `/skins/<id>` giữ nguyên.
- Bí danh cũ `/gallery-demo` (và `#/gallery-demo`) → chuyển tới **`/skins`** (nó là bí danh của trang trang phục).
- `/gallery` → Thư viện ảnh. **Không** chuyển hướng `/gallery` cũ sang `/skins`: trang trang phục chưa bao giờ ghi tham số vào URL (ô tìm chỉ nằm trong bộ nhớ trang), nên không có link `/gallery?…` kiểu trang phục nào cần giữ; tham số lạ trên `/gallery` → về mặc định. Người mở link `/gallery` cũ để xem trang phục đi tiếp bằng mục "Trang Phục" trên thanh điều hướng hoặc link "Trang phục" cuối trang.
- SEO: prerender thêm `/skins` ("Trang phục"); `/gallery` đổi tiêu đề / mô tả thành Thư viện ảnh; sitemap tự theo danh sách trang. Tiêu đề tab (`pageMeta.mts`): `skins` → "Trang phục", `gallery` → "Thư viện ảnh". Nhãn báo lỗi (`reportIssue.js`) theo tên view mới.

## Trang công khai (thiết kế D, mở kiểu "C · Lớp phủ")

Tham chiếu hình và hành vi: `docs/public-redesign/gallery/design-demos/D-kho-khoanh-khac.html` (+ `gallery-common.js`, ảnh `shots/D*`). Bản thật: React + TS, chỉ token của `src/styles/tokens.css`, đăng ký `gallery` trong `staticRoutes.mts`, chuỗi trong `strings.mts` (vi + cn; nhãn CN là nháp, không coi là thuật ngữ game).

**Đầu trang và bộ lọc** (không có thẻ / hộp xám nào bao quanh, mọi thứ nằm thẳng trên nền trang):
- Tiêu đề "Thư viện ảnh" và ô tìm cùng một hàng; **không có câu mô tả** dưới tiêu đề (vòng 7).
- Tab theo loại (CG truyện · Màn hình chờ · Hình nền sảnh · KV phiên bản · Bưu thiếp, kèm số ảnh), **gạch chân vàng** trượt theo tab.
- Riêng CG truyện: **hàng nhóm** (Bản 3.x · Bản 2.x · Trước 2.5 · Chính tuyến · Khác) chữ thường 15 px, nhóm đang chọn màu xương + đậm; dưới là **hàng bản / chương / truyện** 13 px, mục đang chọn gạch chân vàng; một đường mảnh khép cặp hàng. Không ô, không dải màu, không số đếm trong hàng (vòng 3). Nhóm phiên bản mở ở bản mới nhất; nhóm khác mở ở "Tất cả".
- Số ảnh đang hiện ở cuối hàng nhóm (ẩn trên điện thoại).
- Ô tìm (tên, địa danh, truyện, nhãn bản; không phân biệt dấu tiếng Việt) tìm **trong cả loại đang chọn**, bỏ qua hàng nhóm / bản trong lúc tìm.
- Trạng thái nằm trên URL để chia sẻ: `/gallery?kind=story&g=v3&v=3.4上&q=…&id=<id>`. Đổi tab / nhóm / bản / tìm: thay URL tại chỗ (không thêm lịch sử). Link có `id` mà thiếu `g` / `v` vẫn mở đúng ảnh (tự chọn nhóm / bản của ảnh).

**Lưới:** ảnh nhỏ `t.webp`, `loading="lazy"`, ô giữ tỉ lệ thật (`w`/`h`), lưới dày (5 cột ≥ 1101 px, 3 cột ≤ 1100, 2 cột trên điện thoại; bưu thiếp 8 / 5 / 3). Tên hiện khi rê chuột (điện thoại không hiện, đọc trong tấm mở). Nhóm ảnh gần giống = một ô + huy hiệu "lớp" kèm số bản.

**Mở ảnh:**
- **CG truyện / Màn hình chờ / Bưu thiếp**: mở **tấm phủ lên trang** trên nền `--scrim` (đen 60 %): trang và thanh menu vẫn thấy, tối hơn. Tấm gồm ảnh to · dải các bản (nếu có nhóm) · thông tin (tên, câu thơ với bưu thiếp, Loại, Nằm trong, Cách nhận, Bản n / N, Kích thước, Mã) · nút vàng **"Tải ảnh"**. Bấm ảnh to → toàn màn hình. ← / → chuyển sang ô bên cạnh, nội dung tấm đổi tại chỗ.
- **Hình nền sảnh / KV** (không có bản trùng): ô mở **thẳng toàn màn hình**; thanh trên = tên · n / N · **nút tải chỉ có biểu tượng** (nhãn đọc màn hình / tooltip "Tải ảnh") · ✕. ‹ › và vuốt đi qua cả tab.
- **Tải ảnh to:** chỉ tải ảnh được bấm; bản khác trong nhóm tải khi được chọn. Tải bằng luồng + `content-length` → hiện **%** (đường vàng chạy dưới đáy + số ở giữa ô, chỉ hiện nếu chờ quá 120 ms); không có độ dài → "Đang tải…" với vạch chạy. Ảnh **chỉ hiện khi đã tải xong và giải mã**, sắc nét ngay; **không** hiện ảnh nhỏ mờ rồi nét dần. R2 chặn fetch (CORS) → vẫn tải bằng `<img>`, chỉ mất phần trăm. Lỗi → báo lỗi, nút "Tải ảnh" vẫn dùng được.
- **Chuyển động:** chỉ ảnh di chuyển (bay từ khung của ô — không phải ảnh đang phóng 1.04 khi rê — tới chỗ của nó), tấm chỉ mờ dần hiện, không trượt; `scrollbar-gutter: stable` để khoá cuộn không làm trang dịch. Đo: ô không xê dịch khi mở; khung ảnh trùng khít ở đầu và cuối đường bay. GSAP, dùng lại `motion.ts`; giảm chuyển động → không bay, không mờ.
- Esc đóng lớp trên cùng; Tab chỉ đi trong lớp đang mở; mở ảnh thêm một mục lịch sử (nút Back trên điện thoại đóng ảnh), đóng bằng ✕ / Esc thì quay lại mục đó.

**Cuộn:**
- Máy tính (≥ 769 px): trang **đứng yên**; tiêu đề, ô tìm, tab, hàng nhóm / bản cố định, **chỉ vùng ảnh cuộn** dưới chúng (thanh cuộn mảnh, `overscroll-behavior: contain`). Đổi tab / nhóm / bản → vùng ảnh về đầu.
- Điện thoại: **cuộn cả trang** như thường (nguyên văn: "Giữ cuộn cả trang"); tấm mở thành tờ toàn màn hình nền đặc.

**Cuối vùng ảnh:** "Ảnh trang phục và banner có trang riêng:" + link Trang phục (`/skins`) và Banner (`/banners`).

## Lỗi và biên

- `gallery.json` không tải được → báo lỗi + nút thử lại.
- Ảnh nhỏ lỗi → ô giữ chỗ "Không tải được ảnh", không vỡ lưới; ảnh to lỗi → báo lỗi trong khung, vẫn cho "Tải ảnh".
- Tìm không ra → thông báo + nút xoá tìm.
- Tham số `kind` / `g` / `v` / `id` sai → về mặc định, không lỗi trắng trang; `id` thuộc loại khác bị bỏ.
- Bấm ô khác khi ảnh trước chưa tải xong → ảnh trước bị bỏ, chỉ mở ảnh mới.
- Tên KV là nhãn bản ("2.5下") → hiện "KV 2.5 Hạ", không đánh dấu "chưa dịch".

## Kiểm thử

- Python (`tools/test_build_gallery_data.py`): mỗi loại đọc đúng trường; mục thiếu ảnh bị bỏ và được liệt kê; nhóm phiên bản CG truyện (sự kiện ≥2.5, trước 2.5, chính tuyến, khác); CG nhiều truyện lấy truyện đầu; ghép VI; `story_cn/story_vi`; `variants` (bỏ id không có, bỏ nhóm còn 1 ảnh, báo id nằm hai nhóm).
- `tools/test_publish_gallery.py`: khoá object R2 và ba bản ảnh (kích thước); khoá không an toàn bị chặn; `o.png` có `Content-Disposition`; `--stage` ghi đúng bố cục; bỏ qua file không đổi.
- TS unit: lọc theo loại / nhóm / bản / tìm (gộp dấu); đọc và ghi query (kể cả link chỉ có `id`); gộp nhóm ảnh; tên ảnh; tải ảnh có tiến trình, bộ nhớ đệm, lỗi.
- Router: `/skins`, `/gallery`, `/gallery-demo` → `/skins`, tiêu đề tab, prerender.
- Playwright: `/gallery` 1440 px và 375 px, VI và CN: đổi tab / nhóm / bản, tìm, mở tấm và toàn màn hình, ← / →, Esc, Back, nút tải trỏ `o.png`; đo ô không xê dịch khi mở; máy tính chỉ vùng ảnh cuộn; giảm chuyển động.

## Thứ tự làm

1. ~~`build_gallery_data.py` + test, xuất thử `gallery.json`~~ (xong: 816 ảnh r3173).
2. ~~Dịch VI (`gallery_vi.json`), đánh dấu câu thơ~~ (xong; 33 câu thơ chờ chủ dự án xem).
3. ~~huashu-design → impeccable → chủ dự án chốt~~ (xong: D, mở kiểu C, 7 vòng).
4. Kế hoạch `2026-11-17-gallery-page.md`: trường dữ liệu (`story_cn/vi`, `variants`) → chuyển Trang phục sang `/skins` → trang React → `publish_gallery.py` (chỉ chạy thử) → kiểm tra.
5. **Chờ chủ dự án duyệt**: danh sách nhóm ảnh gần giống, câu thơ, đẩy R2, bật thẻ ở trang Thông tin, commit.
