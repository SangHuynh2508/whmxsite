# Tab Lồng tiếng (`/characters/<slug>/voice`): nghe thoại nhân vật kèm chữ trong game

Ngày: 2026-11-19 · Trạng thái: **đã duyệt (2026-11-19)** · Kế hoạch: `../plans/2026-11-19-voice-tab.md` · Giao diện: [`../../public-redesign/voice/direction-approved.md`](../../public-redesign/voice/direction-approved.md) (C4) ·
Liên quan: `2026-11-08-music-page-design.md` (cùng kiểu: mp3 trên R2, JSON trong git), `docs/DATA_SPLIT.md`

## Mục tiêu

Người xem mở một Khí giả và nghe được từng câu thoại của nàng trong game, kèm chữ thoại, tên câu, điều kiện mở khoá
và khung giờ. Chọn được gói giọng (Hán ngữ, Cổ Ai Cập ngữ…), và chọn được trang phục nếu nàng có thoại riêng theo trang phục.

**Ngoài phạm vi (bản sau):**
- Lồng tiếng truyện (`novelvoice`). Công cụ đã xuất được (`voice_truyen.json`) nhưng chưa làm lên web.
- Bản dịch Việt của chữ thoại. Chủ dự án tự dịch qua quy trình admin/workbook sau, Claude không điền.
- Sóng âm thật (waveform).
- Tự phát câu kế tiếp.

## Quyết định (chủ dự án, 2026-11-19, "Theo đề xuất" + "Chốt C4")

1. Chỉ làm thoại nhân vật, thoại truyện để sau.
2. Tab con `/characters/<slug>/voice` đặt sau Phòng trà, viết bằng React như TeaTab. Ẩn tab khi Khí giả không có thoại.
3. Có nút chuyển gói giọng, mặc định là gói đầu tiên trong `RESLinesMap.Linestype`.
4. Chỉ hiện bộ chọn trang phục khi có từ 2 trang phục có thoại trở lên.
5. Bốn nhóm: Đời thường / Phát triển / Chiến đấu / Căn cứ & tương tác.
6. Hiện điều kiện mở khoá và khung giờ.
7. Chữ thoại hiện bản Trung qua component `Text` (đánh dấu "chưa dịch"). Claude không điền bản Việt.
8. Chữ (JSON) nằm trong git ở `public/data/voice/`. mp3 lên R2 ở `voice/<id>/<lang>/…`, **chỉ đẩy khi chủ dự án nói có**.
9. Mỗi lúc chỉ phát một câu, không tự chuyển câu.
10. Giao diện theo C4: một khối máy ghi âm, tab nhóm, câu thoại dạng dòng.
11. Spec được duyệt, nhãn Việt của 44 loại câu theo cách (a) (nguyên văn: "Duyệt, nhãn theo (a)"): bản nháp trong demo ghi thẳng vào `voiceView.mts`.

## Đường dữ liệu

```
MuMu ──whmx.py voice──▶ WHMX_Tool/Xuat/<ver>/Audio/  (mp3 + voice_nhanvat.json)
                              │
        tools/build_voice_data.py ──▶ public/data/voice/index.json + public/data/voice/<ID>.json   (git)
        tools/publish_voice.py    ──▶ R2  voice/<id>/<lang>/<skin>_<type>.mp3                     (chỉ khi được duyệt)
```

### 1. WHMX_Tool `voice` (đã viết, chưa chạy với máy ảo)

`voice_index` hiện ghi mỗi câu: `skin, type, order, label, text, file`, và `cv` nếu trang phục có CV riêng.
**Cần thêm hai trường** (lấy từ các bảng mà hàm đã đọc sẵn):
- `unlock`: chữ Trung `linesUnlock[type].unLockTextlanText` (trống thì bỏ trường).
- `zone`: với `timeLine_1` / `timeLine_2`, lấy `characterLines[skin].TimeLine_{1,2}_zone` dạng `"6,0,18,0"`. Build sẽ đổi thành `6:00–18:00`.

### 2. `tools/build_voice_data.py` (mới, chạy trên máy chủ dự án như `build_music_data.py`)

Đầu vào: `voice_nhanvat.json` và `asset_base_url` (giống music.json). Đầu ra:

