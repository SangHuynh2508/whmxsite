# Âm nhạc: bìa cho mọi bài, admin đăng nhạc ngoài game, so trùng bằng dấu vân âm thanh

Ngày: 2026-11-08 · Trạng thái: **đã chốt Q1–Q3, chờ đo ngưỡng (B4) rồi lên plan** · Liên quan: `docs/public-redesign/music/direction-approved.md`

## Mục tiêu

1. Không còn đĩa trống: 188/226 bài hiện chưa có bìa (chỉ 38 bài Máy hát có bìa CD của game).
2. Admin (không chỉ chủ dự án) đặt / gỡ bìa trên web, hiện ngay, không cần build lại.
3. Admin đăng nhạc ngoài game (PV, single trên Bilibili) lên trang Âm nhạc.
4. Chặn đăng trùng kể cả khi file khác nhau (khác định dạng, bitrate, bị cắt, to nhỏ khác) bằng dấu vân âm thanh.

Ngoài phạm vi: phát nhạc nền toàn site, playlist, bình luận, tải nhạc từ Bilibili trên máy chủ.

## Quyết định (chủ dự án, 2026-11-08)

- **Q1 · Nhạc ngoài game:** không lưu file. Lưu thông tin + link Bilibili + dấu vân; trang bài **nghe ngay trên web**
  bằng trình phát nhúng chính thức của Bilibili (`https://player.bilibili.com/player.html?bvid=<BV>&p=<n>&autoplay=0`,
  iframe, chỉ tải khi người xem bấm "Nghe"), kèm nút mở Bilibili. Dấu vân lấy từ file admin tải về máy, file không
  rời máy (trình duyệt chỉ gửi dấu vân).
- **Q2 · Không có bìa tự gán.** Chỉ admin gán thủ công, có khung căn chỉnh ảnh (kéo, phóng to, xem trước đĩa tròn).
- **Q3 · Không cần duyệt.** Mọi admin đăng được; công cụ so trùng là lớp chặn.

## Phần A — Bìa

**Thứ tự ưu tiên khi hiện đĩa**: bìa admin đặt → bìa CD gốc của game (Máy hát) → đĩa trống như hiện nay.

- Bìa admin: lưu ở DB (bảng `music_cover_override`), ảnh ở R2 qua luồng `api/admin/assets` hiện có
  (upload-intents → PUT presigned → finalize). Khung căn chỉnh (kéo, phóng to, xem trước dạng đĩa) rồi trình duyệt cắt vuông + xuất webp trước khi tải lên; tối đa 2 MB.
- Trang công khai đọc `public/music.json` (tĩnh) **và** một endpoint nhẹ `GET /api/music/overrides` (cache ngắn,
  `s-maxage=60`) rồi ghép. Endpoint lỗi → trang vẫn chạy với bìa tĩnh.

## Phần B — Nhạc ngoài game

**B1 · Công cụ trên máy (WHMX_Tool, không dính web)** — lệnh `python whmx.py bili <link>`:
1. `yt-dlp` (cài qua pip) tải phần tiếng; `imageio-ffmpeg` chuyển mp3 128 kbps. Không cần đăng nhập Bilibili.
2. Tính dấu vân Chromaprint (`fpcalc`, gói `pyacoustid` hoặc binary đi kèm) và so với kho cục bộ
   (`WHMX_Tool/Xuat/Audio/bgm` + các gói đã tạo trước). In 5 bài gần nhất kèm điểm.
3. Ghi gói `Xuat/Bili/<BV>/`: `track.mp3`, `meta.json` (tiêu đề gốc, link, BV, thời lượng, dấu vân, kết quả so).
Công cụ là tiện ích; admin không bắt buộc dùng nó (xem B3).

**B2 · Trang admin "Nhạc ngoài game"** (`/admin` mục mới, React + TS, token màu từ tokens.css):
- Chọn mp3 (hoặc gói từ B1) → trình duyệt tính dấu vân → gọi kiểm trùng (B3) → hiện kết quả.
- Điền: tên CN (bắt buộc), tên VI (tuỳ chọn, admin dịch), link nguồn (bắt buộc), gắn nhân vật / sự kiện (tuỳ chọn),
  bìa (dùng lại Phần A).
