# Dịch thoại Lồng tiếng trong Admin

Ngày: 2026-11-19 · Trạng thái: **đã duyệt (2026-11-19, "Duyệt spec")** · Kế hoạch: `../plans/2026-11-19-voice-translation.md`.

Dựa trên:
- tab Lồng tiếng: [`2026-11-19-voice-tab-design.md`](2026-11-19-voice-tab-design.md);
- khuôn Phòng trà: [`2026-10-03-tea-room-design.md`](2026-10-03-tea-room-design.md), gồm `profile_texts`, Từ điển và phát hành lore.

## 1. Mục tiêu và phạm vi

Chủ dự án dịch chữ thoại nhân vật sang tiếng Việt trong Admin. Tab Lồng tiếng hiện câu Việt; câu nào chưa dịch thì vẫn hiện chữ Trung, có dấu "chưa dịch".

**Claude chỉ dựng đường dữ liệu, không dịch câu nào** (memory "admin text: owner translates").

**Trong phạm vi:**
- nhập chữ thoại vào DB;
- module Admin "Lồng tiếng", có nút nghe mp3;
- 8 câu mở khoá đưa vào Từ điển;
- một tài liệu phát hành riêng `voice.<hash>.json`;
- web ghép bản dịch vào.

**Ngoài phạm vi:**
- lồng tiếng truyện;
- dịch 44 nhãn loại câu (đã ghi trong code, xem spec tab);
- tự động dịch.

## 2. Số liệu (r3177, đo từ `public/data/voice/`)

| | |
|---|---|
| Câu thoại | 6.922 (138 Khí giả) |
| Chữ khác nhau trong từng Khí giả | 6.235 câu, khoảng 191 nghìn chữ Hán |
| Gói giọng phụ (13 Khí giả) | 660 câu, trong đó 637 câu giống hệt chữ gói chính |
| Thoại riêng theo trang phục (12 Khí giả) | 187 câu, không câu nào giống trang phục gốc |
| Câu điều kiện mở khoá | 8, dùng chung (vd 感应达到投契解锁, 精研解锁, 功能模块开发中) |

## 3. Quyết định của chủ dự án (2026-11-19)

| # | Quyết định |
|---|---|
| V1 | Gói giọng phụ: câu trùng chữ với gói chính thì **dịch một lần**. Chỉ câu khác chữ mới có ô riêng. |
| V2 | 8 câu mở khoá dịch trong **Từ điển** (loại mới "Lồng tiếng"). |
| V3 | Trong Admin, mỗi câu có **nút nghe** mp3 (lấy từ R2). |
| V4 | Trên tab: màn phát hiện **câu Việt chữ to, câu Trung chữ nhỏ bên dưới**. Dòng trong danh sách chỉ hiện câu Việt; chưa dịch thì hiện câu Trung như bây giờ. |

## 4. Dữ liệu

### 4.1 Nguồn

Importer đọc **`public/data/voice/<ID>.json`** (do `build_voice_data.py` tạo, lưu trong git), **không** đọc MasterData.
- **Lý do:** cùng bản game với mp3 (r3177), còn MasterData của NeoArtifacts mới ở r3164. Khoá câu cũng khớp đúng với tab.
- Receipt hash tính trên các file đó.

### 4.2 Khoá câu (`profile_texts.unit_key`)

| Khoá | Câu nào |
|---|---|
| `voice.<skin>.<type>` | câu của gói chính (gói đầu tiên trong `langs`) |
| `voice.<skin>.<type>.<lang>` | câu của gói phụ, **chỉ khi chữ khác** câu cùng `<skin>.<type>` của gói chính (V1; r3177 có 23 câu) |

- `<skin>` viết hoa như dữ liệu (`A0100001`), `<type>` là `linesType` (`regardsLine`).
- `source` = `voice:<ID>/<lang>/<skin>/<type>`.
- Câu không có chữ trong game (48 câu) thì không tạo khoá.
- `inScope` (Admin) và bộ đếm tiến độ của Lore loại trừ tiền tố `voice.`, giống cách đang loại `tea.`.

Không cần `structure.voice`: thứ tự và nhóm câu đã có trong `public/data/voice/<ID>.json`. Admin tải chính file đó để xếp câu (§6).

### 4.3 Từ điển

- **Migration 0010:** `lore_term_kind` thêm giá trị `voice_unlock`, theo đúng mẫu 0009.
- Mỗi câu mở khoá là một thuật ngữ, `name_cn` = câu Trung. Mã `VOICE_UNLOCK_<n>`:
  - lần nhập đầu đánh số theo thứ tự chữ Trung;
  - câu mới ở bản game sau lấy số kế tiếp;
  - câu đã có giữ nguyên mã (importer tìm theo `name_cn`).

### 4.4 Importer

Mở rộng `scripts/import-character-profile.mjs`, cùng quy tắc `--check` / plan / `--apply`. **Mỗi lần ghi DB phải có chủ dự án đồng ý.**

- Phần thuần đặt trong `scripts/lib/voice-source.mjs`. Hàm `voiceUnits(doc)` trả `{units, unlocks}`. Có test.
- **Chữ Trung đổi ở bản game sau:** theo quy tắc sẵn có (`source_changed`, bản Việt giữ lại và đánh dấu cần xem lại).
- **Câu biến mất:** theo quy tắc sẵn có của `profile_texts`.

## 5. Phát hành: tài liệu `voice.<hash>.json`

Thêm vào vòng phát hành trong `lore-publisher.mjs`, đi cạnh `lore` và `game`, với pointer `voice.pointer.json` nằm cạnh `lore.pointer.json`.