- `public/data/voice/index.json`: `{version, ids: ["A0100", …]}`. Chỉ gồm Khí giả có ít nhất một câu có file mp3. Tab dựa vào danh sách này để quyết định có hiện hay không.
- `public/data/voice/<ID>.json`:
  ```json
  {"version":"r3177","asset_base_url":"https://…","id":"A0100",
   "langs":[{"lang":"1001","name":"中文-普通话","cv":"井琉",
     "lines":[{"skin":"A0100001","type":"regardsLine","order":2,"label":"问候",
               "text":"今日吹的是北风…","unlock":"…","zone":"6:00–18:00","cv":"…",
               "key":"voice/a0100/1001/a0100001_regardsLine.mp3"}]}]}
  ```
  - `key` là đường dẫn tương đối trên R2. Câu không có mp3 thì `key: null`: vẫn hiện chữ, nút phát tắt.
  - Câu có mp3 mà game không có chữ (48 câu đo ở r3177) thì `text: ""`. Web ghi "Không có chữ trong dữ liệu game", nhưng vẫn phát được.
  - Thứ tự: gói mặc định trước (như tool đã sắp), câu xếp theo `(skin, order)`.
- Không đoán nghĩa từ ID: nhóm, nhãn và trang phục đều lấy từ bảng game hoặc từ ánh xạ `type` ghi rõ ở mục 4.

### 3. `tools/publish_voice.py` (mới, chép khuôn `publish_music.py`)

Đọc các `key` trong `public/data/voice/*.json`, tải mp3 tương ứng lên R2:
- `ContentType audio/mpeg`, `Cache-Control public, max-age=604800`.
- Metadata `source-sha256`; file không đổi thì bỏ qua.
- `--dry-run` chỉ liệt kê số file và dung lượng.

**Chỉ chạy thật khi chủ dự án nói có.** Trước đó chỉ chạy `--dry-run` để báo dung lượng.

### 4. Web

| File | Việc |
|---|---|
| `src/features/characters/voice/voiceData.mts` | Tải `index.json` (một lần mỗi lần mở trang, như music.json) và `<ID>.json`. Tải lỗi thì không giữ lại kết quả. |
| `src/features/characters/voice/voiceView.mts` | Hàm thuần: ánh xạ `type` → nhóm (bảng 44 type trong demo `voice_demo_data.py`; type lạ vào nhóm thứ năm "Khác", chỉ hiện khi có câu); nhãn Việt của type; danh sách trang phục; chuỗi ghi chú (mở khoá / khung giờ); đánh số câu. |
| `src/features/characters/voice/VoiceTab.tsx` | Giao diện C4, gồm `mountVoiceTab` / `unmountVoiceTab` giống TeaTab. |
| `src/features/characters/styles/voiceTab.css` | Chuyển CSS C4 sang token của `src/styles/tokens.css`. |
| `characterDetail.js` | Thêm `case 'voice'`, unmount ở đầu `renderTabContent`, link tab sau Phòng trà. |
| `src/i18n/strings.mts` | `tabVoice` (vi "Lồng tiếng", cn "语音") và các chữ giao diện của tab. |

**Ẩn / hiện tab:**
- Thanh tab vẽ như cũ. Khi `index.json` tải xong và có ID này thì chèn link "Lồng tiếng" sau Phòng trà.
- Nếu ai mở thẳng `/voice` của Khí giả không có thoại, hiện dòng "Khí giả này chưa có lồng tiếng." (không báo 404).

**Phát:**
- Dùng một `HTMLAudioElement` duy nhất. Chọn câu khác thì dừng câu đang phát.
- Hết câu thì dừng, không tự chuyển câu.
- Nút Phát / Dừng đổi biểu tượng tam giác ↔ vuông. Thời gian lấy từ `currentTime / duration`.
- Lỗi tải mp3: dòng đang phát ghi "Không phát được câu này". Nút phát quay về trạng thái nghỉ.

**Thanh mức âm:** tô vàng theo **tiến độ** (bao nhiêu phần đã phát), không phải âm lượng thật. Đo âm lượng thật cần
Web Audio, và R2 phải trả header CORS. Ponytail: để sau, nếu chủ dự án muốn sóng thật.

**Gói giọng:** dạng radio trong panel. Đổi gói thì dừng tiếng và giữ nhóm đang xem.

**Trang phục:** chỉ hiện khi có từ 2 trang phục trở lên. Dùng một hàng radio chữ phía trên các tab nhóm, gồm tên trang phục (lấy từ dữ liệu trang phục có sẵn) và CV riêng nếu có.

**Truy cập:**
- Gói giọng dùng `role=radiogroup`, nhóm dùng `role=tablist` (phím mũi tên chuyển tab), câu là `button`.
- Dòng đang phát đặt trong vùng `aria-live=polite`.
- Viền focus 2px màu vàng. Có `prefers-reduced-motion`.