- Đăng → chỉ lưu thông tin + dấu vân (Q1); bắt buộc link Bilibili có BV hợp lệ.
- Sửa / ẩn / xoá mềm bài đã đăng. Mọi thao tác ghi người làm + thời điểm.

**B3 · So trùng bằng dấu vân âm thanh**
- Dấu vân: Chromaprint dạng mảng số nguyên 32-bit (khoảng 8 giá trị/giây).
- Tính ở trình duyệt khi admin chọn file: giải mã bằng WebAudio → mono 11025 Hz → Chromaprint chạy bằng WASM
  (thư viện cụ thể chọn ở bước plan, ưu tiên gói đã có bản build ổn định). Tính ở công cụ máy bằng `fpcalc`.
  Hai bên phải ra cùng định dạng — có test so một file mẫu ra cùng kết quả.
- Kho dấu vân: bảng `music_fingerprint` (một dòng mỗi bài: nhạc game tính sẵn một lần bằng script, nhạc ngoài game
  ghi khi đăng).
- So ở máy chủ `POST /api/admin/music/match`: trượt dấu vân mới trên từng bài, điểm = tỉ lệ bit giống nhau ở vị trí
  khớp tốt nhất (Hamming). Kho ~300 bài → so toàn bộ trong một request, không cần chỉ mục.
- Ngưỡng: ≥ 0,85 "trùng" (chặn, admin phải bấm xác nhận đăng vẫn được kèm lý do); 0,7–0,85 "giống" (cảnh báo);
  < 0,7 "bài mới". Đo thử 2026-11-08 (`fpcalc` 1.5.1): 坤厚载物 bản Bilibili so cả kho cao nhất 0,654 (không có trong game),
  cặp đối chứng cùng bài 0,939 → nâng mốc "giống" từ 0,6 lên 0,7. Vẫn chốt lại sau khi đo đủ 30 cặp (B4).
- Trùng byte (md5) chặn cứng, không cho xác nhận.

**B4 · Kiểm chứng ngưỡng trước khi làm UI**: chạy Chromaprint trên 30 cặp bài đã biết trùng (các nhóm `also` trong
music.json) và bài 坤厚载物 tải từ Bilibili với cả kho; ghi phân bố điểm vào spec này rồi mới chốt ngưỡng.

**Hiển thị công khai**: bài ngoài game có nhóm riêng "Ngoài game" (tab sau Khác, ẩn khi rỗng), nhãn
"Ngoài game · PV", link nguồn. Trang bài: nút "Nghe" mở trình phát nhúng Bilibili tại chỗ (thay trình phát mp3), kèm nút mở Bilibili.

## Dữ liệu (DB — cần chủ dự án duyệt migration)

```
music_cover_override(track_id text pk, asset_id → managed asset, set_by, set_at)
music_external_track(id text pk, name_cn, name_vi, source_url, bvid, duration_s,
                     asset_id null, character_ids text[], event_cn text null,
                     status 'published'|'hidden'|'deleted', created_by, created_at, updated_at)
music_fingerprint(track_id text pk, kind 'game'|'external', fp int[] , duration_s, md5)
```

## Lỗi và biên

- File không giải mã được / quá 20 MB / dài quá 15 phút → báo lỗi rõ, không gọi máy chủ.
- Dấu vân quá ngắn (< 10 giây) → không kết luận trùng, chỉ cảnh báo.
- Hai admin đăng cùng lúc cùng bài: kiểm trùng lại ở bước lưu, trong transaction.
- Endpoint override công khai không lộ ai đặt bìa.

## Kiểm thử

- Unit: hàm điểm Hamming (cặp giống, lệch thời gian, khác hẳn); thứ tự ưu tiên bìa; ngưỡng phân loại.
- Test đối chiếu: cùng file mẫu → dấu vân trình duyệt == `fpcalc`.
- Script đo B4 giữ lại làm test hồi quy (các cặp `also` phải ≥ ngưỡng trùng).
- Playwright: luồng admin đặt bìa → trang công khai hiện bìa; chặn mp3 trong test như thường lệ.

## Thứ tự làm đề xuất

1. B4 đo ngưỡng (không đụng web). 2. Phần A bìa (DB + admin + công khai). 3. B1 công cụ máy.
4. B2 + B3 trang admin nhạc ngoài game. Mỗi bước dùng được độc lập.
