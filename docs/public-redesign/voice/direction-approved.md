# Lồng tiếng (`/characters/<slug>/voice`): hướng đã chọn (huashu gate, 2026-11-19)

Spec: [`../../superpowers/specs/2026-11-19-voice-tab-design.md`](../../superpowers/specs/2026-11-19-voice-tab-design.md) ·
demos: `design-demos/`, chạy bằng launch config `music-demos` (phục vụ `D:\BaiTapCode\WHMX`, cổng 8768), mở
`/WhmxCalc/docs/public-redesign/voice/design-demos/<file>.html`.

Dữ liệu demo: `voice-data.js` là thoại thật của A0100 愿望杯 (r3177), sinh bởi `_claude_scratch/voice_demo_data.py`.
Gồm 3 gói giọng × 44 câu. Chưa có mp3 nên `voice-common.js` giả lập tiếng.

## Ba hướng đã cho xem

| Demo | Logic | Ảnh (`design-demos/shots/`) |
|---|---|---|
| `A-bang-am.html` · Bảng âm | quay số `date +%S` = 23 → web #4 *Friendly Geometric Candy* (soundboard) | `a-1440.jpg`, `a-390.jpg` |
| `B-loi-dang-noi.html` · Lời đang nói | tham chiếu Apple Music lyrics | `b-1440.jpg`, `b-390.jpg` |
| `C-may-ghi-am.html` · Máy ghi âm | nhà thiết kế Teenage Engineering (OP-1, TP-7) | `c-1440.jpg`, `c-390.jpg` |

## Lời chủ dự án qua từng vòng (nguyên văn)

1. Về C: "phần này của hướng C khá đẹp nhưng phần chọn bên dưới dài quá, có thể lựa 1 bố cục dạng thu gọn lại tý,"
   → `C2-may-ghi-am-gon.html` (nhóm thoại + ô câu gọn). Ảnh: `c2-1440.jpg`, `c2-390.jpg`.
2. Về C2: "tách khối quá nhiều nhìn như AI, trong các skill ko có nhắc tới à"
   → `C3-may-ghi-am-mot-tam.html`, làm lại theo DESIGN.md: một tấm, khe 1px làm vạch chia. Ảnh: `c3-1440.jpg`, `c3-390.jpg`.
3. Về C3: "vẫn mắc lỗi đóng hộp quá nhiều, có thể sài impeccable review lại"
   → impeccable chấm C3 25/40 (bản lưu ở `.impeccable/critique/`, git bỏ qua). Lỗi chính: lưới khe 1px tạo ra
   khoảng 26 ô bằng nhau, và ba loại nút dùng chung một kiểu ô.
   → `C4-may-ghi-am-mo.html`. Ảnh: `c4-1440.jpg`, `c4-390.jpg`.
4. Về C4: **"Chốt C4"**.

## C4 chốt những gì

- **Một khối duy nhất là máy ghi âm**: panel phẳng, góc 6px, viền 1px, bên trong không có ô con.
  - Trái: avatar tròn.
  - Giữa: dòng đang phát (số · tên câu · thời gian), câu thoại chữ to, thanh mức âm.
  - Phải: các gói giọng dạng dòng chọn (radio), cách bằng một đường kẻ dọc. Dưới đó là đúng một nút có nền: Phát / Dừng.
- **Nhóm thoại** là tab gạch chân nằm trên trang, không có ô.
- **Câu thoại** là dòng, desktop 2 cột, điện thoại 1 cột. Chỉ có đường kẻ ngang, không viền dọc, không nền ô. Hover thì nền chuyển sang surface.
- **Mỗi loại điều khiển một hình dạng riêng**: gói giọng là radio, nhóm là tab, câu là dòng.
- **Vàng chỉ có nghĩa "đang chọn / đang phát"**. Điều kiện mở khoá và khung giờ dùng màu xám tro. Bỏ các số 01/02 trang trí ở gói và nhóm; số câu vẫn giữ vì máy ghi âm cần nó để gọi tên câu.
- **Điện thoại (≤640px)**: panel xếp dọc, gói giọng nằm thành một hàng chữ, tab nhóm được xuống dòng, không tràn ngang ở 375px.