**Không nhét vào tài liệu lore**, vì tài liệu lore được tải ở mọi trang. Khi dịch đủ, phần thoại có thể vượt 1 MB. Tài liệu `voice` chỉ tải khi mở tab Lồng tiếng.

```json
{ "version": 1,
  "unlock": { "感应达到投契解锁": "Mở khi Cảm ứng đạt Đầu Khế" },
  "characters": { "A0100": { "A0100001.regardsLine": "Hôm nay gió bấc thổi…", "A0100001.touchLine_4.1007": "…" } } }
```

- Chỉ chứa bản dịch qua `publishableVi` (admin + ok). Câu chưa dịch thì không có trong file.
- Khoá giống unit key, bỏ tiền tố `voice.`.
- Khí giả không có câu nào đã dịch thì không có mục.
- Builder thuần: `server/profile/voice-document.mjs`, có test, theo mẫu `game-document.mjs`.

## 6. Admin

- **Module "Lồng tiếng"** (`id: 'voice'`) trong trang Khí giả, đặt sau Phòng trà.
  - Dùng `LoreModule` với `scope: 'voice'`. `inScope` đổi thành dạng tiền tố (`lore` / `tea` / `voice`).
  - Dùng chung API `GET/PATCH lore/characters/:id`, nên chung revision. Sửa song song với Lore hoặc Phòng trà của cùng Khí giả thì bị 409 như hiện nay.
- **Nhóm câu** (`voiceUnitGroups` trong `lib/loreUnits.mts`): 4 nhóm như tab (Đời thường / Phát triển / Chiến đấu / Căn cứ & tương tác).
  - Dùng lại `GROUP_OF` và `LABEL_VI` của `voiceView.mts`, không chép bảng.
  - Mỗi ô ghi: `Chào hỏi · 问候`. Câu của trang phục khác thì thêm tên trang phục. Câu gói phụ khác chữ thì thêm tên gói.
  - Mở khoá và khung giờ hiện dạng nhãn phụ.
- **Nút nghe** (V3): một nút ▶ cạnh mỗi câu. Nút phát `asset_base_url + key` của câu đó, lấy từ `public/data/voice/<ID>.json`. Mỗi lúc chỉ phát một câu. Câu không có mp3 thì không có nút.
- **Tiến độ:** module tự hiện "x/y". Bộ đếm Lore và danh sách Khí giả không tính câu `voice.*`. Câu `voice.*` không đổi `vi_updated_at` (mục "Mới dịch" ở trang chủ vẫn chỉ nói về hồ sơ), giống Phòng trà.
- **Từ điển → Lore:** thêm loại "Lồng tiếng" (8 câu mở khoá). `termUsage` đếm số Khí giả có câu dùng mở khoá đó.

## 7. Web (tab Lồng tiếng)

- `voiceData.mts`: thêm `loadVoiceVi(lorePointerUrl)`, dùng lại `loadPointed` với pointer `voice.pointer.json`, cache một lần mỗi lần mở trang. Tải lỗi trả `null`; tab vẫn chạy bằng chữ Trung.
- `voiceView.mts`: `groupsOf(lang, skin, vi?)`. Mỗi câu (`Take`) có thêm `vi: LoreUnit | null` và `cn: string`:
  - khoá gói chính: `<skin>.<type>`;
  - với gói phụ: thử `<skin>.<type>.<lang>` trước, không có thì dùng bản dịch của câu gói chính khi chữ Trung giống nhau (V1).
  - Mở khoá lấy từ `unlock[cn]`.
- `VoiceTab.tsx` (V4):
  - **màn phát:** câu Việt (cỡ 20px như bây giờ), dưới là câu Trung 15px màu tro. Chưa dịch thì giữ như hiện tại: chữ Trung có dấu "chưa dịch".
  - **dòng:** câu Việt một dòng; chưa dịch thì câu Trung.
- Tab vẫn hiện ngay bằng chữ Trung. Bản dịch tới sau thì vẽ lại, không chặn trang.

## 8. Lỗi và kiểm thử

| Chỗ | Lỗi | Xử lý |
|---|---|---|
| Importer | thiếu `public/data/voice/index.json` hoặc file `<ID>.json` | dừng trước khi ghi, ghi rõ tên file |
| Importer | câu mở khoá rỗng | bỏ qua (không tạo thuật ngữ) |
| Phát hành | tài liệu voice rỗng (chưa dịch câu nào) | vẫn phát hành `{version:1, unlock:{}, characters:{}}` để pointer luôn hợp lệ |
| Web | `voice.pointer.json` 404 / quá giờ | hiện chữ Trung, không báo lỗi |
| Admin | mp3 chưa có trên R2 | nút nghe hiện "không phát được", vẫn dịch được |

**Test** (node:test, mỗi phần một test):
- `voice-source`:
  - khoá gói chính / gói phụ khác chữ;
  - câu trùng chữ không tạo khoá;
  - câu rỗng bỏ qua;
  - 8 câu mở khoá thành thuật ngữ.
- `voice-document`: chỉ bản dịch ok mới vào; khoá bỏ tiền tố.
- `voiceUnitGroups`, `inScope` 3 phạm vi, tiến độ Lore không tính `voice.*`.
- `voiceView`: ưu tiên khoá gói phụ, dùng bản dịch gói chính khi trùng chữ, không có bản dịch thì trả về chữ Trung.

**Trình duyệt:** dev 3003 trên development, nhập một bản dịch thử. Kiểm Admin (nghe, lưu) và tab ở 1440 và 390.

**Các bước DB cần chủ dự án đồng ý:**
1. migration 0010 (development, rồi production);
2. importer `--apply` (development, rồi production);
3. lần phát hành đầu ở production.