**Điện thoại:** theo C4 (≤640px xếp dọc, ≤1000px ẩn avatar). Không tràn ngang ở 375px.

## Kiểm thử

- `voiceView.test.mts`:
  - đủ 44 type vào đúng 4 nhóm; type lạ vào "Khác";
  - đổi khung giờ `6,0,18,0` → `6:00–18:00`;
  - bộ chọn trang phục chỉ có khi có từ 2 trang phục;
  - câu `key:null` bị tắt phát.
- `tools/test_build_voice_data.py`: một `voice_nhanvat.json` nhỏ → `index.json` chỉ có Khí giả có mp3; `key` đúng dạng; câu không chữ vẫn giữ lại.
- `tools/test_publish_voice.py`: hàm tạo `object_key` và `--dry-run` không cần biến môi trường R2.
- Kiểm trên trình duyệt ở 1440 và 375 với A0100:
  - đổi gói giọng, đổi nhóm, phát rồi dừng;
  - Khí giả không có thoại thì không có tab.
  - Lúc này mp3 chưa có trên R2: thử bằng `asset_base_url` trỏ vào thư mục xuất ở máy.

## Câu hỏi mở

1. ~~**Nhãn Việt của 44 loại câu**~~ Đã chốt (a), xem quyết định 11. ("Chào hỏi", "Trò chuyện 1", "Phá cục thành công 1"…). Đây là chữ giao diện, không
   phải chữ thoại. Bản nháp trong demo là của Claude. Hai cách:
   - (a) chủ dự án duyệt bản nháp đó, rồi ghi thẳng vào `voiceView.mts`;
   - (b) đưa vào workbook để chủ dự án tự dịch.

   Chữ Trung (`typeNamelanText`) luôn hiện bên cạnh.
2. **Dung lượng R2**: chỉ biết sau khi rút mp3 (`whmx.py voice`) và chạy `publish_voice.py --dry-run`. Sẽ báo con số trước khi xin đẩy.

## Nhãn Việt của 44 loại câu (chủ dự án duyệt 2026-11-19)

Nguyên văn: "chiêu mộ thay cho chiêu tập đi, thưởng trà thay cho phẩm trà, duyệt cả tăng trí tri nữa, còn lại như cũ hợp lý r".
`voiceView.mts` ghi đúng bảng này (khoá là `linesType` của `linesUnlock`).

| Nhóm | linesType → nhãn Việt (CN) |
|---|---|
| Đời thường | dropLine Chiêu mộ (招集) · regardsLine Chào hỏi (问候) · appointmentLine Bổ nhiệm (任命) · touchLine_1/2/3 Trò chuyện 1/2/3 (交谈) · touchLine_4 Đầu Khế chi đàm (投契之谈) · touchLine_5 Lộc Minh chi đàm (鹿鸣之谈) · touchLine_6 Mạc Nghịch chi đàm (莫逆之谈) · timeLine_1/2 Trò chuyện theo giờ 1/2 (时段交谈) · unuseLine Một mình (独处) · happyBirthdayLine Mừng sinh nhật (生日庆贺) |
| Phát triển | levelUpLine Lên cấp (升级) · strengthenLine_1 Tăng Trí Tri (致知提升) · strengthenLine_2 Hoán Chương (焕彰) · strengthenLine_3 Tinh Nghiên (精研) · equipLine_1/2 Trang bị 1/2 (装备穿戴) |
| Chiến đấu | joinpLine Vào đội hình (加入编队) · displayLine_1/2 Ra trận 1/2 (战斗登场) · switchToLine / _2 / _3 Tập trung 1/2/3 (聚焦) · skillLine / _2 Dùng kỹ năng 1/2 (释放技能) · beDyingLine Nguy kịch (濒危) · skillReadyLine / _2 Tuyệt kỹ sẵn sàng 1/2 (绝技就绪) · victoryLine_1/2 Phá cục thành công 1/2 (破局成功) · loseLine_1/2 Phá cục thất bại 1/2 (破局失败) |
| Căn cứ & tương tác | enterInstallationLine Vào cơ sở (入驻) · installationLine_1/2 Hội thoại cơ sở 1/2 (设施会话) · expeditionstartLine Viễn chinh xuất phát (远征出发) · expeditionsucceedLine Viễn chinh thành công (远征成功) · expeditionbackLine Viễn chinh trở về (远征归来) · giftVictoryLine / giftLoseLine Cảm ứng 1/2 (感应) · teaVictoryLine / teaLoseLine Thưởng trà 1/2 (品茗) |
