# Hồ sơ vũ khí — bản dịch nháp (Claude, 2026-11-23, chờ chủ duyệt)

File: `public/weapons.vi.json` (sửa thẳng file này rồi deploy; trang Vũ Khí đọc VI khi có, thiếu thì hiện CN có chấm "chưa dịch").
Nguồn CN: `public/weapons.json` (`tools/build_weapons.py`, MasterData r3177). Chạy lại tool không đụng tới file VI.

Phân loại, đặc tính, nhà chế tạo được ghép từ các mảnh (dịch một lần, áp cho cả 110 món). Những chỗ cần duyệt:

| CN | VI nháp | Ghi chú |
|---|---|---|
| 仿真类 / 古典类 / 星象类 | Phỏng Chân / Cổ Điển / Tinh Tượng | tên dòng → Hán-Việt |
| 珐琅类 / 菱纹类 / 青玉类 | Pháp Lang / Lăng Văn / Thanh Ngọc | Pháp Lang khớp tên đã duyệt "Pháp Lang Thuẫn" |
| 铜青类 | Đồng Thanh | khớp buff đã duyệt "Đồng Thanh Nỗ" |
| 太虚恒光 / 流云鸣沙 / 绮木覆花 / 金桂抱月 | Thái Hư Hằng Quang / Lưu Vân Minh Sa / Ỷ Mộc Phúc Hoa / Kim Quế Bão Nguyệt | |
| 刀 / 双刀 / 剑 / 弓弩 / 弩 / 法杖 / 炮 / 盾 / 仪 / 钩 | Đao / Song Đao / Kiếm / Cung Nỗ / Nỗ / Pháp Trượng / Pháo / Thuẫn / Nghi / Câu | Nỗ, Thuẫn theo tên buff đã duyệt |
| 刑天 / 安息香 / 巫南研究 / 无根之木 / 海角山庄 | Hình Thiên / An Tức Hương / Vu Nam Nghiên Cứu / Vô Căn Chi Mộc / Hải Giác Sơn Trang | hãng chế tạo |
| 琢磨 / 罄乐行 / 超金 / 鸠浅 | Trác Ma / Khánh Lạc Hành / Siêu Kim / Cưu Thiển | |
| 制式装备 / 古典装备 / 概念装备 / 意外惊喜 | Trang bị tiêu chuẩn / Trang bị cổ điển / Trang bị ý tưởng / Bất ngờ thú vị | loại trang bị (9 loại) |
| 路边物件 (系列) | Lộ Biên Vật Kiện | tên dòng trong mô tả |
| 菱式系列 | dòng Lăng Thức | |
| 瓶内词话 | Bình Nội Từ Thoại | |
| 当见幽堂 | Đương Kiến U Đường | tổ chức trong mô tả 30943 |
| 狴犴好讼，亦曰宪章 | Bệ Ngạn hiếu tụng, diệc viết Hiến Chương | câu trích giữ Hán-Việt |

Câu thơ trích trong ngoặc kép giữ Hán-Việt (山回路转不见君, 唯有牡丹真国色, 桃花流水窅然去…). Nhà Sưu Tập không xuất hiện; người đọc được gọi "cô/cậu".
Đặc tính (78 mảnh kỹ thuật như 电弧内导 "dẫn hồ quang trong", 构势能 "thế năng Cấu Tố") dịch mô tả, không phải tên riêng.
