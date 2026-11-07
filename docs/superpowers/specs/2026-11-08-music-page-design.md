# Trang Âm nhạc (BGM) — design

Ngày: 2026-11-08 · Trạng thái: chờ chủ dự án duyệt spec

## 1. Mục tiêu

Web là wiki lưu trữ. Trang **Âm nhạc** liệt kê toàn bộ nhạc nền của game, mỗi bài có tên, ảnh bìa và chỗ được dùng
(máy hát căn cứ, cốt truyện, màn đánh, khu vực bản đồ), và nghe được ngay trên web.

Thành công khi: vào `#/music` thấy đủ 259 bài chia nhóm, tìm được theo tên/mã, bấm một bài thì nghe được; trang không tải
file nhạc nào trước khi người xem chọn bài; không cuộn ngang ở 390 px.

## 2. Quyết định đã chốt (chủ dự án, 2026-11-08: "tất cả theo đề xuất")

| # | Quyết định |
|---|---|
| 1 | Đăng **cả 259 bài**; bài không rõ chỗ dùng vào nhóm "Khác" |
| 2 | 38 bài có tên chính thức hiển thị tên CN. 221 bài còn lại: **nhãn tự sinh theo chỗ dùng** + mã file. Có chỗ cho tên VI (chủ dự án tự dịch, §5) |
| 3 | **Trang riêng** `#/music`, có mục trên thanh menu |
| 4 | Nhóm: **Máy hát căn cứ / Cốt truyện / Màn đánh / Khu vực / Khác**, có ô tìm kiếm |
| 5 | **Trình phát (chỉnh theo chủ dự án):** trang là kho lưu trữ, **lúc vào không có thanh phát cố định**. Chỉ khi người xem bấm một bài mới mở phần nghe — **trang chi tiết riêng hay popup: chốt ở bước thiết kế (huashu)**. Rời trang nhạc thì nhạc dừng |
| 6 | **mp3 160 kbps** giữ nguyên (697 MB), mọi `<audio>` đặt `preload="none"` |
| 7 | 40 ảnh bìa → webp, lên R2; bài không bìa dùng một ảnh mặc định |
| 8 | Dữ liệu trang: **`public/music.json`** trong git, gọn (thực tế ~97 KB, ~9 KB khi gzip) |
| 9 | Chỗ dùng chỉ hiện tên sự kiện/chương/màn, **chưa link** sang lore |
| 10 | Giao diện: **huashu-design 3 hướng**, chủ dự án chọn; chữ giao diện VI + CN; GSAP nhẹ khi đổi nhóm / mở bài, có đường reduced-motion |

## 3. Nguồn dữ liệu

`WHMX_Tool` lệnh `python whmx.py bgm` (đã có, chưa push) xuất ra `WHMX_Tool/Xuat/Audio/bgm/`:
`*.mp3` (259), `bia/*.png` (40) và `bgm_index.json`:

```json
{"version": "r3168", "tracks": [
  {"file": "novel_E2202.mp3",
   "jukebox": [{"id": "20106", "name": "春华如梦", "cover": "bia/ui_jj_yy_pic_cd_26.png",
                "source": "通过【人间千古】活动获取", "unlock_item": "71014", "default": false}],
   "stories": ["e022002", "e027004"],
   "stages": [{"id": "AA100001", "name": "远击的进阶：子"}],
   "areas": [{"id": "abyss1", "name": "裂隙"}]}]}
```

Tên nhóm truyện (sự kiện/chương) lấy từ `WHMX_Lore_By_Chapter/INDEX.tsv` (cột `GROUP_NAME_CN`, `SCRIPT_ID`).

## 4. `public/music.json` (đầu ra của tool mới)

```json
{"version": "r3168",
 "tracks": [
  {"id": "novel_e2202",                 // tên file viết thường, không đuôi — khoá ổn định, dùng trong URL
   "file": "music/bgm/novel_e2202.mp3", // khoá R2
   "cover": "music/covers/ui_jj_yy_pic_cd_26.webp",   // null → ảnh mặc định
   "group": "jukebox",                  // jukebox | story | stage | area | other (nhóm chính, theo thứ tự ưu tiên này)
   "groups": ["jukebox", "story"],      // mọi nhóm bài có mặt — bộ lọc dùng trường này
   "name_cn": "春华如梦",                // tên chính thức; "" khi không có
   "name_vi": "",                       // từ localization/music_names_vi.json
   "label_kind": "",                    // "" | story | stage | area — loại nhãn tự sinh (§5); giao diện thêm tiền tố
   "label_cn": "",                      // phần tên của nhãn tự sinh, CN
   "source_cn": "通过【人间千古】活动获取",
   "stories": [{"group_cn": "人间千古", "count": 5}],   // gom theo nhóm truyện, tối đa 5 nhóm
   "stories_total": 8,                  // tổng số kịch bản dùng bài
   "stages":  {"names_cn": ["远击的进阶：子", "…"], "count": 12},   // tối đa 3 tên + tổng
   "areas_cn": ["裂隙", "粤州"]}
 ]}
```

Một bài có thể thuộc nhiều nhóm; `group` là nhóm chính để xếp chỗ, còn các trường chỗ dùng vẫn liệt kê đủ.
Bộ lọc nhóm trên trang lọc theo **có mặt** (bài vừa có truyện vừa có màn đánh hiện ở cả hai bộ lọc).

## 5. Tên bài

- Có tên máy hát → `name_cn` (+ `name_vi` nếu đã dịch). Bỏ mục "预留位置" (ô trống trỏ lại `foundationMusic_1`).
- Không có tên → nhãn sinh theo chỗ dùng đầu tiên có: nhóm truyện đầu tiên (`label_kind` story, `label_cn` "人间千古"),
  hoặc màn đầu tiên (stage, "远击的进阶：子"), hoặc khu vực (area, "裂隙"); không có gì → chỉ mã file. Giao diện thêm
  tiền tố theo ngôn ngữ ("Truyện · 人间千古" / "剧情 · 人间千古"), phần tên giữ CN.
- `localization/music_names_vi.json`: `{ "<id>": "<tên VI>" }`, tool tạo sẵn đủ 38 khoá với giá trị rỗng; chủ dự án
  điền, chạy lại tool. Claude không điền bản dịch.

## 6. Tool `tools/build_music_data.py` + đẩy R2

- Đọc `bgm_index.json` + `INDEX.tsv` + `music_names_vi.json` → ghi `public/music.json`. Không mạng, chạy lại được.
- **Chạy trên máy chủ dự án, không chạy trên Vercel** (như `publish_assets.py` đọc `../NeoArtifacts`). WHMX_Tool là
  repo riêng nên đường dẫn là tham số: `--bgm` (mặc định `../WHMX_Tool/Xuat/Audio/bgm`) và `--lore-index` (mặc định
  `../WHMX_Lore_By_Chapter/INDEX.tsv`); thiếu file → báo rõ đường dẫn cần có rồi dừng. Vercel chỉ dùng
  `public/music.json` đã commit; mp3 và ảnh bìa không vào repo web.
- Đẩy file: dùng lại cách của `tools/publish_assets.py` / `publish_banner_art.py` (S3-compatible, env R2 sẵn có):
  `music/bgm/<id>.mp3` (Content-Type `audio/mpeg`, Cache-Control dài) và `music/covers/<icon>.webp`
  (webp q88 như ảnh khác). Có `--dry-run` liệt kê đối tượng + tổng dung lượng; **chỉ chạy thật khi chủ dự án đồng ý**.
- Tên khoá R2 viết thường để URL ổn định giữa các bản game.

## 7. Trang

- React + TS island, `src/features/music/`; route tĩnh `/music` trong `staticRoutes.mts`; mục nav mới trong `AppNav.tsx`
  (icon lucide, chọn ở bước thiết kế); chữ giao diện trong `src/i18n/strings.mts` (VI + CN).
- Tải `music.json` khi vào trang. Danh sách: bộ lọc nhóm + ô tìm (tên CN/VI, nhãn, mã). Mỗi dòng: bìa nhỏ, tên/nhãn,
  chỗ dùng tóm tắt. Không có `<audio>` nào trong danh sách.
- Bấm một bài → phần nghe (trang chi tiết `#/music/<id>` **hoặc** popup — chốt ở thiết kế). Phần nghe có `<audio
  preload="none" controls>` dùng nút gốc của trình duyệt hoặc nút riêng (chốt ở thiết kế), thông tin đầy đủ chỗ dùng,
  nguồn lấy bài. Chuyển bài trước/sau trong danh sách đang lọc: chốt ở thiết kế.
- Rời trang/đóng popup → dừng nhạc.
- Màu chỉ từ `src/styles/tokens.css`, dark-only; không cuộn ngang ở 390 px.

## 8. Lỗi và trường hợp biên

- `music.json` không tải được → thông báo lỗi kiểu trang khác (chuỗi i18n có sẵn nếu có).
- File nhạc lỗi/429 từ `r2.dev` → hiện "Không phát được bài này" trong phần nghe, không làm vỡ trang.
- Bài không bìa → ảnh mặc định. Tìm không ra → trạng thái rỗng.

## 9. Kiểm thử

- `tools/test_build_music_data.py`: nhóm chính theo thứ tự ưu tiên, nhãn tự sinh, cắt danh sách màn (3 + count),
  gom truyện theo nhóm, bỏ "预留位置", khoá viết thường, `name_vi` lấy từ file dịch.
- Test TS cho phần lọc/tìm thuần (kiểu `tierView.test.mts`) và route `/music`.
- Trình duyệt (Playwright): 1440 + 390 px, không cuộn ngang, không request mp3 nào trước khi bấm bài, bấm bài → phát
  được, reduced motion.

## 10. Ngoài phạm vi

Phát xuyên trang; link sang lore; lồng tiếng cốt truyện; nhạc minigame nhịp điệu (`rhythmgame_*`, `MusicSongs`);
Admin để sửa tên; tên miền riêng cho R2.

## 11. Cần chủ dự án đồng ý khi tới bước

Upload R2 (danh sách + dung lượng từ `--dry-run`); commit `public/music.json`; push/deploy.
